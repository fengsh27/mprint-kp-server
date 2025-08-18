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
  const [rows] = await pool.execute(sql, [name.trim()]);
  return (rows as any[]).map(r => ({
    cui: String(r.cui),
    type: normalize_concept_type(r.type),
  }));
}

async function fetchDiseaseChildren(pool: Pool, cuis: string[]): Promise<ConceptRow[]> {
  if (!cuis.length) return [];
  // mysql2 expands arrays for IN (?) safely
  const sql = `
    SELECT DISTINCT r.cui2 AS cui
    FROM rel r
    WHERE r.cui1 IN (${placeholders(cuis.length)})
  `;
  const [rows] = await pool.execute(sql, cuis);
  return (rows as any[]).map(r => ({ cui: String(r.cui), type: "disease" as const }));
}

export async function queryConceptsMySql(
  pool: Pool,
  inputs: QueryInputs
): Promise<ConceptRow[]> {
  const { drugName, diseaseName } = inputs;
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
  const [rows] = await pool.execute(sql, cuiList);
  let cleaned: RowDict[];
  if (dropIdCol) {
    cleaned = (rows as RowDict[]).map(r => drop_keys(r, [dropIdCol]));
  } else {
    cleaned = (rows as RowDict[]);
  }
  // dedupe by JSON value after dropping id column (matches R's distinct())
  return dedup_rows(cleaned, r => JSON.stringify(r));
}

export async function queriedAtcMySql(conceptIds: ConceptRow[]): Promise<RowDict[]> {
  const drugCuis = pick_drug_cuis(conceptIds);
  return fetch_by_cui_list(pool, "atc", drugCuis, "atcid");
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
    const [rows] = await pool.execute(sql, [drugCuis, diseaseCuis]);
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
}

export const queriedType = async (pmids: string[]) => {
  if (!pmids || pmids.length === 0) {
    return [];
  }
  const pmidList = pmids;
  const sql = `
    SELECT st.pmid,
        GROUP_CONCAT(DISTINCT st.type SEPARATOR ' / ') AS study_type,
        GROUP_CONCAT(DISTINCT pop.type SEPARATOR ' / ') AS population
    FROM new_study_type st
    LEFT JOIN new_population pop ON st.pmid = pop.pmid
    WHERE st.pmid IN (${placeholders(pmidList.length)})
    GROUP BY st.pmid
  `;
  
  const [rows] = await pool.execute(sql, pmidList);
  return rows as { pmid: string; study_type: string; population: string }[];
};

export async function queriedStudy(pmidList: string[]): Promise<StudyResult[]> {
  if (!pmidList || pmidList.length === 0) {
    return [];
  }

  const batchSize = 1000;
  const results: StudyResult[] = [];

  for (let i = 0; i < pmidList.length; i += batchSize) {
    const batch = pmidList.slice(i, i + batchSize);

    const sql = `
      SELECT
        p.pmid AS PMID,
        MAX(p.title) AS Title,
        p.pubdate AS Year,
        GROUP_CONCAT(DISTINCT pd.text SEPARATOR ' / ') AS \`StudiedDrugs\`,
        GROUP_CONCAT(DISTINCT CASE 
          WHEN pd2.text != 'NA' AND pd2.text IS NOT NULL THEN pd2.text 
        END SEPARATOR ' / ') AS \`StudiedDiseases\`
      FROM new_pubmed_records p
      LEFT JOIN new_pmid2drug pd ON p.pmid = pd.pmid
      LEFT JOIN new_pmid2disease pd2 ON p.pmid = pd2.pmid
      WHERE p.pmid IN (${placeholders(batch.length)})
      GROUP BY p.pmid
    `;

    const [rows] = await pool.execute(sql, batch);
    results.push(...(rows as StudyResult[]));
  }

  return results;
}








