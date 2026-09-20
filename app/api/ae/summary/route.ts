import { NextRequest, NextResponse } from "next/server";
import { queriedAeSummary } from "../../../libs/database/query_ae";
import { withRateLimit, searchRateLimiter } from "../../../libs/middleware/rateLimiter";
import { addSecurityHeaders, validateRequestSize, logSecurityEvent } from "../../../libs/middleware/security";
import { validateCuiList } from "../../../libs/ae/validate";

// POST { cuis: string[] } -> AeSummary
// The distinct adverse events found for these drug CUIs in each of the four
// evidence sources, with counts. Feeds the Adverse Events tab's four columns.
async function summaryHandler(req: NextRequest) {
  const requestStartTime = performance.now();
  const sizeValidation = validateRequestSize(req, 1);
  if (!sizeValidation.valid) {
    logSecurityEvent(req, "REQUEST_SIZE_EXCEEDED", { size: req.headers.get("content-length") });
    return NextResponse.json({ error: "Request too large", message: sizeValidation.error }, { status: 413 });
  }

  let body: { cuis?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid input", message: "Request body must be valid JSON" }, { status: 400 });
  }
  const check = validateCuiList(body?.cuis);
  if (!check.valid) {
    logSecurityEvent(req, "INVALID_INPUT", { error: check.error });
    return NextResponse.json({ error: "Invalid input", message: check.error }, { status: 400 });
  }
  const cuis = Array.from(new Set(body.cuis as string[]));

  try {
    const summary = await queriedAeSummary(cuis);
    logSecurityEvent(req, "SUCCESSFUL_QUERY", {
      cuiCount: cuis.length,
      drugNames: summary.drugNames.length,
      requestDurationMs: Math.round((performance.now() - requestStartTime) * 100) / 100,
    });
    return addSecurityHeaders(NextResponse.json(summary));
  } catch (error) {
    console.error("Error in AE summary API:", error);
    logSecurityEvent(req, "DATABASE_ERROR", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal Server Error", message: "Failed to fetch adverse-event summary" }, { status: 500 });
  }
}

export const POST = withRateLimit(summaryHandler, searchRateLimiter);
