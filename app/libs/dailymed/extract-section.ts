/**
 * Fetches a DailyMed SPL (Structured Product Labeling) document and extracts a
 * single section's text as safe display HTML, for the Drug tab's
 * "Maternal and Pediatric Use in Labels" click-through (Option B).
 *
 * The `label_stats` table stores only 0/1 flags, not section text, but every
 * row carries a DailyMed `set_id`. Given a set_id and a target LOINC section
 * code (resolved from the clicked flag via ./label-sections), we fetch the SPL
 * XML from the DailyMed v2 REST API and stream-parse it to pull out just that
 * section — including nested subsections (e.g. Teratogenic Effects lives under
 * Pregnancy in classic-format labels).
 *
 * Parsing uses `sax` (streaming) rather than a DOM tree: SPL section bodies are
 * mixed ordered content (paragraphs, lists, tables interleaved), which a
 * streaming pass reproduces in document order far more simply than a tree walk.
 */
import * as sax from "sax";
import { LOINC_CODE_SYSTEM, type LabelSectionSpec } from "./label-sections";

const DAILYMED_SPL_URL = (setId: string) =>
  `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.xml`;

/** Network timeout for the DailyMed fetch. */
const FETCH_TIMEOUT_MS = 10_000;

/** Hard cap on emitted HTML so a pathological label can't blow up the response. */
const MAX_HTML_LENGTH = 250_000;

/** Identify ourselves to DailyMed (good API citizenship). */
const USER_AGENT = "mprint-kp-server (label-section proxy)";

/** SPL body element → the HTML element we render it as. */
const BLOCK_TAGS: Record<string, string> = {
  paragraph: "p",
  list: "ul",
  item: "li",
  table: "table",
  thead: "thead",
  tbody: "tbody",
  tr: "tr",
  caption: "caption",
};

export type SectionStatus =
  /** Section text found and returned. */
  | "ok"
  /** Label fetched, but it has no section with the target LOINC code. */
  | "section_not_found"
  /** DailyMed has no live document for this set_id (withdrawn/superseded/404). */
  | "label_unavailable";

export interface ExtractedSection {
  status: SectionStatus;
  /** The section's own SPL title, when present. */
  title: string | null;
  /** Safe display HTML (whitelisted tags only), or "" when not ok. */
  html: string;
}

/** Escape a decoded text node so it renders as text, never as markup. */
function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Pull the section identified by `loinc` out of an SPL XML string.
 *
 * State machine over the <section> tree:
 *  - 'searching' until we see a <code codeSystem=LOINC code=loinc>, which marks
 *    the enclosing section as the target and records its nesting depth;
 *  - 'inside' captures the section's own <title> once (as the heading), any
 *    nested subsection <title> as an <h4>, and every <text> body, translating
 *    SPL block elements to HTML and escaping raw text;
 *  - 'done' once the target section closes, so capture never bleeds into the
 *    following sibling sections.
 */
export function extractSplSection(xml: string, loinc: string): ExtractedSection {
  const parser = sax.parser(true);

  let depth = 0; // current <section> nesting depth
  let state: "searching" | "inside" | "done" = "searching";
  let startDepth = -1; // section depth at which the target began
  let inText = false; // inside a <text> we are capturing
  const titleParts: string[] = [];
  let capTitle: false | "own" | "sub" = false;
  const parts: string[] = [];
  let truncated = false;

  const push = (s: string) => {
    if (truncated) return;
    parts.push(s);
    if (parts.reduce((n, p) => n + p.length, 0) > MAX_HTML_LENGTH) truncated = true;
  };

  parser.onopentag = (node) => {
    const n = node.name;
    if (n === "section") {
      depth++;
      return;
    }
    if (state === "done") return;

    if (n === "code" && state === "searching") {
      const a = node.attributes;
      if (a.codeSystem === LOINC_CODE_SYSTEM && a.code === loinc) {
        state = "inside";
        startDepth = depth;
      }
      return;
    }
    if (state !== "inside") return;

    if (n === "title") {
      // depth === startDepth → the target section's own heading (captured once);
      // deeper → a subsection heading rendered inline.
      if (depth === startDepth && titleParts.length === 0) {
        capTitle = "own";
      } else {
        push("<h4>");
        capTitle = "sub";
      }
      return;
    }
    if (n === "text") {
      inText = true;
      return;
    }
    if (inText && BLOCK_TAGS[n]) push(`<${BLOCK_TAGS[n]}>`);
    else if (inText && (n === "td" || n === "th")) push("<td>");
    else if (inText && n === "br") push("<br/>");
  };

  parser.ontext = (t) => {
    if (state !== "inside") return;
    if (capTitle === "own") titleParts.push(t);
    else if (capTitle === "sub") push(escapeText(t.replace(/\s+/g, " ")));
    else if (inText) push(escapeText(t.replace(/\s+/g, " ")));
  };

  // CDATA carries literal text; treat it the same as a text node.
  parser.oncdata = (t) => {
    if (state === "inside" && inText) push(escapeText(t));
  };

  parser.onclosetag = (n) => {
    if (state === "inside") {
      if (capTitle && n === "title") {
        if (capTitle === "sub") push("</h4>");
        capTitle = false;
        return;
      }
      if (inText && n === "text") {
        inText = false;
        return;
      }
      if (inText && BLOCK_TAGS[n]) push(`</${BLOCK_TAGS[n]}>`);
      else if (inText && (n === "td" || n === "th")) push("</td>");
    }
    if (n === "section") {
      if (state === "inside" && depth === startDepth) state = "done";
      depth--;
    }
  };

  // Malformed markup shouldn't abort the whole parse; skip and continue.
  parser.onerror = () => {
    parser.resume();
  };

  parser.write(xml).close();

  if (startDepth === -1) {
    return { status: "section_not_found", title: null, html: "" };
  }

  const html = parts
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/(?:<br\/>)+/g, "<br/>")
    .trim();

  const title = titleParts.join("").trim().replace(/\s+/g, " ");

  return {
    status: "ok",
    title: title || null,
    html,
  };
}

/**
 * Fetch a set_id's SPL XML from DailyMed and extract the section for `spec`.
 * Callers are responsible for validating `setId` (UUID) before calling — this
 * only ever interpolates it into the fixed DailyMed URL template.
 */
export async function fetchLabelSection(
  setId: string,
  spec: LabelSectionSpec
): Promise<ExtractedSection> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    // NB: do NOT send `Accept: application/xml` — DailyMed's content negotiation
    // answers that with 406. The `.xml` suffix already selects the format.
    response = await fetch(DAILYMED_SPL_URL(setId), {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
  } finally {
    clearTimeout(timer);
  }

  // 404 means the label was withdrawn/superseded — a normal, expected outcome
  // for older set_ids, not an error to blow up on.
  if (response.status === 404) {
    return { status: "label_unavailable", title: null, html: "" };
  }
  if (!response.ok) {
    throw new Error(`DailyMed returned ${response.status} for set_id ${setId}`);
  }

  const xml = await response.text();
  return extractSplSection(xml, spec.loinc);
}
