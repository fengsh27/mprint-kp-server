import { NextRequest, NextResponse } from 'next/server';

// Input validation and sanitization
export class InputValidator {
  private static readonly MAX_STRING_LENGTH = 1000;
  private static readonly MAX_ARRAY_LENGTH = 1000;
  private static readonly ALLOWED_CHARS = /^[a-zA-Z0-9\s\-_.,()\[\]{}":;@#$%^&*+=<>?\/\\|~`!]+$/;

  static validateString(value: string, fieldName: string): { valid: boolean; error?: string } {
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

  static validateArray(value: any[], fieldName: string, maxLength: number = this.MAX_ARRAY_LENGTH): { valid: boolean; error?: string } {
    if (!Array.isArray(value)) {
      return { valid: false, error: `${fieldName} must be an array` };
    }

    if (value.length > maxLength) {
      return { valid: false, error: `${fieldName} array exceeds maximum length of ${maxLength}` };
    }

    return { valid: true };
  }

  static validatePMID(pmid: string): { valid: boolean; error?: string } {
    if (!/^\d{1,8}$/.test(pmid)) {
      return { valid: false, error: 'PMID must be a 1-8 digit number' };
    }
    return { valid: true };
  }

  static validateCUI(cui: string): { valid: boolean; error?: string } {
    if (!/^C\d{7}$/.test(cui)) {
      return { valid: false, error: 'CUI must be in format C followed by 7 digits' };
    }
    return { valid: true };
  }

  static sanitizeString(value: string): string {
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
export function validateRequestSize(req: NextRequest, maxSizeMB: number = 10): { valid: boolean; error?: string } {
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

// Request logging for security monitoring
export function logSecurityEvent(req: NextRequest, event: string, details?: any): void {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip || 'unknown',
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
export function detectSQLInjection(input: string): boolean {
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
