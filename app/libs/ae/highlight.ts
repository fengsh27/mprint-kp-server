import type { HighlightSegment } from "./types";

// Marks every case-insensitive, word-bounded occurrence of a drug or AE term in
// a piece of text and returns a segment tree the client renders with one
// component (drug spans blue, AE spans yellow). Port of jiayi-server's
// fda_label_text_index.highlight_fda_content(): longer matches win over shorter
// overlapping ones, and on an equal-length tie a drug match wins over an AE one.

const MAX_TERMS = 200;
const MAX_TERM_LENGTH = 200;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word boundaries only work between \w and \W; a term that starts or ends with
// a non-word character (e.g. "(+)-menthol") gets a lookaround instead so it can
// still match at the edge of a word.
function boundedPattern(term: string): string {
  const escaped = escapeRegExp(term);
  const lead = /^\w/.test(term) ? "\\b" : "(?<!\\w)";
  const trail = /\w$/.test(term) ? "\\b" : "(?!\\w)";
  return `${lead}${escaped}${trail}`;
}

function buildTermRegex(terms: string[]): RegExp | null {
  const cleaned = Array.from(
    new Set(
      terms
        .map((t) => (t || "").trim())
        .filter((t) => t.length > 0 && t.length <= MAX_TERM_LENGTH)
    )
  )
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_TERMS);
  if (cleaned.length === 0) return null;
  return new RegExp(cleaned.map(boundedPattern).join("|"), "gi");
}

type Match = { start: number; end: number; type: "drug" | "ae" };

export function highlightText(
  content: string,
  drugTerms: string[],
  aeTerms: string[]
): HighlightSegment[] {
  if (!content) return [];

  const matches: Match[] = [];
  const drugRe = buildTermRegex(drugTerms);
  const aeRe = buildTermRegex(aeTerms);
  if (drugRe) {
    for (const m of content.matchAll(drugRe)) {
      if (m[0].length > 0) matches.push({ start: m.index!, end: m.index! + m[0].length, type: "drug" });
    }
  }
  if (aeRe) {
    for (const m of content.matchAll(aeRe)) {
      if (m[0].length > 0) matches.push({ start: m.index!, end: m.index! + m[0].length, type: "ae" });
    }
  }
  if (matches.length === 0) return [{ type: "text", text: content }];

  matches.sort(
    (a, b) =>
      a.start - b.start ||
      (b.end - b.start) - (a.end - a.start) ||
      (a.type === "drug" ? 0 : 1) - (b.type === "drug" ? 0 : 1)
  );
  const kept: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start < lastEnd) continue;
    kept.push(m);
    lastEnd = m.end;
  }

  const segments: HighlightSegment[] = [];
  let pos = 0;
  for (const m of kept) {
    if (m.start > pos) segments.push({ type: "text", text: content.slice(pos, m.start) });
    segments.push({ type: m.type, children: [{ type: "text", text: content.slice(m.start, m.end) }] });
    pos = m.end;
  }
  if (pos < content.length) segments.push({ type: "text", text: content.slice(pos) });
  return segments;
}

/** True when at least one segment of the given type exists (used for triage). */
export function hasHighlight(segments: HighlightSegment[], type: "drug" | "ae"): boolean {
  return segments.some((s) => s.type === type || (s.type !== "text" && hasHighlight(s.children, type)));
}
