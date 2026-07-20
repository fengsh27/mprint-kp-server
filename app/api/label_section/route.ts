import { NextRequest, NextResponse } from "next/server";
import appPool from "../../libs/database/appdb";
import { withRateLimit, searchRateLimiter } from "../../libs/middleware/rateLimiter";
import {
  addSecurityHeaders,
  validateRequestSize,
  logSecurityEvent,
} from "../../libs/middleware/security";
import { getLabelSectionSpec } from "../../libs/dailymed/label-sections";
import {
  fetchLabelSection,
  type SectionStatus,
} from "../../libs/dailymed/extract-section";

// DailyMed set_ids are UUIDs. This is the SSRF guard: `set_id` is the only
// user-controlled value that reaches the DailyMed URL template, so it must
// match a UUID exactly and nothing else can be interpolated.
const SET_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CachedSection {
  status: SectionStatus;
  title: string | null;
  html: string;
}

async function ensureCacheTable() {
  await appPool.execute(`
    CREATE TABLE IF NOT EXISTS cache_label_section (
      cache_key VARCHAR(80) PRIMARY KEY,
      status VARCHAR(32) NOT NULL,
      title VARCHAR(512),
      html LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function fetchCached(cacheKey: string): Promise<CachedSection | undefined> {
  const [rows] = await appPool.execute(
    "SELECT status, title, html FROM cache_label_section WHERE cache_key = ?",
    [cacheKey]
  );
  const row = (rows as any[])[0];
  if (!row) return undefined;
  return { status: row.status, title: row.title ?? null, html: row.html ?? "" };
}

async function storeCached(cacheKey: string, value: CachedSection) {
  await appPool.execute(
    `
    INSERT INTO cache_label_section (cache_key, status, title, html)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE status = VALUES(status), title = VALUES(title), html = VALUES(html)
    `,
    [cacheKey, value.status, value.title, value.html]
  );
}

async function labelSectionHandler(req: NextRequest) {
  const sizeValidation = validateRequestSize(req, 1);
  if (!sizeValidation.valid) {
    logSecurityEvent(req, "REQUEST_SIZE_EXCEEDED", {
      size: req.headers.get("content-length"),
    });
    return NextResponse.json(
      { error: "Request too large", message: sizeValidation.error },
      { status: 413 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const setId = (searchParams.get("set_id") ?? "").trim();
    const flag = (searchParams.get("flag") ?? "").trim();

    if (!SET_ID_RE.test(setId)) {
      logSecurityEvent(req, "INVALID_INPUT", { error: "Invalid set_id", setId });
      return NextResponse.json(
        { error: "Invalid input", message: "set_id must be a DailyMed UUID" },
        { status: 400 }
      );
    }

    const spec = getLabelSectionSpec(flag);
    if (!spec) {
      logSecurityEvent(req, "INVALID_INPUT", { error: "Unknown flag", flag });
      return NextResponse.json(
        { error: "Invalid input", message: "Unknown label section flag" },
        { status: 400 }
      );
    }

    const cacheKey = `${setId}:${spec.loinc}`;

    await ensureCacheTable();
    let result = await fetchCached(cacheKey);
    if (!result) {
      const extracted = await fetchLabelSection(setId, spec);
      result = {
        status: extracted.status,
        title: extracted.title,
        html: extracted.html,
      };
      await storeCached(cacheKey, result);
    }

    logSecurityEvent(req, "SUCCESSFUL_QUERY", {
      setId,
      flag,
      loinc: spec.loinc,
      status: result.status,
    });

    const response = NextResponse.json({
      set_id: setId,
      flag,
      loinc: spec.loinc,
      section_name: spec.displayName,
      status: result.status,
      title: result.title,
      html: result.html,
      source_url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`,
    });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error in label_section API:", error);
    logSecurityEvent(req, "UPSTREAM_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to fetch label section",
      },
      { status: 502 }
    );
  }
}

export const GET = withRateLimit(labelSectionHandler, searchRateLimiter);
