import { NextResponse } from "next/server";
import { queriedAuthorRows } from "../../libs/database/query_db";
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

type AuthorNode = { id: string; size: number };
type AuthorLink = { source: string; target: string; weight: number };
type AuthorSummary = {
  author: string;
  paperCount: number;
  pmids: string[];
  affiliations: string[];
};

const DEFAULT_MAX_NODES = 200;
const DEFAULT_MAX_EDGES = 3000;
const DEFAULT_MIN_EDGE_WEIGHT = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildNetwork(
  rows: { pmid: string; author: string }[],
  maxNodes: number,
  maxEdges: number,
  minEdgeWeight: number
): { nodes: AuthorNode[]; links: AuthorLink[] } {
  const pmidToAuthors = new Map<string, Set<string>>();

  for (const row of rows) {
    const author = row.author?.trim();
    if (!author) continue;
    const set = pmidToAuthors.get(row.pmid) ?? new Set<string>();
    set.add(author);
    pmidToAuthors.set(row.pmid, set);
  }

  const authorCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();

  for (const authorsSet of pmidToAuthors.values()) {
    const authors = Array.from(authorsSet);
    for (const author of authors) {
      authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
    }
    for (let i = 0; i < authors.length; i += 1) {
      for (let j = i + 1; j < authors.length; j += 1) {
        const a = authors[i];
        const b = authors[j];
        const key = a < b ? `${a}|||${b}` : `${b}|||${a}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const nodes = Array.from(authorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxNodes)
    .map(([id, size]) => ({ id, size }));

  const nodeSet = new Set(nodes.map((node) => node.id));
  const links: AuthorLink[] = [];

  for (const [key, weight] of pairCounts.entries()) {
    if (weight < minEdgeWeight) continue;
    const [source, target] = key.split("|||");
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue;
    links.push({ source, target, weight });
  }

  links.sort((a, b) => b.weight - a.weight);
  if (links.length > maxEdges) {
    links.length = maxEdges;
  }

  return { nodes, links };
}

function buildAuthorSummaries(rows: { pmid: string; author: string; affiliation?: string | null }[]): AuthorSummary[] {
  const summaries = new Map<string, { pmids: Set<string>; affiliations: Set<string> }>();
  for (const row of rows) {
    const author = row.author?.trim();
    if (!author) continue;
    const entry = summaries.get(author) ?? { pmids: new Set<string>(), affiliations: new Set<string>() };
    if (row.pmid) entry.pmids.add(String(row.pmid));
    if (row.affiliation) {
      const aff = String(row.affiliation).trim();
      if (aff) entry.affiliations.add(aff);
    }
    summaries.set(author, entry);
  }

  return Array.from(summaries.entries())
    .map(([author, info]) => ({
      author,
      paperCount: info.pmids.size,
      pmids: Array.from(info.pmids),
      affiliations: Array.from(info.affiliations)
    }))
    .sort((a, b) => b.paperCount - a.paperCount);
}

async function authorNetworkHandler(req: Request) {
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

    for (let i = 0; i < items.length; i += 1) {
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

    const maxNodes = clamp(Number(body?.maxNodes ?? DEFAULT_MAX_NODES), 25, 500);
    const maxEdges = clamp(Number(body?.maxEdges ?? DEFAULT_MAX_EDGES), 50, 10000);
    const minEdgeWeight = clamp(Number(body?.minEdgeWeight ?? DEFAULT_MIN_EDGE_WEIGHT), 1, 50);

    const authorRows = await queriedAuthorRows(sanitizedPmids);
    const network = buildNetwork(authorRows, maxNodes, maxEdges, minEdgeWeight);
    const authorSummaries = buildAuthorSummaries(authorRows);

    const requestEndTime = performance.now();
    const requestDurationMs = requestEndTime - requestStartTime;

    logSecurityEvent(req as any, "SUCCESSFUL_QUERY", {
      pmidCount: pmids.length,
      nodeCount: network.nodes.length,
      edgeCount: network.links.length,
      requestDurationMs: Math.round(requestDurationMs * 100) / 100
    });

    const response = NextResponse.json({ ...network, authors: authorSummaries });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error in author network API:", error);
    logSecurityEvent(req as any, "DATABASE_ERROR", { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to build author network"
      },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(authorNetworkHandler, searchRateLimiter);
