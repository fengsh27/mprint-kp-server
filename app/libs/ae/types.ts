// Shared shapes for the adverse-event (AE) feature: the "one drug, four
// evidence sources" view built from the jiayi-server data (see
// scripts/create_ae_tables.py for the tables and how they were derived).

export const AE_SOURCES = ["pubmed_human", "pubmed_animal", "fda_human", "fda_animal"] as const;
export type AeSource = (typeof AE_SOURCES)[number];

export function isAeSource(value: unknown): value is AeSource {
  return typeof value === "string" && (AE_SOURCES as readonly string[]).includes(value);
}

/** Highlight tree node: plain text, or a drug / AE span wrapping children. */
export type HighlightSegment =
  | { type: "text"; text: string }
  | { type: "drug" | "ae"; children: HighlightSegment[] };

export type AeCategoryEntry = { adverse_event: string; count: number };

export type AeSummary = {
  /** Portal CUIs the query was made for. */
  cuis: string[];
  /** Jiayi drug names matched (after roll-up), for display and highlighting. */
  drugNames: string[];
  /** Always carries all four keys; an empty list means no evidence in that source. */
  categories: Record<AeSource, AeCategoryEntry[]>;
};

export type AePubmedEvidence = {
  kind: "pubmed";
  pmid: string;
  title: string | null;
  drug_name: string;
  adverse_event: string;
  population: string | null;
  species: string | null;
  dosage: string | null;
  finding_type: string | null;
  confidence: string | null;
  reasoning: string | null;
  segments: HighlightSegment[];
};

export type AeLabelEvidence = {
  kind: "label";
  drug_name: string;
  adverse_event: string;
  section: string;
  population: string | null;
  species: string | null;
  age_range: string | null;
  dosage: string | null;
  meddra_term: string | null;
  meddra_soc: string | null;
  /** One highlight tree per label-text excerpt; can be empty when no text was found. */
  excerpts: HighlightSegment[][];
};

export type AeEvidenceItem = AePubmedEvidence | AeLabelEvidence;

export type AeEvidenceResponse = {
  source: AeSource;
  adverse_event: string;
  total: number;
  offset: number;
  results: AeEvidenceItem[];
};

export type AeDrugSearchHit = {
  term: string;
  cui: string;
  name: string;
  score: number;
  counts: Record<AeSource, number>;
};

export type AeSimilarDrug = {
  name: string;
  cui: string | null;
  similarity: number;
};
