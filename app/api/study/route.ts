// app/api/type_population/route.ts
import { NextResponse } from "next/server";
import { queriedStudy } from "../../libs/database/query_db";
import { StudyResult } from "../../libs/database/types";
import { withRateLimit, searchRateLimiter } from "../../libs/middleware/rateLimiter";
import {
  InputValidator,
  addSecurityHeaders,
  validateRequestSize,
  detectSQLInjection,
  sanitizeInput,
  logSecurityEvent
} from "../../libs/middleware/security";
import { MAX_QUERIED_ARRAY_LENGTH } from "../../libs/constants";

const STUDY_CACHE_TTL_MS = 5 * 60 * 1000;
const STUDY_CACHE_MAX = 50;
const studyCache = new Map<string, { timestamp: number; data: StudyResult[] }>();

function hashPmids(pmids: string[]): string {
  let hash = 5381;
  for (const pmid of pmids) {
    for (let i = 0; i < pmid.length; i += 1) {
      hash = (hash * 33) ^ pmid.charCodeAt(i);
    }
  }
  return `${hash >>> 0}-${pmids.length}`;
}

function getCacheKey(pmids: string[], limit?: number, offset?: number): string {
  return `${hashPmids(pmids)}:${limit ?? "all"}:${offset ?? 0}`;
}

function getCachedStudy(key: string) {
  const cached = studyCache.get(key);
  if (!cached) return undefined;
  if (Date.now() - cached.timestamp > STUDY_CACHE_TTL_MS) {
    studyCache.delete(key);
    return undefined;
  }
  return cached.data;
}

function setCachedStudy(key: string, data: StudyResult[]) {
  studyCache.set(key, { timestamp: Date.now(), data });
  if (studyCache.size > STUDY_CACHE_MAX) {
    const oldestKey = studyCache.keys().next().value;
    if (oldestKey) {
      studyCache.delete(oldestKey);
    }
  }
}

async function studyHandler(req: Request) {
  const requestStartTime = performance.now();

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
    let items: any[] | null = null;
    let limit: number | undefined;
    let offset: number | undefined;

    // Input validation
    if (Array.isArray(body)) {
      items = body;
    } else if (body && Array.isArray(body.pmids)) {
      items = body.pmids;
      if (body.limit !== undefined) limit = Number(body.limit);
      if (body.offset !== undefined) offset = Number(body.offset);
    } else {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Request body must be an array or an object with pmids' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'Request body must be an array or an object with pmids' },
        { status: 400 }
      );
    }

    if (offset !== undefined && limit === undefined) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Offset requires a limit' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'Offset requires a limit' },
        { status: 400 }
      );
    }

    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Invalid limit value' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'Limit must be a positive integer' },
        { status: 400 }
      );
    }

    if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Invalid offset value' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'Offset must be a non-negative integer' },
        { status: 400 }
      );
    }
    if (items === null || items === undefined) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: 'Request body must be an array or an object with pmids' });
      return NextResponse.json(
        { error: 'Invalid input', message: 'Request body must be an array or an object with pmids' },
        { status: 400 }
      );
    }

    const arrayValidation = InputValidator.validateArray(items, 'request body', MAX_QUERIED_ARRAY_LENGTH);
    if (!arrayValidation.valid) {
      logSecurityEvent(req as any, 'INVALID_INPUT', { error: arrayValidation.error });
      return NextResponse.json(
        { error: 'Invalid input', message: arrayValidation.error },
        { status: 400 }
      );
    }

    // Validate each item in the array
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

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
    const pmids = items.map((item: any) => item.pmid);
    const sanitizedPmids = sanitizeInput(pmids);

    const normalizedOffset = offset ?? 0;
    const pagedPmids =
      limit !== undefined ? sanitizedPmids.slice(normalizedOffset, normalizedOffset + limit) : sanitizedPmids;

    const cacheKey = getCacheKey(sanitizedPmids, limit, normalizedOffset);
    const cachedRows = getCachedStudy(cacheKey);
    const rows = cachedRows ?? (await queriedStudy(pagedPmids));
    if (!cachedRows) {
      setCachedStudy(cacheKey, rows);
    }

    const requestEndTime = performance.now();
    const requestDurationMs = requestEndTime - requestStartTime;

    // Log successful query
    logSecurityEvent(req as any, 'SUCCESSFUL_QUERY', {
      pmidCount: pmids.length,
      pageSize: pagedPmids.length,
      resultCount: rows.length,
      requestDurationMs: Math.round(requestDurationMs * 100) / 100
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
