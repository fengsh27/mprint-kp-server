import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import appPool from "../../libs/database/appdb";
import { queriedMeshTermRows } from "../../libs/database/query_db";
import { withRateLimit, searchRateLimiter } from "../../libs/middleware/rateLimiter";
import {
  InputValidator,
  addSecurityHeaders,
  validateRequestSize,
  detectSQLInjection,
  sanitizeInput,
  logSecurityEvent
} from "../../libs/middleware/security";
import { MAX_QUERIED_ARRAY_LENGTH, MAX_SEARCH_WORDS, MAX_SEARCH_WORD_LENGTH } from "../../libs/constants";

const execFileAsync = promisify(execFile);

// Only allow letters, numbers, spaces, hyphens, and underscores — no shell metacharacters.
const SAFE_SEARCH_WORD_RE = /^[a-zA-Z0-9\s\-_]+$/;

const THEMES = [
  "blue",
  "dark_blue",
  "orange",
  "green",
  "slate",
  "teal",
  "burgundy",
  "charcoal"
];

type MeshRow = { pmid: string; descriptor: string | null; qualifier: string | null };

const CSV_HEADERS = ["pmid", "MeSH terms (Descriptor)", "MeSH terms (Qualifier)"];

const escapeCsvCell = (value: string) => {
  if (value.includes('"')) {
    value = value.replace(/"/g, '""');
  }
  if (value.search(/("|,|\n)/g) >= 0) {
    return `"${value}"`;
  }
  return value;
};

const buildCsv = (rows: MeshRow[]) => {
  const lines = [CSV_HEADERS.join(",")];
  rows.forEach((row) => {
    const line = [
      escapeCsvCell(row.pmid),
      escapeCsvCell(row.descriptor ?? ""),
      escapeCsvCell(row.qualifier ?? "")
    ];
    lines.push(line.join(","));
  });
  return lines.join("\n");
};

async function ensureCacheTable() {
  await appPool.execute(`
    CREATE TABLE IF NOT EXISTS cache_word_cloud (
      cache_key VARCHAR(255) PRIMARY KEY,
      svg LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function fetchCachedSvg(cacheKey: string) {
  const [rows] = await appPool.execute(
    "SELECT svg FROM cache_word_cloud WHERE cache_key = ?",
    [cacheKey]
  );
  return (rows as any[])[0]?.svg as string | undefined;
}

async function storeCachedSvg(cacheKey: string, svg: string) {
  await appPool.execute(
    `
    INSERT INTO cache_word_cloud (cache_key, svg)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE svg = VALUES(svg)
    `,
    [cacheKey, svg]
  );
}

const pickTheme = () => THEMES[Math.floor(Math.random() * THEMES.length)];

async function generateSvg(
  csvPath: string,
  outputPath: string,
  searchWords: string[],
  theme: string
) {
  const scriptPath = path.join(process.cwd(), "scripts", "word_cloud_generator.py");
  const searchArg = searchWords.join(",");
  await execFileAsync(
    "python",
    [scriptPath, "--csv", csvPath, "--output", outputPath, "--search_words", searchArg, "--theme", theme],
    { timeout: 120000 }
  );
  return readFile(outputPath, "utf-8");
}

async function wordCloudHandler(req: Request) {
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
    const searchWords = Array.isArray(body?.search_words)
      ? body.search_words.filter((item: unknown) => typeof item === "string")
      : [];

    if (searchWords.length > MAX_SEARCH_WORDS) {
      logSecurityEvent(req as any, "INVALID_INPUT", { error: "Too many search words" });
      return NextResponse.json(
        { error: "Invalid input", message: `search_words may not exceed ${MAX_SEARCH_WORDS} items` },
        { status: 400 }
      );
    }
    for (const word of searchWords) {
      if (word.length > MAX_SEARCH_WORD_LENGTH || !SAFE_SEARCH_WORD_RE.test(word)) {
        logSecurityEvent(req as any, "INVALID_INPUT", { error: "Invalid search word characters" });
        return NextResponse.json(
          { error: "Invalid input", message: "Search words may only contain letters, numbers, spaces, hyphens, and underscores" },
          { status: 400 }
        );
      }
    }

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

    // Key the cache on the *content* of the PMID set, not just its size. A study
    // filter can produce different PMID subsets of the same length (e.g. "PK
    // only" vs "PE only"), which would otherwise collide on the old count-based
    // key and serve the wrong cached word cloud. Sorted so set identity — not
    // ordering — drives the key.
    const pmidFingerprint = createHash("sha1")
      .update([...sanitizedPmids].sort().join(","))
      .digest("hex");
    const searchKey = searchWords.join(",");
    const maternalKey = `${searchKey}-${pmidFingerprint}-maternal`;
    const pediatricKey = `${searchKey}-${pmidFingerprint}-pediatric`;

    await ensureCacheTable();

    const [cachedMaternal, cachedPediatric] = await Promise.all([
      fetchCachedSvg(maternalKey),
      fetchCachedSvg(pediatricKey)
    ]);

    if (cachedMaternal && cachedPediatric) {
      const response = NextResponse.json({ maternal: cachedMaternal, pediatric: cachedPediatric });
      return addSecurityHeaders(response);
    }

    const meshRows = await queriedMeshTermRows(sanitizedPmids);
    const tempFolder = process.env.TEMP_FOLDER || "/tmp";
    await mkdir(tempFolder, { recursive: true });
    const runId = randomUUID();
    const maternalCsv = path.join(tempFolder, `${runId}_maternal.csv`);
    const pediatricCsv = path.join(tempFolder, `${runId}_pediatric.csv`);
    const maternalSvg = path.join(tempFolder, `${runId}_maternal.svg`);
    const pediatricSvg = path.join(tempFolder, `${runId}_pediatric.svg`);

    await writeFile(maternalCsv, buildCsv(meshRows.maternal), "utf-8");
    await writeFile(pediatricCsv, buildCsv(meshRows.pediatric), "utf-8");

    const theme = pickTheme();
    const [maternalSvgText, pediatricSvgText] = await Promise.all([
      cachedMaternal
        ? Promise.resolve(cachedMaternal)
        : generateSvg(maternalCsv, maternalSvg, searchWords, theme),
      cachedPediatric
        ? Promise.resolve(cachedPediatric)
        : generateSvg(pediatricCsv, pediatricSvg, searchWords, theme)
    ]);

    await Promise.all([
      rm(maternalCsv, { force: true }),
      rm(pediatricCsv, { force: true }),
      rm(maternalSvg, { force: true }),
      rm(pediatricSvg, { force: true })
    ]);

    await Promise.all([
      cachedMaternal ? Promise.resolve() : storeCachedSvg(maternalKey, maternalSvgText),
      cachedPediatric ? Promise.resolve() : storeCachedSvg(pediatricKey, pediatricSvgText)
    ]);

    const requestEndTime = performance.now();
    const requestDurationMs = requestEndTime - requestStartTime;

    logSecurityEvent(req as any, "SUCCESSFUL_QUERY", {
      pmidCount: pmids.length,
      requestDurationMs: Math.round(requestDurationMs * 100) / 100
    });

    const response = NextResponse.json({ maternal: maternalSvgText, pediatric: pediatricSvgText });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error in word cloud API:", error);
    logSecurityEvent(req as any, "DATABASE_ERROR", { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to generate word clouds"
      },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(wordCloudHandler, searchRateLimiter);
