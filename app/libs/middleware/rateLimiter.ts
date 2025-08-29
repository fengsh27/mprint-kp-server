import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Maximum requests per window
  message: string;         // Error message
  statusCode: number;      // HTTP status code for rate limit exceeded
  skipForLocalhost?: boolean; // Skip rate limiting for localhost
}

interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.cleanup();
  }

  private cleanup() {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      Object.keys(this.store).forEach(ip => {
        if (this.store[ip].resetTime < now) {
          delete this.store[ip];
        }
      });
    }, 5 * 60 * 1000);
  }

  private getClientIP(req: NextRequest): string {
    // Get IP from various headers (for different deployment scenarios)
    const forwarded = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const cfConnectingIP = req.headers.get('cf-connecting-ip');
    
    if (forwarded) {
      console.log('forwarded', forwarded);
      return forwarded.split(',')[0].trim();
    }
    if (realIP) {
      console.log('realIP', realIP);
      return realIP;
    }
    if (cfConnectingIP) {
      console.log('cfConnectingIP', cfConnectingIP);
      return cfConnectingIP;
    }
    
    // Fallback to a default value since req.ip doesn't exist in NextRequest
    console.log('fallback to unknown');
    return 'unknown';
  }

  private isLocalhost(req: NextRequest): boolean {
    const clientIP = this.getClientIP(req);
    const host = req.headers.get('host') || '';
    
    return (
      clientIP === '127.0.0.1' ||
      clientIP === '::1' ||
      clientIP === 'localhost' ||
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('::1')
    );
  }

  check(req: NextRequest): { allowed: boolean; remaining: number; resetTime: number } {
    // Skip rate limiting for localhost if configured
    if (this.config.skipForLocalhost && this.isLocalhost(req)) {
      return { allowed: true, remaining: 999999, resetTime: Date.now() + this.config.windowMs };
    }

    const ip = this.getClientIP(req);
    const now = Date.now();

    if (!this.store[ip]) {
      this.store[ip] = {
        count: 1,
        resetTime: now + this.config.windowMs
      };
      return { allowed: true, remaining: this.config.maxRequests - 1, resetTime: this.store[ip].resetTime };
    }

    // Check if window has reset
    if (now > this.store[ip].resetTime) {
      this.store[ip] = {
        count: 1,
        resetTime: now + this.config.windowMs
      };
      return { allowed: true, remaining: this.config.maxRequests - 1, resetTime: this.store[ip].resetTime };
    }

    // Check if limit exceeded
    if (this.store[ip].count >= this.config.maxRequests) {
      return { allowed: false, remaining: 0, resetTime: this.store[ip].resetTime };
    }

    // Increment counter
    this.store[ip].count++;
    return { 
      allowed: true, 
      remaining: this.config.maxRequests - this.store[ip].count, 
      resetTime: this.store[ip].resetTime 
    };
  }

  getHeaders(remaining: number, resetTime: number): Record<string, string> {
    return {
      'X-RateLimit-Limit': this.config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(resetTime).toISOString(),
    };
  }
}

// Create rate limiter instances for different endpoints
export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,        // 1 minute
  maxRequests: 100,            // 100 requests per minute
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  skipForLocalhost: true       // Skip rate limiting for localhost
});

export const searchRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,        // 1 minute
  maxRequests: 30,             // 30 search requests per minute
  message: 'Too many search requests, please try again later.',
  statusCode: 429,
  skipForLocalhost: true       // Skip rate limiting for localhost
});

export const downloadRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,        // 1 minute
  maxRequests: 10,             // 10 download requests per minute
  message: 'Too many download requests, please try again later.',
  statusCode: 429,
  skipForLocalhost: true       // Skip rate limiting for localhost
});

// Rate limiting middleware function
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  limiter: RateLimiter = apiRateLimiter
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rateLimit = limiter.check(req);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate Limit Exceeded',
          message: limiter.config.message,
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: limiter.config.statusCode,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
            'Content-Type': 'application/json',
            ...limiter.getHeaders(rateLimit.remaining, rateLimit.resetTime)
          }
        }
      );
    }

    // Add rate limit headers to successful responses
    const response = await handler(req);
    Object.entries(limiter.getHeaders(rateLimit.remaining, rateLimit.resetTime))
      .forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    
    return response;
  };
}
