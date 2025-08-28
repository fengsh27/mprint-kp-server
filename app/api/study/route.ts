// app/api/type_population/route.ts
import { NextResponse } from "next/server";
import { queriedStudy } from "../../libs/database/query_db";
import { withRateLimit, searchRateLimiter } from "../../libs/middleware/rateLimiter";
import { 
  InputValidator, 
  addSecurityHeaders, 
  validateRequestSize, 
  detectSQLInjection,
  sanitizeInput,
  logSecurityEvent 
} from "../../libs/middleware/security";

async function studyHandler(req: Request) {
  // Validate request size
  const sizeValidation = validateRequestSize(req as any, 5); // 5MB max for POST requests
  if (!sizeValidation.valid) {
    logSecurityEvent(req as any, 'REQUEST_SIZE_EXCEEDED', { size: req.headers.get('content-length') });
    return NextResponse.json(
      { error: 'Request too large', message: sizeValidation.error },
      { status: 413 }
    );
  }

  try {
    const body = await req.json();
    
    // Input validation
    if (!body || !Array.isArray(body)) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Request body must be an array' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'Request body must be an array' },
        { status: 400 }
      );
    }

    const arrayValidation = InputValidator.validateArray(body, 'request body', 5000);
    if (!arrayValidation.valid) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: arrayValidation.error });
      return NextResponse.json(
        { error: 'Invalid input', message: arrayValidation.error },
        { status: 400 }
      );
    }

    // Validate each item in the array
    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      
      if (!item || typeof item !== 'object') {
        logSecurityEvent(req as any, 'INVALID_INPUT', { error: `Invalid item at index ${i}` });
        return NextResponse.json(
          { error: 'Invalid input', message: `Invalid item at index ${i}` },
          { status: 400 }
        );
      }

      if (!item.pmid || typeof item.pmid !== 'string') {
        logSecurityEvent(req as any, 'INVALID_INPUT', { error: `Missing or invalid PMID at index ${i}` });
        return NextResponse.json(
          { error: 'Invalid input', message: `Missing or invalid PMID at index ${i}` },
          { status: 400 }
        );
      }

      const pmidValidation = InputValidator.validatePMID(item.pmid);
      if (!pmidValidation.valid) {
        logSecurityEvent(req as any, 'INVALID_INPUT', { error: pmidValidation.error, pmid: item.pmid, index: i });
        return NextResponse.json(
          { error: 'Invalid input', message: pmidValidation.error },
          { status: 400 }
        );
      }

      // Check for SQL injection attempts
      if (detectSQLInjection(item.pmid)) {
        logSecurityEvent(req as any, 'SQL_INJECTION_ATTEMPT', { pmid: item.pmid, index: i });
        return NextResponse.json(
          { error: 'Invalid input', message: 'Suspicious input detected' },
          { status: 400 }
        );
      }
    }

    // Extract PMIDs and sanitize
    const pmids = body.map((item: any) => item.pmid);
    const sanitizedPmids = sanitizeInput(pmids);

    const rows = await queriedStudy(sanitizedPmids);
    
    // Log successful query
    logSecurityEvent(req as any, 'SUCCESSFUL_QUERY', { 
      pmidCount: pmids.length,
      resultCount: rows.length 
    });

    const response = NextResponse.json(rows);
    return addSecurityHeaders(response);

  } catch (error) {
    console.error('Error in study API:', error);
    logSecurityEvent(req as any, 'DATABASE_ERROR', { error: error instanceof Error ? error.message : String(error) });
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to fetch study data'
      },
      { status: 500 }
    );
  }
}

// Export with rate limiting
export const POST = withRateLimit(studyHandler, searchRateLimiter);
