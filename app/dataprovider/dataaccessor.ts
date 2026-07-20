
// data-access.ts
import api from "./access-api";
import { ConceptRow, PmidRow, SearchType, TypeData } from "../libs/database/types";
import { PublicationTableRow } from "../components/component-utils";
import { MAX_SEARCH_WORDS, MAX_SEARCH_WORD_LENGTH } from "../libs/constants";

/** If you know the response shapes, replace `unknown` with your types. */
export const daGetOverallStudyType = (opts?: { signal?: AbortSignal }) =>
  api.get<unknown>("/api/static_data/overall_study_type", opts);

export const daGetDrugList = (opts?: { signal?: AbortSignal }) =>
  api.get<unknown>("/api/static_data/druglist", opts);

export const daGetDiseaseList = (opts?: { signal?: AbortSignal }) =>
  api.get<unknown>("/api/static_data/disease", opts);

export const daGetPopulationData = (opts?: { signal?: AbortSignal }) =>
  api.get<unknown>("/api/static_data/population", opts);

export const daGetConcepts = (
  drugName?: string,
  diseaseName?: string,
  opts?: { signal?: AbortSignal }
) => {
  const params = new URLSearchParams();
  if (drugName) params.set("drug", drugName);
  if (diseaseName) params.set("disease", diseaseName);
  const qs = params.toString();
  const url = `/api/concepts${qs ? `?${qs}` : ""}`;
  return api.get<unknown>(url, opts);
};

export type ExtraPath = "atc" | "epc" | "pe" | "moa" | "pk" | "label_stats";

export const daGetExtraData = (
  conceptIds: ConceptRow[],
  path: ExtraPath = "atc",
  opts?: { signal?: AbortSignal }
) => api.post<unknown>(`/api/extradata/${path}`, conceptIds, opts);

export type LabelSectionResponse = {
  set_id: string;
  flag: string;
  loinc: string;
  section_name: string;
  status: "ok" | "section_not_found" | "label_unavailable";
  title: string | null;
  html: string;
  source_url: string;
};

/** Fetch the FDA label section text (from DailyMed) for a given set_id + flag. */
export const daGetLabelSection = (
  setId: string,
  flag: string,
  opts?: { signal?: AbortSignal }
) => {
  const params = new URLSearchParams({ set_id: setId, flag });
  return api.get<LabelSectionResponse>(`/api/label_section?${params.toString()}`, opts);
};

export const daGetPMIDs = (conceptIds: ConceptRow[], searchType: SearchType, opts?: { signal?: AbortSignal }) =>
  api.post<unknown>("/api/pmid", { conceptIds, searchType }, opts);

export const daGetTypePopulation = (pmids: PmidRow[], opts?: { signal?: AbortSignal }) =>
  api.post<unknown>("/api/type_population", pmids, opts);

export const daGetMeshTerms = (pmids: PmidRow[], opts?: { signal?: AbortSignal }) =>
  api.post<unknown>("/api/mesh_terms", pmids, opts);

export const daGetWordClouds = (
  pmids: PmidRow[],
  searchWords: string[],
  opts?: { signal?: AbortSignal }
) => {
  const safeWords = searchWords
    .filter(w => typeof w === "string" && w.length <= MAX_SEARCH_WORD_LENGTH)
    .slice(0, MAX_SEARCH_WORDS);
  return api.post<unknown>("/api/word_clouds", { pmids, search_words: safeWords }, opts);
};

export type AuthorNetworkOptions = {
  maxNodes?: number;
  maxEdges?: number;
  minEdgeWeight?: number;
};

export const daGetAuthorNetwork = (
  pmids: PmidRow[],
  options?: AuthorNetworkOptions,
  opts?: { signal?: AbortSignal }
) => api.post<unknown>("/api/author_network", { pmids, ...options }, opts);

export type StudyRequestOptions = {
  signal?: AbortSignal;
};

export const daGetStudy = (pmids: PmidRow[], opts?: StudyRequestOptions) => {
  const { signal } = opts ?? {};
  return api.post<unknown>("/api/study", pmids, { signal });
};

export const daGetStudyCount = (pmids: PmidRow[], opts?: { signal?: AbortSignal }) =>
  api.post<unknown>("/api/study/count", pmids, opts);

export type ExportFormat = "xlsx" | "csv" | "tsv";

function getFilenameFromDisposition(disposition: string | null): string | undefined {
  if (!disposition) return undefined;
  const match = disposition.match(/filename="([^"]+)"/);
  return match?.[1];
}

export const daExportStudy = async (
  pmids: PmidRow[],
  format: ExportFormat,
  opts?: { signal?: AbortSignal }
) => {
  const response = await fetch("/api/study/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pmids, format }),
    signal: opts?.signal
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (error) {
      // Ignore non-JSON responses.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename =
    getFilenameFromDisposition(response.headers.get("content-disposition")) ??
    `publication_table.${format}`;
  return { blob, filename };
};

export const daPostTest = (opts?: { signal?: AbortSignal }) =>
  api.post<unknown>("/api/test", undefined, opts);

export const daGetDrugClass = (
  heatmapType: 'drugs' | 'level1' | 'level2' | 'level3' = 'drugs',
  population?: string,
  drugClass?: string,
  opts?: { signal?: AbortSignal }
) => {
  const params = new URLSearchParams();
  params.set("type", heatmapType);
  if (population) params.set("population", population);
  if (drugClass) params.set("drugClass", drugClass);
  const qs = params.toString();
  const url = `/api/drug_class${qs ? `?${qs}` : ""}`;
  return api.get<unknown>(url, opts);
};

export const daGetDrugClassList = (opts?: { signal?: AbortSignal }) =>
  api.get<unknown>("/api/drug_class/list", opts);

export const daGetDrugClassListByLevel = (
  level: 1 | 2 | 3,
  opts?: { signal?: AbortSignal }
) => api.get<unknown>(`/api/drug_class/list/${level}`, opts);
