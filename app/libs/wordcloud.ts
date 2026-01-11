export const STOP_WORDS = new Set([
  "Humans",
  "Female",
  "Male",
  "Adult",
  "Middle Aged",
  "Young Adult",
  "Aged",
  "Animals",
  "Surveys and Questionnaires"
]);

const MAX_TERMS = 60;
const MAX_TERM_LENGTH = 40;

export function buildWordCloudList(
  rawTerms: string[],
  excludeKeywords: string[]
): Array<[string, number]> {
  const counts = new Map<string, number>();
  const exclude = excludeKeywords
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);

  rawTerms.forEach((raw) => {
    raw
      .split("|||")
      .map((term) => term.trim())
      .filter(Boolean)
      .forEach((term) => {
        const trimmed =
          term.length > MAX_TERM_LENGTH ? `${term.slice(0, MAX_TERM_LENGTH)}…` : term;
        if (STOP_WORDS.has(term)) {
          return;
        }
        if (exclude.some((badWord) => term.toLowerCase().includes(badWord))) {
          return;
        }
        counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
      });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TERMS);
}
