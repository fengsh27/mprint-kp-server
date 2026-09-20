import appPool from "./appdb";
import { timeQuery } from "./query_timer";
import { highlightText } from "../ae/highlight";
import {
  AE_SOURCES,
  type AeCategoryEntry,
  type AeDrugSearchHit,
  type AeEvidenceItem,
  type AeEvidenceResponse,
  type AeSimilarDrug,
  type AeSource,
  type AeSummary,
} from "../ae/types";

// Queries for the adverse-event tables in the app database (kb_app), built by
// scripts/create_ae_tables.py. All lookups go through ae_cui_map so a portal
// CUI (ingredient level) also reaches jiayi rows coded to a salt form or a
// combination product.

const placeholders = (n: number) => Array(n).fill("?").join(",");

const SOURCE_TABLE: Record<AeSource, { table: "ae_pubmed_finding" | "ae_label_finding"; corpus: "human" | "animal" }> = {
  pubmed_human: { table: "ae_pubmed_finding", corpus: "human" },
  pubmed_animal: { table: "ae_pubmed_finding", corpus: "animal" },
  fda_human: { table: "ae_label_finding", corpus: "human" },
  fda_animal: { table: "ae_label_finding", corpus: "animal" },
};

/** Portal CUIs -> jiayi CUIs (self rows plus roll-ups). */
async function resolveJiayiCuis(cuis: string[]): Promise<string[]> {
  if (cuis.length === 0) return [];
  const [rows] = await appPool.execute(
    `SELECT DISTINCT cui FROM ae_cui_map WHERE match_cui IN (${placeholders(cuis.length)})`,
    cuis
  );
  return (rows as { cui: string }[]).map((r) => r.cui);
}

/** All names known for a set of jiayi CUIs, for highlighting. */
async function drugTermsFor(jiayiCuis: string[]): Promise<string[]> {
  if (jiayiCuis.length === 0) return [];
  const [rows] = await appPool.execute(
    `SELECT DISTINCT term FROM ae_drug_term WHERE cui IN (${placeholders(jiayiCuis.length)})`,
    jiayiCuis
  );
  return (rows as { term: string }[]).map((r) => r.term);
}

async function drugNamesFor(jiayiCuis: string[]): Promise<string[]> {
  if (jiayiCuis.length === 0) return [];
  const [rows] = await appPool.execute(
    `SELECT name FROM ae_drug WHERE cui IN (${placeholders(jiayiCuis.length)})
     ORDER BY (n_pubmed_human + n_pubmed_animal + n_fda_human + n_fda_animal) DESC`,
    jiayiCuis
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows as { name: string }[]) {
    const key = r.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r.name);
    }
  }
  return out;
}

async function categoryFor(source: AeSource, jiayiCuis: string[]): Promise<AeCategoryEntry[]> {
  if (jiayiCuis.length === 0) return [];
  const { table, corpus } = SOURCE_TABLE[source];
  const sql = `
    SELECT adverse_event, COUNT(DISTINCT id) AS count
    FROM ${table}
    WHERE cui IN (${placeholders(jiayiCuis.length)}) AND corpus = ? AND adverse_event <> ''
    GROUP BY adverse_event
    ORDER BY count DESC, adverse_event
  `;
  const [rows] = await appPool.execute(sql, [...jiayiCuis, corpus]);
  return (rows as { adverse_event: string; count: number }[]).map((r) => ({
    adverse_event: r.adverse_event,
    count: Number(r.count),
  }));
}

export async function queriedAeSummary(cuis: string[]): Promise<AeSummary> {
  return timeQuery(
    "queriedAeSummary",
    async () => {
      const jiayiCuis = await resolveJiayiCuis(cuis);
      const [drugNames, ...cats] = await Promise.all([
        drugNamesFor(jiayiCuis),
        ...AE_SOURCES.map((s) => categoryFor(s, jiayiCuis)),
      ]);
      const categories = Object.fromEntries(AE_SOURCES.map((s, i) => [s, cats[i]])) as Record<
        AeSource,
        AeCategoryEntry[]
      >;
      return { cuis, drugNames, categories };
    },
    { cuiCount: cuis.length }
  );
}

const joinDosage = (value: string | null, unit: string | null) =>
  [value, unit].filter((x) => x && String(x).trim()).join(" ") || null;

type PubmedRow = {
  id: number; pmid: string; drug_name: string; adverse_event: string; population: string | null;
  species: string | null; dosage_value: string | null; dosage_unit: string | null; finding_type: string | null;
  confidence: string | null; reasoning: string | null; title: string | null; abstract: string | null;
};

type LabelRow = {
  id: number; drug_name: string; adverse_event: string; normalized_ae: string | null; population: string | null;
  species: string | null; age_range: string | null; dosage_value: string | null; dosage_unit: string | null;
  section: string; meddra_pt_name: string | null; meddra_soc_name: string | null;
};

export async function queriedAeEvidence(
  cuis: string[],
  source: AeSource,
  adverseEvent: string,
  limit: number,
  offset: number
): Promise<AeEvidenceResponse> {
  return timeQuery(
    "queriedAeEvidence",
    async () => {
      const jiayiCuis = await resolveJiayiCuis(cuis);
      const empty: AeEvidenceResponse = { source, adverse_event: adverseEvent, total: 0, offset, results: [] };
      if (jiayiCuis.length === 0) return empty;

      const { table, corpus } = SOURCE_TABLE[source];
      const inList = placeholders(jiayiCuis.length);
      // LIMIT/OFFSET are validated integers; mysql2's prepared statements do not
      // accept them as bound parameters reliably, so they are inlined.
      const lim = Math.max(1, Math.min(100, Math.floor(limit)));
      const off = Math.max(0, Math.floor(offset));
      const drugTerms = await drugTermsFor(jiayiCuis);

      if (table === "ae_pubmed_finding") {
        const where = `f.cui IN (${inList}) AND f.corpus = ? AND f.adverse_event = ?`;
        const params = [...jiayiCuis, corpus, adverseEvent];
        const [countRows] = await appPool.execute(
          `SELECT COUNT(DISTINCT f.id) AS total FROM ae_pubmed_finding f WHERE ${where}`,
          params
        );
        const total = Number((countRows as { total: number }[])[0]?.total ?? 0);
        if (total === 0) return empty;
        const [rows] = await appPool.execute(
          `SELECT f.id, f.pmid, f.drug_name, f.adverse_event, f.population, f.species, f.dosage_value,
                  f.dosage_unit, f.finding_type, f.confidence, f.reasoning, a.title, a.abstract
           FROM ae_pubmed_finding f
           LEFT JOIN ae_abstract a ON a.pmid = f.pmid AND a.corpus = f.corpus
           WHERE ${where}
           GROUP BY f.id
           ORDER BY f.pmid DESC, f.id
           LIMIT ${lim} OFFSET ${off}`,
          params
        );
        const results: AeEvidenceItem[] = (rows as PubmedRow[]).map((r) => ({
          kind: "pubmed",
          pmid: r.pmid,
          title: r.title,
          drug_name: r.drug_name,
          adverse_event: r.adverse_event,
          population: r.population,
          species: r.species,
          dosage: joinDosage(r.dosage_value, r.dosage_unit),
          finding_type: r.finding_type,
          confidence: r.confidence,
          reasoning: r.reasoning,
          segments: highlightText(r.abstract ?? "", [...drugTerms, r.drug_name], [adverseEvent, r.adverse_event]),
        }));
        return { source, adverse_event: adverseEvent, total, offset: off, results };
      }

      const where = `f.cui IN (${inList}) AND f.corpus = ? AND (f.adverse_event = ? OR f.normalized_ae = ?)`;
      const params = [...jiayiCuis, corpus, adverseEvent, adverseEvent];
      const [countRows] = await appPool.execute(
        `SELECT COUNT(DISTINCT f.id) AS total FROM ae_label_finding f WHERE ${where}`,
        params
      );
      const total = Number((countRows as { total: number }[])[0]?.total ?? 0);
      if (total === 0) return empty;
      const [rows] = await appPool.execute(
        `SELECT f.id, f.drug_name, f.adverse_event, f.normalized_ae, f.population, f.species, f.age_range,
                f.dosage_value, f.dosage_unit, f.section, f.meddra_pt_name, f.meddra_soc_name
         FROM ae_label_finding f
         WHERE ${where}
         GROUP BY f.id
         ORDER BY f.section, f.id
         LIMIT ${lim} OFFSET ${off}`,
        params
      );
      const labelRows = rows as LabelRow[];

      // Label text is keyed by upper-cased drug name + section (see the ETL);
      // fetch each distinct pair once for this page.
      const pairs = new Map<string, { key: string; section: string }>();
      for (const r of labelRows) {
        const key = r.drug_name.trim().toUpperCase();
        pairs.set(`${key}\u0000${r.section}`, { key, section: r.section });
      }
      const textByPair = new Map<string, string[]>();
      await Promise.all(
        Array.from(pairs.entries()).map(async ([id, { key, section }]) => {
          const [t] = await appPool.execute(
            `SELECT content FROM ae_label_text WHERE drug_key = ? AND section = ? ORDER BY seq`,
            [key, section]
          );
          textByPair.set(id, (t as { content: string }[]).map((x) => x.content));
        })
      );

      const results: AeEvidenceItem[] = labelRows.map((r) => {
        const aeTerms = [adverseEvent, r.adverse_event, r.normalized_ae ?? "", r.meddra_pt_name ?? ""];
        const blocks = textByPair.get(`${r.drug_name.trim().toUpperCase()}\u0000${r.section}`) ?? [];
        return {
          kind: "label",
          drug_name: r.drug_name,
          adverse_event: r.adverse_event,
          section: r.section,
          population: r.population,
          species: r.species,
          age_range: r.age_range,
          dosage: joinDosage(r.dosage_value, r.dosage_unit),
          meddra_term: r.meddra_pt_name,
          meddra_soc: r.meddra_soc_name,
          excerpts: blocks.map((b) => highlightText(b, [...drugTerms, r.drug_name], aeTerms)),
        };
      });
      return { source, adverse_event: adverseEvent, total, offset: off, results };
    },
    { cuiCount: cuis.length, source, adverseEvent }
  );
}

type SearchRow = {
  term: string; cui: string; name: string;
  n_pubmed_human: number; n_pubmed_animal: number; n_fda_human: number; n_fda_animal: number;
};

/**
 * Typeahead over every name jiayi knows (raw extracted strings, RxNorm brands
 * and ingredients). Prefix matches rank first, then FULLTEXT matches; one row
 * per CUI, keeping the best-matching term.
 */
export async function queriedAeDrugSearch(query: string, topK: number): Promise<AeDrugSearchHit[]> {
  return timeQuery(
    "queriedAeDrugSearch",
    async () => {
      const q = query.trim();
      if (!q) return [];
      const k = Math.max(1, Math.min(100, Math.floor(topK)));
      const select = `
        SELECT t.term, t.cui, d.name, d.n_pubmed_human, d.n_pubmed_animal, d.n_fda_human, d.n_fda_animal
        FROM ae_drug_term t JOIN ae_drug d ON d.cui = t.cui`;
      const [prefixRows] = await appPool.execute(
        `${select} WHERE t.term LIKE CONCAT(?, '%') ORDER BY CHAR_LENGTH(t.term), t.term LIMIT ${k * 3}`,
        [q]
      );
      // Boolean-mode prefix search on each word; only useful for queries with a
      // few letters, so skip for very short input.
      let ftRows: SearchRow[] = [];
      if (q.length >= 3) {
        const booleanQuery = q
          .split(/\s+/)
          .map((w) => w.replace(/[+\-<>()~*"@]/g, ""))
          .filter((w) => w.length >= 2)
          .map((w) => `+${w}*`)
          .join(" ");
        if (booleanQuery) {
          const [rows] = await appPool.execute(
            `${select} WHERE MATCH(t.term) AGAINST (? IN BOOLEAN MODE) ORDER BY CHAR_LENGTH(t.term) LIMIT ${k * 3}`,
            [booleanQuery]
          );
          ftRows = rows as SearchRow[];
        }
      }

      const ql = q.toLowerCase();
      const best = new Map<string, AeDrugSearchHit>();
      const consider = (r: SearchRow, score: number) => {
        const prev = best.get(r.cui);
        if (prev && prev.score >= score) return;
        best.set(r.cui, {
          term: r.term,
          cui: r.cui,
          name: r.name,
          score,
          counts: {
            pubmed_human: Number(r.n_pubmed_human),
            pubmed_animal: Number(r.n_pubmed_animal),
            fda_human: Number(r.n_fda_human),
            fda_animal: Number(r.n_fda_animal),
          },
        });
      };
      for (const r of prefixRows as SearchRow[]) {
        // 95-100 band, nudged down for longer terms so "Tylenol" beats "Tylenol PM".
        consider(r, 100 - Math.min(r.term.length - q.length, 50) * 0.1);
      }
      for (const r of ftRows) {
        if (r.term.toLowerCase().startsWith(ql)) continue;
        consider(r, 60 - Math.min(r.term.length, 50) * 0.1);
      }
      return Array.from(best.values())
        .sort((a, b) => b.score - a.score || a.term.length - b.term.length || a.term.localeCompare(b.term))
        .slice(0, k);
    },
    { query, topK }
  );
}

type SimRow = { drug_a: string; drug_b: string; cui_a: string | null; cui_b: string | null; tanimoto: number };

/** Structurally similar drugs (Tanimoto) for a set of portal CUIs, best first. */
export async function queriedAeSimilarDrugs(cuis: string[], topK: number): Promise<AeSimilarDrug[]> {
  return timeQuery(
    "queriedAeSimilarDrugs",
    async () => {
      const jiayiCuis = await resolveJiayiCuis(cuis);
      if (jiayiCuis.length === 0) return [];
      const k = Math.max(1, Math.min(100, Math.floor(topK)));
      const inList = placeholders(jiayiCuis.length);
      const [rows] = await appPool.execute(
        `SELECT drug_a, drug_b, cui_a, cui_b, tanimoto FROM ae_drug_similarity
         WHERE cui_a IN (${inList}) OR cui_b IN (${inList})
         ORDER BY tanimoto DESC LIMIT ${k * 4}`,
        [...jiayiCuis, ...jiayiCuis]
      );
      const own = new Set(jiayiCuis);
      const seen = new Set<string>();
      const out: AeSimilarDrug[] = [];
      for (const r of rows as SimRow[]) {
        const aIsOwn = r.cui_a !== null && own.has(r.cui_a);
        const other = aIsOwn ? { name: r.drug_b, cui: r.cui_b } : { name: r.drug_a, cui: r.cui_a };
        if (other.cui && own.has(other.cui)) continue; // an alias of the same drug
        const key = other.cui ?? other.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: other.name, cui: other.cui, similarity: Math.round(Number(r.tanimoto) * 1000) / 1000 });
        if (out.length >= k) break;
      }
      return out;
    },
    { cuiCount: cuis.length, topK }
  );
}
