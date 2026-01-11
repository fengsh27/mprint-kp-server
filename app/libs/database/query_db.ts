import { Pool } from "mysql2/promise";

import pool from "./silverdb";
import {
  RowDict,
  ConceptRow,
  QueryInputs,
  QueriedPmidInput,
  PmidRow,
  SearchType,
  StudyResult,
} from "./types";
import { timeQuery, timeBatchedQuery } from "./query_timer";

const placeholders = (n: number) => Array(n).fill("?").join(",");

function dedup_rows<T>(rows: T[], keyFn: (item: T) => string | number): T[] {
  const seen = new Set<string | number>();
  const out: T[] = [];
  for (const row of rows) {
    const key = keyFn(row);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

function normalize_concept_type(t: unknown): "drug" | "disease" {
  const s = String(t || "").toLowerCase();
  return s === "drug" ? "drug" : "disease";
}

export function drop_keys<T extends Record<string, unknown>>(row: T, keys: string[]): T {
  const copy = { ...row };
  for (const k of keys) delete (copy as any)[k];
  return copy;
}

/** Return all drug CUIs from concept_ids */
function pick_drug_cuis(conceptIds: ConceptRow[]): string[] {
  if (!Array.isArray(conceptIds) || conceptIds.length === 0) return [];
  return conceptIds.filter(c => c.type === "drug").map(c => c.cui);
}

function pick_disease_cuis(conceptIds: ConceptRow[]): string[] {
  if (!Array.isArray(conceptIds) || conceptIds.length === 0) return [];
  return conceptIds.filter(c => c.type === "disease").map(c => c.cui);
}

function has_drug_selected(st: SearchType): boolean {
  return Array.isArray(st) ? st.includes("Drug") : st === "Drug";
}

function has_disease_selected(st: SearchType): boolean {
  return Array.isArray(st) ? st.includes("Disease") : st === "Disease";
}

async function fetchConceptsByName(pool: Pool, name?: string): Promise<ConceptRow[]> {
  if (!name?.trim()) return [];
  const sql = `
    SELECT DISTINCT cui, type
    FROM concept
    WHERE name = ?
  `;
  return timeQuery(
    'fetchConceptsByName',
    async () => {
      const [rows] = await pool.execute(sql, [name.trim()]);
      return (rows as any[]).map(r => ({
        cui: String(r.cui),
        type: normalize_concept_type(r.type),
      }));
    },
    { name: name.trim() }
  );
}

async function fetchDiseaseChildren(pool: Pool, cuis: string[]): Promise<ConceptRow[]> {
  if (!cuis.length) return [];
  // mysql2 expands arrays for IN (?) safely
  const sql = `
    SELECT DISTINCT r.cui2 AS cui
    FROM rel r
    WHERE r.cui1 IN (${placeholders(cuis.length)})
  `;
  return timeQuery(
    'fetchDiseaseChildren',
    async () => {
      const [rows] = await pool.execute(sql, cuis);
      return (rows as any[]).map(r => ({ cui: String(r.cui), type: "disease" as const }));
    },
    { cuiCount: cuis.length }
  );
}

export async function queryConceptsMySql(
  pool: Pool,
  inputs: QueryInputs
): Promise<ConceptRow[]> {
  const { drugName, diseaseName } = inputs;
  return timeQuery(
    'queryConceptsMySql',
    async () => {
      if (diseaseName === undefined && drugName === undefined) {
        return [];
      }
      if (diseaseName === undefined) {
        const concepts = await fetchConceptsByName(pool, drugName);
        if (concepts.length > 0 && concepts.every(c => c.type === "disease")) {
          const children = await fetchDiseaseChildren(pool, concepts.map(c => c.cui));
          return dedup_rows([...concepts, ...children], (c: ConceptRow) => `${c.type}:${c.cui}`);
        }
        return dedup_rows(concepts, (c: ConceptRow) => `${c.type}:${c.cui}`);
      }
      if (drugName === undefined) {
        const concepts = await fetchConceptsByName(pool, diseaseName);
        if (concepts.length > 0 && concepts.every(c => c.type === "disease")) {
          const children = await fetchDiseaseChildren(pool, concepts.map(c => c.cui));
          return dedup_rows([...concepts, ...children], (c: ConceptRow) => `${c.type}:${c.cui}`);
        }
        return dedup_rows(concepts, (c: ConceptRow) => `${c.type}:${c.cui}`);
      }
      const concepts = await fetchConceptsByName(pool, drugName);
      const diseaseConcepts = await fetchConceptsByName(pool, diseaseName);
      const children = await fetchDiseaseChildren(pool, diseaseConcepts.map(c => c.cui));
      return dedup_rows([...concepts, ...diseaseConcepts, ...children], (c: ConceptRow) => `${c.type}:${c.cui}`);
    },
    { drugName, diseaseName }
  );
}

/** Generic: SELECT * FROM <table> WHERE CUI IN (?) ; drop id col; distinct */
async function fetch_by_cui_list(
  pool: Pool,
  table: "atc" | "epc" | "pe" | "moa" | "pk" | "label_stats",
  cuiList: string[],
  dropIdCol?: string,
): Promise<RowDict[]> {
  if (cuiList.length === 0) return [];
  // mysql2 expands arrays for IN (?) safely
  const sql = `SELECT * FROM \`${table}\` WHERE CUI IN (${placeholders(cuiList.length)})`;
  return timeQuery(
    `fetch_by_cui_list_${table}`,
    async () => {
      const [rows] = await pool.execute(sql, cuiList);
      let cleaned: RowDict[];
      if (dropIdCol) {
        cleaned = (rows as RowDict[]).map(r => drop_keys(r, [dropIdCol]));
      } else {
        cleaned = (rows as RowDict[]);
      }
      // dedupe by JSON value after dropping id column (matches R's distinct())
      return dedup_rows(cleaned, r => JSON.stringify(r));
    },
    { table, cuiCount: cuiList.length, dropIdCol }
  );
}

export async function queriedAtcMySql(conceptIds: ConceptRow[]): Promise<RowDict[]> {
  const drugCuis = pick_drug_cuis(conceptIds);
  const rows = await fetch_by_cui_list(pool, "atc", drugCuis, "atcid");
  return dedup_rows(rows, r => `${r.L1}:${r.L2}:${r.L3}:${r.L4}:${r.atc_code}`);
}

export async function queriedEpcMySql(conceptIds: ConceptRow[]): Promise<RowDict[]> {
  const drugCuis = pick_drug_cuis(conceptIds);
  return fetch_by_cui_list(pool, "epc", drugCuis, "epcid");
}

export async function queriedPEMySql(conceptIds: ConceptRow[]): Promise<RowDict[]> {
  const drugCuis = pick_drug_cuis(conceptIds);
  return fetch_by_cui_list(pool, "pe", drugCuis, "peid");
}

export async function queriedMOAMySql(conceptIds: ConceptRow[]): Promise<RowDict[]> {
  const drugCuis = pick_drug_cuis(conceptIds);
  return fetch_by_cui_list(pool, "moa", drugCuis, "moaid");
}

export async function queriedPKMySql(conceptIds: ConceptRow[]): Promise<RowDict[]> {
  const drugCuis = pick_drug_cuis(conceptIds);
  return fetch_by_cui_list(pool, "pk", drugCuis, "pkid");
}

export async function queriedLabelsMySql(conceptIds: ConceptRow[]): Promise<RowDict[]> {
  const drugCuis = pick_drug_cuis(conceptIds);
  return fetch_by_cui_list(pool, "label_stats", drugCuis);
}

export async function queriedPMIDMySql(
  input: QueriedPmidInput
): Promise<PmidRow[]> {
  return timeQuery(
    'queriedPMIDMySql',
    async () => {
      const { conceptIds, searchType } = input;

      if (!Array.isArray(conceptIds) || conceptIds.length === 0) {
        return []; // equivalent to data.frame(pmid = character(0))
      }

      const drugCuis = pick_drug_cuis(conceptIds);
      const diseaseCuis = pick_disease_cuis(conceptIds);

      const drugSelected = has_drug_selected(searchType) && drugCuis.length > 0;
      const diseaseSelected = has_disease_selected(searchType) && diseaseCuis.length > 0;

      // Neither selected (unlikely) → empty
      if (!drugSelected && !diseaseSelected) return [];

      // Build and run the appropriate query
      if (drugSelected && diseaseSelected) {
        // PMIDs that have at least one matching DRUG cui AND at least one matching DISEASE cui.
        // Using INNER JOIN + DISTINCT is equivalent to your LEFT JOIN + HAVING logic.
        const sql = `
          SELECT DISTINCT d.pmid
          FROM new_pmid2drug   AS d
          JOIN new_pmid2disease AS dis
            ON dis.pmid = d.pmid
          WHERE d.cui  IN (${placeholders(drugCuis.length)})
            AND dis.cui IN (${placeholders(diseaseCuis.length)})
        `;
        const [rows] = await pool.execute(sql, [...drugCuis, ...diseaseCuis]);
        return (rows as any[]).map(r => ({ pmid: String(r.pmid) }));
      }

      if (drugSelected) {
        const sql = `
          SELECT DISTINCT pmid
          FROM new_pmid2drug
          WHERE cui IN (${placeholders(drugCuis.length)})
        `;
        const [rows] = await pool.execute(sql, drugCuis);
        return (rows as any[]).map(r => ({ pmid: String(r.pmid) }));
      }

      // diseaseSelected only
      const sql = `
        SELECT DISTINCT pmid
        FROM new_pmid2disease
        WHERE cui IN (${placeholders(diseaseCuis.length)})
      `;
      const [rows] = await pool.execute(sql, diseaseCuis);
      return (rows as any[]).map(r => ({ pmid: String(r.pmid) }));
    },
    {
      conceptCount: input.conceptIds?.length || 0,
      searchType: Array.isArray(input.searchType) ? input.searchType.join(',') : input.searchType,
    }
  );
}

export const queriedType = async (pmids: string[]) => {
  return timeQuery(
    'queriedType',
    async () => {
      if (!pmids || pmids.length === 0) {
        return [];
      }
      const pmidList = pmids;
      const sql = `
        SELECT st.pmid,
            GROUP_CONCAT(DISTINCT st.type SEPARATOR ' / ') AS study_type,
            GROUP_CONCAT(DISTINCT pop.type SEPARATOR ' / ') AS population,
            MAX(m.Score_PK) AS maternal_score_pk,
            MAX(m.Score_PE) AS maternal_score_pe,
            MAX(m.Score_CT) AS maternal_score_ct,
            MAX(p.Score_PK) AS pediatric_score_pk,
            MAX(p.Score_PE) AS pediatric_score_pe,
            MAX(p.Score_CT) AS pediatric_score_ct
        FROM new_study_type st
        LEFT JOIN new_population pop ON st.pmid = pop.pmid
        LEFT JOIN maternal_database_with_scores m ON st.pmid = m.PMID
        LEFT JOIN pediatric_database_with_scores p ON st.pmid = p.PMID
        WHERE st.pmid IN (${placeholders(pmidList.length)})
        AND st.type in ('PK', 'PE', 'CT')
        GROUP BY st.pmid
      `;

      const [rows] = await pool.execute(sql, pmidList);
      return rows as {
        pmid: string;
        study_type: string;
        population: string;
        maternal_score_pk: number | null;
        maternal_score_pe: number | null;
        maternal_score_ct: number | null;
        pediatric_score_pk: number | null;
        pediatric_score_pe: number | null;
        pediatric_score_ct: number | null;
      }[];
    },
    { pmidCount: pmids.length }
  );
};

export const queriedMeshTerms = async (pmids: string[]) => {
  if (!pmids || pmids.length === 0) {
    return { maternal: [], pediatric: [] };
  }

  const batchSize = 1000;
  const fetchMeshTerms = async (table: string) => {
    const results: string[] = [];

    for (let i = 0; i < pmids.length; i += batchSize) {
      const batch = pmids.slice(i, i + batchSize);
      const sql = `
        SELECT MeSH_terms_Descriptor AS descriptor, MeSH_terms_Qualifier AS qualifier
        FROM ${table}
        WHERE PMID IN (${placeholders(batch.length)})
      `;
      const [rows] = await pool.execute(sql, batch);
      (rows as any[]).forEach((row) => {
        if (row.descriptor) results.push(String(row.descriptor));
        if (row.qualifier) results.push(String(row.qualifier));
      });
    }

    return results;
  };

  const [maternal, pediatric] = await Promise.all([
    fetchMeshTerms("maternal_database_with_scores"),
    fetchMeshTerms("pediatric_database_with_scores")
  ]);

  return { maternal, pediatric };
};

export const queriedMeshTermRows = async (pmids: string[]) => {
  if (!pmids || pmids.length === 0) {
    return { maternal: [], pediatric: [] };
  }

  const batchSize = 1000;
  const maternal: { pmid: string; descriptor: string | null; qualifier: string | null }[] = [];
  const pediatric: { pmid: string; descriptor: string | null; qualifier: string | null }[] = [];

  for (let i = 0; i < pmids.length; i += batchSize) {
    const batch = pmids.slice(i, i + batchSize);
    const maternalSql = `
      SELECT PMID AS pmid,
        MeSH_terms_Descriptor AS descriptor,
        MeSH_terms_Qualifier AS qualifier
      FROM maternal_database_with_scores
      WHERE PMID IN (${placeholders(batch.length)})
    `;
    const pediatricSql = `
      SELECT PMID AS pmid,
        MeSH_terms_Descriptor AS descriptor,
        MeSH_terms_Qualifier AS qualifier
      FROM pediatric_database_with_scores
      WHERE PMID IN (${placeholders(batch.length)})
    `;

    const [maternalRows] = await pool.execute(maternalSql, batch);
    const [pediatricRows] = await pool.execute(pediatricSql, batch);

    maternal.push(...(maternalRows as any[]).map((row) => ({
      pmid: String(row.pmid),
      descriptor: row.descriptor ?? null,
      qualifier: row.qualifier ?? null
    })));
    pediatric.push(...(pediatricRows as any[]).map((row) => ({
      pmid: String(row.pmid),
      descriptor: row.descriptor ?? null,
      qualifier: row.qualifier ?? null
    })));
  }

  return { maternal, pediatric };
};

export async function queriedStudyCount(pmidList: string[]): Promise<number> {
  if (!pmidList || pmidList.length === 0) {
    return 0;
  }

  const batchSize = 10000;
  const totalBatches = Math.ceil(pmidList.length / batchSize);
  let totalCount = 0;

  for (let i = 0; i < pmidList.length; i += batchSize) {
    const batch = pmidList.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    const sql = `
      SELECT COUNT(DISTINCT p.pmid) AS count
      FROM new_pubmed_records p
      WHERE p.pmid IN (${placeholders(batch.length)})
    `;

    const count = await timeBatchedQuery(
      'queriedStudyCount',
      async () => {
        const [rows] = await pool.execute(sql, batch);
        return (rows as any[])[0]?.count || 0;
      },
      batchNumber,
      totalBatches,
      batch.length,
      { totalPmidCount: pmidList.length }
    );

    totalCount += Number(count);
  }

  return totalCount;
}

export async function queriedStudy(pmidList: string[]): Promise<StudyResult[]> {
  if (!pmidList || pmidList.length === 0) {
    return [];
  }

  const batchSize = 1000;
  const totalBatches = Math.ceil(pmidList.length / batchSize);
  const results: StudyResult[] = [];

  for (let i = 0; i < pmidList.length; i += batchSize) {
    const batch = pmidList.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    const sql = `
      SELECT
        c.PMID AS PMID,
        c.Title AS Title,
        c.Year AS Year,
        c.StudyType AS StudyType,
        c.Population AS \`Population\`,
        c.StudiedDrugs AS \`StudiedDrugs\`,
        c.StudiedDiseases AS \`StudiedDiseases\`,
        c.maternal_Score_PK AS maternal_score_pk,
        c.maternal_Score_PE AS maternal_score_pe,
        c.maternal_Score_CT AS maternal_score_ct,
        c.pediatric_Score_PK AS pediatric_score_pk,
        c.pediatric_Score_PE AS pediatric_score_pe,
        c.pediatric_Score_CT AS pediatric_score_ct
      FROM cache_full_study c
      WHERE c.PMID IN (${placeholders(batch.length)})
    `;

    const batchResults = await timeBatchedQuery(
      'queriedStudy',
      async () => {
        const [rows] = await pool.execute(sql, batch);
        return rows as StudyResult[];
      },
      batchNumber,
      totalBatches,
      batch.length,
      { totalPmidCount: pmidList.length }
    );

    results.push(...batchResults);
  }

  return results;
}
