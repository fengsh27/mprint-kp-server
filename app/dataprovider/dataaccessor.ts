import { ConceptRow, PmidRow, SearchType } from "../libs/database/types";

export const daGetOverallStudyType = async () => {

  const response = await fetch("/api/static_data/overall_study_type");
  const data = await response.json();
  return data;
};

export const daGetDrugList = async () => {
  const response = await fetch("/api/static_data/druglist");
  const data = await response.json();
  return data;
};

export const daGetDiseaseList = async () => {
  const response = await fetch("/api/static_data/disease");
  const data = await response.json();
  return data;
};

export const daGetConcepts = async (drugName?: string, diseaseName?: string) => {
  const response = await fetch(`/api/concepts?drug=${drugName}&disease=${diseaseName}`);
  const data = await response.json();
  return data;
};

export const daGetExtraData = async (
  conceptIds: ConceptRow[], 
  path: "atc" | "epc" | "pe" | "moa" | "pk" | "label_stats" = "atc"
) => {
  const response = await fetch(`/api/extradata/${path}`, {
    method: "POST",
    body: JSON.stringify(conceptIds),
  });
  const data = await response.json();
  return data;
};

export const daGetPMIDs = async (conceptIds: ConceptRow[], searchType: SearchType) => {
  const response = await fetch("/api/pmid", {
    method: "POST",
    body: JSON.stringify({ conceptIds, searchType }),
  });
  const data = await response.json();
  return data;
};

export const daGetTypePopulation = async (pmids: PmidRow[]) => {
  const response = await fetch("/api/type_population", {
    method: "POST",
    body: JSON.stringify(pmids),
  });
  const data = await response.json();
  return data;
};

export const daGetStudy = async (pmids: PmidRow[]) => {
  const response = await fetch("/api/study", {
    method: "POST",
    body: JSON.stringify(pmids),
  });
  const data = await response.json();
  return data;
};

export const postTest = async () => {
  const response = await fetch("/api/test", {
    method: "POST",
  });
  const data = await response.json();
  return data;
};

