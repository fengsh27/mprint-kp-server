// app/api/concepts/route.ts
import { NextResponse } from 'next/server';
import pool from "../../libs/database/silverdb"
import { 
  queryConceptsMySql,
  queriedAtcMySql,
} from "../../libs/database/query_db";
import type { QueryInputs } from "../../libs/database/types";
import { withRateLimit, searchRateLimiter } from "../../libs/middleware/rateLimiter";
import { 
  InputValidator, 
  addSecurityHeaders, 
  validateRequestSize, 
  detectSQLInjection,
  sanitizeInput,
  logSecurityEvent 
} from "../../libs/middleware/security";

async function conceptsHandler(req: Request) {
  // Validate request size
  const sizeValidation = validateRequestSize(req as any, 1); // 1MB max for GET requests
  if (!sizeValidation.valid) {
    logSecurityEvent(req as any, 'REQUEST_SIZE_EXCEEDED', { size: req.headers.get('content-length') });
    return NextResponse.json(
      { error: 'Request too large', message: sizeValidation.error },
      { status: 413 }
    );
  }

  const url = new URL(req.url);
  
  // Extract and validate query parameters
  const drugName = url.searchParams.get("drug")?.trim();
  const diseaseName = url.searchParams.get("disease")?.trim();

  // Input validation
  if (drugName) {
    const drugValidation = InputValidator.validateString(drugName, 'drug');
    if (!drugValidation.valid) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { field: 'drug', value: drugName, error: drugValidation.error });
      return NextResponse.json(
        { error: 'Invalid input', message: drugValidation.error },
        { status: 400 }
      );
    }

    // Check for SQL injection attempts
    if (detectSQLInjection(drugName)) {
      logSecurityEvent(req as any, 'SQL_INJECTION_ATTEMPT', { field: 'drug', value: drugName });
      return NextResponse.json(
        { error: 'Invalid input', message: 'Suspicious input detected' },
        { status: 400 }
      );
    }
  }

  if (diseaseName) {
    const diseaseValidation = InputValidator.validateString(diseaseName, 'disease');
    if (!diseaseValidation.valid) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { field: 'disease', value: diseaseName, error: diseaseValidation.error });
      return NextResponse.json(
        { error: 'Invalid input', message: diseaseValidation.error },
        { status: 400 }
      );
    }

    // Check for SQL injection attempts
    if (detectSQLInjection(diseaseName)) {
      logSecurityEvent(req as any, 'SQL_INJECTION_ATTEMPT', { field: 'disease', value: diseaseName });
      return NextResponse.json(
        { error: 'Invalid input', message: 'Suspicious input detected' },
        { status: 400 }
      );
    }
  }

  const inputs: QueryInputs = {
    drugName: drugName || undefined,
    diseaseName: diseaseName || undefined,
  };

  try {
    const rows = await queryConceptsMySql(pool, inputs);
    
    // Log successful query
    logSecurityEvent(req as any, 'SUCCESSFUL_QUERY', { 
      drugName: inputs.drugName, 
      diseaseName: inputs.diseaseName,
      resultCount: rows.length 
    });

    const response = NextResponse.json(rows);
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error('Error in concepts API:', error);
    logSecurityEvent(req as any, 'DATABASE_ERROR', { error: error.message });
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to fetch concepts data'
      },
      { status: 500 }
    );
  }
}

// Export with rate limiting
export const GET = withRateLimit(conceptsHandler, searchRateLimiter);
