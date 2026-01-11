import { NextResponse } from "next/server";
import { queriedMeshTerms } from "../../libs/database/query_db";
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

async function meshTermsHandler(req: Request) {
  const requestStartTime = performance.now();

  const sizeValidation = validateRequestSize(req as any, 5);
  if (!sizeValidation.valid) {
    logSecurityEvent(req as any, "REQUEST_SIZE_EXCEEDED", { size: req.headers.get("content-length") });
    return NextResponse.json(
      { error: "Request too large", message: sizeValidation.error },
      { status: 413 }
    );
  }

  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : body?.pmids;

    if (!Array.isArray(items)) {
      logSecurityEvent(req as any, "INVALID_INPUT", { error: "Request body must include pmids" });
      return NextResponse.json(
        { error: "Invalid input", message: "Request body must include pmids" },
        { status: 400 }
      );
    }

    const arrayValidation = InputValidator.validateArray(items, "request body", MAX_QUERIED_ARRAY_LENGTH);
    if (!arrayValidation.valid) {
      logSecurityEvent(req as any, "INVALID_INPUT", { error: arrayValidation.error });
      return NextResponse.json(
        { error: "Invalid input", message: arrayValidation.error },
        { status: 400 }
      );
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== "object") {
        logSecurityEvent(req as any, "INVALID_INPUT", { error: `Invalid item at index ${i}` });
        return NextResponse.json(
          { error: "Invalid input", message: `Invalid item at index ${i}` },
          { status: 400 }
        );
      }
      if (!item.pmid || typeof item.pmid !== "string") {
        logSecurityEvent(req as any, "INVALID_INPUT", { error: `Missing or invalid PMID at index ${i}` });
        return NextResponse.json(
          { error: "Invalid input", message: `Missing or invalid PMID at index ${i}` },
          { status: 400 }
        );
      }
      const pmidValidation = InputValidator.validatePMID(item.pmid);
      if (!pmidValidation.valid) {
        logSecurityEvent(req as any, "INVALID_INPUT", {
          error: pmidValidation.error,
          pmid: item.pmid,
          index: i
        });
        return NextResponse.json(
          { error: "Invalid input", message: pmidValidation.error },
          { status: 400 }
        );
      }
      if (detectSQLInjection(item.pmid)) {
        logSecurityEvent(req as any, "SQL_INJECTION_ATTEMPT", { pmid: item.pmid, index: i });
        return NextResponse.json(
          { error: "Invalid input", message: "Suspicious input detected" },
          { status: 400 }
        );
      }
    }

    const pmids = items.map((item: any) => item.pmid);
    const sanitizedPmids = sanitizeInput(pmids);
    const meshTerms = await queriedMeshTerms(sanitizedPmids);

    const requestEndTime = performance.now();
    const requestDurationMs = requestEndTime - requestStartTime;

    logSecurityEvent(req as any, "SUCCESSFUL_QUERY", {
      pmidCount: pmids.length,
      requestDurationMs: Math.round(requestDurationMs * 100) / 100
    });

    const response = NextResponse.json(meshTerms);
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error in mesh terms API:", error);
    logSecurityEvent(req as any, "DATABASE_ERROR", { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to fetch MeSH terms"
      },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(meshTermsHandler, searchRateLimiter);
