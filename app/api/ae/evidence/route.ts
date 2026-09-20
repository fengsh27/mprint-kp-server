import { NextRequest, NextResponse } from "next/server";
import { queriedAeEvidence } from "../../../libs/database/query_ae";
import { withRateLimit, searchRateLimiter } from "../../../libs/middleware/rateLimiter";
import { addSecurityHeaders, validateRequestSize, logSecurityEvent } from "../../../libs/middleware/security";
import { clampInt, validateCuiList, validateFreeText } from "../../../libs/ae/validate";
import { isAeSource } from "../../../libs/ae/types";

// POST { cuis, source, adverse_event, limit?, offset? } -> AeEvidenceResponse
// The click-through behind one adverse event in one source: highlighted
// abstracts for the PubMed sources, structured label records plus highlighted
// label-text excerpts for the FDA sources. Paged with limit / offset.
async function evidenceHandler(req: NextRequest) {
  const requestStartTime = performance.now();
  const sizeValidation = validateRequestSize(req, 1);
  if (!sizeValidation.valid) {
    logSecurityEvent(req, "REQUEST_SIZE_EXCEEDED", { size: req.headers.get("content-length") });
    return NextResponse.json({ error: "Request too large", message: sizeValidation.error }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid input", message: "Request body must be valid JSON" }, { status: 400 });
  }
  const cuiCheck = validateCuiList(body?.cuis);
  if (!cuiCheck.valid) {
    logSecurityEvent(req, "INVALID_INPUT", { error: cuiCheck.error });
    return NextResponse.json({ error: "Invalid input", message: cuiCheck.error }, { status: 400 });
  }
  if (!isAeSource(body?.source)) {
    logSecurityEvent(req, "INVALID_INPUT", { error: "Invalid source", source: body?.source });
    return NextResponse.json(
      { error: "Invalid input", message: "source must be one of pubmed_human, pubmed_animal, fda_human, fda_animal" },
      { status: 400 }
    );
  }
  const aeCheck = validateFreeText(body?.adverse_event, "adverse_event");
  if (!aeCheck.valid) {
    logSecurityEvent(req, "INVALID_INPUT", { error: aeCheck.error });
    return NextResponse.json({ error: "Invalid input", message: aeCheck.error }, { status: 400 });
  }

  const cuis = Array.from(new Set(body.cuis as string[]));
  const source = body.source;
  const adverseEvent = (body.adverse_event as string).trim();
  const limit = clampInt(body.limit, 20, 1, 100);
  const offset = clampInt(body.offset, 0, 0, 1_000_000);

  try {
    const result = await queriedAeEvidence(cuis, source, adverseEvent, limit, offset);
    logSecurityEvent(req, "SUCCESSFUL_QUERY", {
      cuiCount: cuis.length,
      source,
      total: result.total,
      returned: result.results.length,
      requestDurationMs: Math.round((performance.now() - requestStartTime) * 100) / 100,
    });
    return addSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    console.error("Error in AE evidence API:", error);
    logSecurityEvent(req, "DATABASE_ERROR", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal Server Error", message: "Failed to fetch adverse-event evidence" }, { status: 500 });
  }
}

export const POST = withRateLimit(evidenceHandler, searchRateLimiter);
