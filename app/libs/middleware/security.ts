import { NextRequest, NextResponse } from 'next/server';

// Helper function to detect localhost requests
export function isLocalhost(req: NextRequest): boolean {
  const clientIP = getClientIP(req);
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

// Input validation and sanitization
export class InputValidator {
  private static readonly MAX_STRING_LENGTH = 1000;
  private static readonly MAX_ARRAY_LENGTH = 1000;
  private static readonly ALLOWED_CHARS = /^[a-zA-Z0-9\s\-_.,()\[\]{}":;@#$%^&*+=<>?\/\\|~`!]+$/;

  static validateString(value: string, fieldName: string, skipForLocalhost: boolean = false, req?: NextRequest): { valid: boolean; error?: string } {
    // Skip validation for localhost if requested
    if (skipForLocalhost && req && isLocalhost(req)) {
      return { valid: true };
    }

    if (!value || typeof value !== 'string') {
      return { valid: false, error: `${fieldName} must be a non-empty string` };
    }

    if (value.length > this.MAX_STRING_LENGTH) {
      return { valid: false, error: `${fieldName} exceeds maximum length of ${this.MAX_STRING_LENGTH}` };
    }

    if (!this.ALLOWED_CHARS.test(value)) {
      return { valid: false, error: `${fieldName} contains invalid characters` };
    }

    return { valid: true };
  }

  static validateArray(value: any[], fieldName: string, maxLength: number = this.MAX_ARRAY_LENGTH, skipForLocalhost: boolean = false, req?: NextRequest): { valid: boolean; error?: string } {
    // Skip validation for localhost if requested
    if (skipForLocalhost && req && isLocalhost(req)) {
      return { valid: true };
    }

    if (!Array.isArray(value)) {
      return { valid: false, error: `${fieldName} must be an array` };
    }

    if (value.length > maxLength) {
      return { valid: false, error: `${fieldName} array exceeds maximum length of ${maxLength}` };
    }

    return { valid: true };
  }

  static validatePMID(pmid: string, skipForLocalhost: boolean = false, req?: NextRequest): { valid: boolean; error?: string } {
    // Skip validation for localhost if requested
    if (skipForLocalhost && req && isLocalhost(req)) {
      return { valid: true };
    }

    if (!/^\d{1,8}$/.test(pmid)) {
      return { valid: false, error: 'PMID must be a 1-8 digit number' };
    }
    return { valid: true };
  }

  static validateCUI(cui: string, skipForLocalhost: boolean = false, req?: NextRequest): { valid: boolean; error?: string } {
    // Skip validation for localhost if requested
    if (skipForLocalhost && req && isLocalhost(req)) {
      return { valid: true };
    }

    if (!/^C\d{7}$/.test(cui)) {
      return { valid: false, error: 'CUI must be in format C followed by 7 digits' };
    }
    return { valid: true };
  }

  static sanitizeString(value: string, skipForLocalhost: boolean = false, req?: NextRequest): string {
    // Skip sanitization for localhost if requested
    if (skipForLocalhost && req && isLocalhost(req)) {
      return value;
    }

    return value
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }
}

// Security headers middleware
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );

  return response;
}

// Request size limiting
export function validateRequestSize(req: NextRequest, maxSizeMB: number = 10, skipForLocalhost: boolean = false): { valid: boolean; error?: string } {
  // Skip size validation for localhost if requested
  if (skipForLocalhost && isLocalhost(req)) {
    return { valid: true };
  }

  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const sizeMB = parseInt(contentLength) / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return { valid: false, error: `Request body exceeds maximum size of ${maxSizeMB}MB` };
    }
  }
  return { valid: true };
}

// CORS configuration
export function addCORSHeaders(response: NextResponse, allowedOrigins: string[] = ['*']): NextResponse {
  const origin = allowedOrigins.includes('*') ? '*' : allowedOrigins.join(', ');
  
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return response;
}

// Authentication middleware (placeholder for future implementation)
export function requireAuth(req: NextRequest): { valid: boolean; error?: string; user?: any } {
  // TODO: Implement actual authentication logic
  // For now, return valid (no auth required)
  return { valid: true };
}

// Helper function to get client IP from request
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

// Request logging for security monitoring
export function logSecurityEvent(req: NextRequest, event: string, details?: any): void {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: getClientIP(req),
    userAgent: req.headers.get('user-agent') || 'unknown',
    method: req.method,
    url: req.url,
    event,
    details
  };

  // Log to console for now, in production you'd want to log to a proper logging service
  console.log('SECURITY_EVENT:', JSON.stringify(logData, null, 2));
}

// SQL injection detection (basic)
export function detectSQLInjection(input: string, skipForLocalhost: boolean = false, req?: NextRequest): boolean {
  // Skip SQL injection detection for localhost if requested
  if (skipForLocalhost && req && isLocalhost(req)) {
    return false;
  }

  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    /(\b(or|and)\b\s+\d+\s*[=<>])/i,
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b\s+.*\bfrom\b)/i,
    /(--|\/\*|\*\/)/,
    /(\bxp_|sp_|fn_)/i
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

// Input sanitization wrapper
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return InputValidator.sanitizeString(input);
  }
  
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}
