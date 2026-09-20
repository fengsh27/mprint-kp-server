import { NextRequest, NextResponse } from "next/server";
import { queriedAeDrugSearch } from "../../../libs/database/query_ae";
import { withRateLimit, searchRateLimiter } from "../../../libs/middleware/rateLimiter";
import { addSecurityHeaders, validateRequestSize, logSecurityEvent, detectSQLInjection } from "../../../libs/middleware/security";
import { clampInt, validateFreeText } from "../../../libs/ae/validate";

const MAX_QUERY_LENGTH = 100;

// GET /api/ae/search?q=<text>&top_k=20 -> { query, results: AeDrugSearchHit[] }
// Typeahead over every drug name in the adverse-event data, including brand
// names, class-level terms and exposures that the portal's own dropdown does
// not list.
async function searchHandler(req: NextRequest) {
  const requestStartTime = performance.now();
  const sizeValidation = validateRequestSize(req, 1);
  if (!sizeValidation.valid) {
    logSecurityEvent(req, "REQUEST_SIZE_EXCEEDED", { size: req.headers.get("content-length") });
    return NextResponse.json({ error: "Request too large", message: sizeValidation.error }, { status: 413 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const check = validateFreeText(q, "q", MAX_QUERY_LENGTH);
  if (!check.valid) {
    logSecurityEvent(req, "INVALID_INPUT", { error: check.error });
    return NextResponse.json({ error: "Invalid input", message: check.error }, { status: 400 });
  }
  if (detectSQLInjection(q)) {
    logSecurityEvent(req, "SQL_INJECTION_ATTEMPT", { q });
    return NextResponse.json({ error: "Invalid input", message: "Suspicious input detected" }, { status: 400 });
  }
  const topK = clampInt(searchParams.get("top_k"), 20, 1, 100);

  try {
    const results = await queriedAeDrugSearch(q, topK);
    logSecurityEvent(req, "SUCCESSFUL_QUERY", {
      q,
      resultCount: results.length,
      requestDurationMs: Math.round((performance.now() - requestStartTime) * 100) / 100,
    });
    return addSecurityHeaders(NextResponse.json({ query: q, results }));
  } catch (error) {
    console.error("Error in AE search API:", error);
    logSecurityEvent(req, "DATABASE_ERROR", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal Server Error", message: "Failed to search drugs" }, { status: 500 });
  }
}

export const GET = withRateLimit(searchHandler, searchRateLimiter);
