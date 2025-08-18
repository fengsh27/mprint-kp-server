export type SearchMode = "simple" | "advanced";
export type SearchType = "Drug" | "Disease" | ("Drug" | "Disease")[];

export interface QueryInputs {
  drugName?: string;           // exact name
  diseaseName?: string;        // exact name
}

export interface ConceptRow {
  cui: string;
  type: "drug" | "disease";
}

 
export type RowDict = Record<string, unknown>;

export interface PmidRow {
  pmid: string;
}

export interface QueriedPmidInput {
  conceptIds: ConceptRow[];
  searchType: SearchType;
}

export type StudyResult = {
  PMID: string;
  Title: string;
  Year: string;
  StudiedDrugs: string;
  StudiedDiseases: string;
};



