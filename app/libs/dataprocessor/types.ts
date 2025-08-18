
export interface StudyTypeSummaryStat {
  study_type: string;
  count: number;
}

export interface StudyTypeRecord {
  pmid: string;
  study_type: string;
}

export type StydyTypePopulationRecord = {
  study_type: string;
  population: string;
};

export type PlotData = {
  population: string;
  count: number;
  class: 'P' | 'A' | 'S' | 'NA' | null;
};


