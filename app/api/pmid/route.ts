// app/api/pmids/route.ts
import { NextResponse } from "next/server";
import { queriedPMIDMySql } from "../../libs/database/query_db";
import type { QueriedPmidInput } from "../../libs/database/types";
import { withRateLimit, searchRateLimiter } from "../../libs/middleware/rateLimiter";
import { 
  InputValidator, 
  addSecurityHeaders, 
  validateRequestSize, 
  detectSQLInjection,
  sanitizeInput,
  logSecurityEvent 
} from "../../libs/middleware/security";

async function pmidHandler(req: Request) {
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
    const body = await req.json() as QueriedPmidInput;
    
    // Input validation
    if (!body || typeof body !== 'object') {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Invalid request body' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'Request body must be a valid JSON object' },
        { status: 400 }
      );
    }

    // Validate conceptIds array
    if (!body.conceptIds || !Array.isArray(body.conceptIds)) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Missing or invalid conceptIds array' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'conceptIds must be an array' },
        { status: 400 }
      );
    }

    const arrayValidation = InputValidator.validateArray(body.conceptIds, 'conceptIds', 5000);
    if (!arrayValidation.valid) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: arrayValidation.error });
      return NextResponse.json(
        { error: 'Invalid input', message: arrayValidation.error },
        { status: 400 }
      );
    }

    // Validate each concept in the array
    for (let i = 0; i < body.conceptIds.length; i++) {
      const concept = body.conceptIds[i];
      
      if (!concept || typeof concept !== 'object') {
        logSecurityEvent(req as any, 'INVALID_INPUT', { error: `Invalid concept at index ${i}` });
        return NextResponse.json(
          { error: 'Invalid input', message: `Invalid concept at index ${i}` },
          { status: 400 }
        );
      }

      // Validate CUI
      if (!concept.cui || typeof concept.cui !== 'string') {
        logSecurityEvent(req as any, 'INVALID_INPUT', { error: `Missing or invalid CUI at index ${i}` });
        return NextResponse.json(
          { error: 'Invalid input', message: `Missing or invalid CUI at index ${i}` },
          { status: 400 }
        );
      }

      const cuiValidation = InputValidator.validateCUI(concept.cui);
      if (!cuiValidation.valid) {
        logSecurityEvent(req as any, 'INVALID_INPUT', { error: cuiValidation.error, cui: concept.cui });
        return NextResponse.json(
          { error: 'Invalid input', message: cuiValidation.error },
          { status: 400 }
        );
      }

      // Check for SQL injection attempts
      if (detectSQLInjection(concept.cui)) {
        logSecurityEvent(req as any, 'SQL_INJECTION_ATTEMPT', { cui: concept.cui, index: i });
        return NextResponse.json(
          { error: 'Invalid input', message: 'Suspicious input detected' },
          { status: 400 }
        );
      }

      // Validate type
      if (!concept.type || !['drug', 'disease'].includes(concept.type)) {
        logSecurityEvent(req as any, 'INVALID_INPUT', { error: `Invalid type at index ${i}`, type: concept.type });
        return NextResponse.json(
          { error: 'Invalid input', message: `Type must be 'drug' or 'disease' at index ${i}` },
          { status: 400 }
        );
      }
    }

    // Validate searchType
    if (!body.searchType) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Missing searchType' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'searchType is required' },
        { status: 400 }
      );
    }

    const validSearchTypes = ['Drug', 'Disease'];
    if (Array.isArray(body.searchType)) {
      if (!body.searchType.every(type => validSearchTypes.includes(type))) {
        logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Invalid searchType array values' });
        return NextResponse.json(
          { error: 'Invalid input', message: 'searchType array must contain only valid types' },
          { status: 400 }
        );
      }
    } else if (!validSearchTypes.includes(body.searchType)) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Invalid searchType value' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'searchType must be a valid type or array of valid types' },
        { status: 400 }
      );
    }

    // Sanitize input
    const sanitizedBody = sanitizeInput(body);

    const rows = await queriedPMIDMySql(sanitizedBody);
    
    // Log successful query
    logSecurityEvent(req as any, 'SUCCESSFUL_QUERY', { 
      conceptCount: body.conceptIds.length,
      searchType: body.searchType,
      resultCount: rows.length 
    });

    const response = NextResponse.json(rows);
    return addSecurityHeaders(response);

  } catch (error) {
    console.error('Error in PMID API:', error);
    logSecurityEvent(req as any, 'DATABASE_ERROR', { error: error instanceof Error ? error.message : String(error) });
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to fetch PMID data'
      },
      { status: 500 }
    );
  }
}

// Export with rate limiting
export const POST = withRateLimit(pmidHandler, searchRateLimiter);
