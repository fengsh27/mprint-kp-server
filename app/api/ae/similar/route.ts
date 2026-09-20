import { NextRequest, NextResponse } from "next/server";
import { queriedAeSimilarDrugs } from "../../../libs/database/query_ae";
import { withRateLimit, searchRateLimiter } from "../../../libs/middleware/rateLimiter";
import { addSecurityHeaders, validateRequestSize, logSecurityEvent } from "../../../libs/middleware/security";
import { clampInt, validateCuiList } from "../../../libs/ae/validate";

// POST { cuis: string[], top_k?: number } -> { results: AeSimilarDrug[] }
// Other drugs ranked by structural (Tanimoto) similarity. An empty list is a
// normal answer: the drug never resolved to a structure, or nothing cleared
// the similarity threshold when the graph was built.
async function similarHandler(req: NextRequest) {
  const requestStartTime = performance.now();
  const sizeValidation = validateRequestSize(req, 1);
  if (!sizeValidation.valid) {
    logSecurityEvent(req, "REQUEST_SIZE_EXCEEDED", { size: req.headers.get("content-length") });
    return NextResponse.json({ error: "Request too large", message: sizeValidation.error }, { status: 413 });
  }

  let body: { cuis?: unknown; top_k?: unknown };
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
  const topK = clampInt(body.top_k, 20, 1, 100);

  try {
    const results = await queriedAeSimilarDrugs(cuis, topK);
    logSecurityEvent(req, "SUCCESSFUL_QUERY", {
      cuiCount: cuis.length,
      resultCount: results.length,
      requestDurationMs: Math.round((performance.now() - requestStartTime) * 100) / 100,
    });
    return addSecurityHeaders(NextResponse.json({ results }));
  } catch (error) {
    console.error("Error in AE similar API:", error);
    logSecurityEvent(req, "DATABASE_ERROR", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal Server Error", message: "Failed to fetch similar drugs" }, { status: 500 });
  }
}

export const POST = withRateLimit(similarHandler, searchRateLimiter);
