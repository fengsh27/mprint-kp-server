
// data-access.ts
import api from "./access-api";
import { ConceptRow, PmidRow, SearchType, TypeData } from "../libs/database/types";
import { PublicationTableRow } from "../components/component-utils";

/** If you know the response shapes, replace `unknown` with your types. */
export const daGetOverallStudyType = (opts?: { signal?: AbortSignal }) =>
  api.get<unknown>("/api/static_data/overall_study_type", opts);

export const daGetDrugList = (opts?: { signal?: AbortSignal }) =>
  api.get<unknown>("/api/static_data/druglist", opts);

export const daGetDiseaseList = (opts?: { signal?: AbortSignal }) =>
  api.get<unknown>("/api/static_data/disease", opts);

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

export const daGetPMIDs = (conceptIds: ConceptRow[], searchType: SearchType, opts?: { signal?: AbortSignal }) =>
  api.post<unknown>("/api/pmid", { conceptIds, searchType }, opts);

export const daGetTypePopulation = (pmids: PmidRow[], opts?: { signal?: AbortSignal }) =>
  api.post<unknown>("/api/type_population", pmids, opts);

export const daGetStudy = (pmids: PmidRow[], opts?: { signal?: AbortSignal }) =>
  api.post<unknown>("/api/study", pmids, opts);

export const daPostTest = (opts?: { signal?: AbortSignal }) =>
  api.post<unknown>("/api/test", undefined, opts);


