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

export type ATCData = {
  cui: string;
  L1: string;
  L2: string;
  L3: string;
  L4: string;
  atc_code: string;
};

export type MOAData = {
  CUI: string;
  MOA: string;
  type: string;
};

export type PEData = {
  CUI: string;
  PE: string;
  type: string;
};

export type EPCData = {
  CUI: string;
  EPC: string;
  type: string;
};

export type PKData = {
  property: string;
  value: string;
  CUI: string;
}

export type LabelStatsData = {
  cui: string;
  nursing_mothers: number;
  carcinogenesis_and_mutagenesis_and_impairment_of_fertility: number;
  pregnancy: number;
  pediatric_use: number;
  teratogenic_effects: number;
  pregnancy_or_breast_feeding: number;
  labor_and_delivery: number;
  nonteratogenic_effects: number;
  TITLE: string;
}


