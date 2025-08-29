import { NextResponse } from 'next/server';
import data from "../../data/static_data.json"
import { withRateLimit, apiRateLimiter } from "../../libs/middleware/rateLimiter";
import { 
  InputValidator, 
  addSecurityHeaders, 
  validateRequestSize, 
  detectSQLInjection,
  sanitizeInput,
  logSecurityEvent 
} from "../../libs/middleware/security";

async function testHandler(req: Request) {
  // Example of using localhost bypass
  const isLocalhost = req.headers.get('host')?.includes('localhost') || 
                     req.headers.get('host')?.includes('127.0.0.1');

  // Validate request size (skips for localhost if configured)
  const sizeValidation = validateRequestSize(req as any, 5, true); // true = skip for localhost
  if (!sizeValidation.valid) {
    logSecurityEvent(req as any, 'REQUEST_SIZE_EXCEEDED', { size: req.headers.get('content-length') });
    return NextResponse.json(
      { error: 'Request too large', message: sizeValidation.error },
      { status: 413 }
    );
  }

  try {
    // Example of bypassing input validation for localhost
    const testInput = "test'; DROP TABLE users; --"; // This would normally be blocked
    
    if (isLocalhost) {
      console.log('Localhost request - skipping strict validation');
    } else {
      // Only check for SQL injection on non-localhost requests
      if (detectSQLInjection(testInput, false, req as any)) {
        return NextResponse.json(
          { error: 'Invalid input', message: 'Suspicious input detected' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ 
      message: "API is working!",
      timestamp: new Date().toISOString(),
      localhost: isLocalhost,
      securityFeatures: {
        rateLimiting: "Enabled (bypassed for localhost)",
        inputValidation: "Enabled (bypassed for localhost)",
        sqlInjectionProtection: isLocalhost ? "Bypassed for localhost" : "Active"
      }
    });
  } catch (error) {
    console.error('Error in test API:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to process test request'
      },
      { status: 500 }
    );
  }
}

// Export with rate limiting (automatically bypassed for localhost)
export const GET = withRateLimit(testHandler, apiRateLimiter);
export const POST = withRateLimit(testHandler, apiRateLimiter);