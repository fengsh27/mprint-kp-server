/**
 * Flag → DailyMed SPL section (LOINC) mapping for the Drug tab's
 * "Maternal and Pediatric Use in Labels" grid.
 *
 * Each column in `label_stats` is a 0/1 flag meaning "this label has a section
 * of this kind". The section *text* is not stored in our database — only the
 * flag. To show the text (Option B: fetch it at runtime from DailyMed), we map
 * each flag to the LOINC section code used in the source SPL document, then
 * pull that section out of the SPL XML for the row's `set_id`.
 *
 * Why a 1:1 map with no fallbacks: a flag is only set when its specific section
 * is present, and only *checked* cells are clickable, so a click always targets
 * a section that exists in that label. FDA labels come in three era/format
 * flavors (classic prescription, PLLR prescription, OTC Drug Facts); the flags
 * span all three, but each individual flag corresponds to exactly one LOINC.
 *
 * Every code below was verified empirically against real DailyMed SPL documents
 * whose corresponding flag was set (via the v2 API,
 * https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/{setId}.xml), not from
 * memory. Reference labels used:
 *   - Fluconazole  afde17e7-b95b-4cd5-97eb-e361724014bd (classic Rx)
 *   - Clonazepam   d732be07-6eb7-48f2-b6cd-28baad46aca5 (classic Rx)
 *   - Ceftriaxone  5116231f-82d1-44be-b08e-560c9a50e5c5 (nonteratogenic)
 *   - Nicotine     4e0d57ea-749f-48ff-b6f1-3cbd0963d11e (OTC Drug Facts)
 *
 * Known coverage gap (NOT a mapping bug): PLLR labels replace "Nursing Mothers"
 * (34080-2) with a "Lactation" section (77290-5). The ETL that built
 * `label_stats` mapped `nursing_mothers` to 34080-2 only, so PLLR Lactation
 * content is not represented by any flag and therefore never shown here. If
 * surfacing Lactation is wanted, it needs a new flag/column upstream, not a
 * change to this map.
 */

/** LOINC code system OID, as it appears in SPL `<code codeSystem="…">`. */
export const LOINC_CODE_SYSTEM = "2.16.840.1.113883.6.1";

/** The `label_stats` flag columns that this feature makes clickable. */
export type LabelSectionFlag =
  | "pregnancy"
  | "pediatric_use"
  | "nursing_mothers"
  | "labor_and_delivery"
  | "teratogenic_effects"
  | "nonteratogenic_effects"
  | "carcinogenesis_and_mutagenesis_and_impairment_of_fertility"
  | "pregnancy_or_breast_feeding";

export type LabelFormat = "rx" | "otc";

export interface LabelSectionSpec {
  /** LOINC code of the SPL section this flag corresponds to. */
  loinc: string;
  /** Human-readable section name for the drawer heading. */
  displayName: string;
  /** Which label format this section belongs to. */
  format: LabelFormat;
  /**
   * In classic-Rx SPL, Teratogenic / Nonteratogenic Effects are nested
   * subsections under the Pregnancy section rather than top-level components.
   * The extractor should therefore search the section tree recursively, and the
   * UI may want to show the parent for context.
   */
  parentLoinc?: string;
}

/**
 * The mapping itself. Keyed by the exact `label_stats` column name so callers
 * can look up straight from the clicked column key.
 */
export const LABEL_SECTION_MAP: Record<LabelSectionFlag, LabelSectionSpec> = {
  pregnancy: {
    loinc: "42228-7",
    displayName: "Pregnancy",
    format: "rx",
  },
  pediatric_use: {
    loinc: "34081-0",
    displayName: "Pediatric Use",
    format: "rx",
  },
  nursing_mothers: {
    loinc: "34080-2",
    displayName: "Nursing Mothers",
    format: "rx",
  },
  labor_and_delivery: {
    loinc: "34079-4",
    displayName: "Labor & Delivery",
    format: "rx",
  },
  teratogenic_effects: {
    loinc: "34077-8",
    displayName: "Teratogenic Effects",
    format: "rx",
    parentLoinc: "42228-7",
  },
  nonteratogenic_effects: {
    loinc: "34078-6",
    displayName: "Nonteratogenic Effects",
    format: "rx",
    parentLoinc: "42228-7",
  },
  carcinogenesis_and_mutagenesis_and_impairment_of_fertility: {
    loinc: "34083-6",
    displayName: "Carcinogenesis, Mutagenesis & Impairment of Fertility",
    format: "rx",
  },
  pregnancy_or_breast_feeding: {
    loinc: "53414-9",
    displayName: "Pregnancy or Breast Feeding (OTC)",
    format: "otc",
  },
};

/** Type guard: is this string one of the clickable label-section flags? */
export function isLabelSectionFlag(key: string): key is LabelSectionFlag {
  return Object.prototype.hasOwnProperty.call(LABEL_SECTION_MAP, key);
}

/** Resolve a flag column name to its SPL section spec, or undefined. */
export function getLabelSectionSpec(
  key: string
): LabelSectionSpec | undefined {
  return isLabelSectionFlag(key) ? LABEL_SECTION_MAP[key] : undefined;
}
