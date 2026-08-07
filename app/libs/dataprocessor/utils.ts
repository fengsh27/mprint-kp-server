import { PlotData, StudyTypeRecord, StudyTypeSummaryStat, StydyTypePopulationRecord } from "./types";
import { POPULATION_CHART_CATEGORIES } from "../populations";

export function calculateSummaryStats(data: StudyTypeRecord[]): StudyTypeSummaryStat[] {
  if (!data || data.length === 0) return [];

  const typeToPmids = new Map<string, Set<string>>();

  for (const row of data) {
    const types = row.study_type.split(' / ').map(t => t.trim());
    for (const type of types) {
      if (!typeToPmids.has(type)) {
        typeToPmids.set(type, new Set());
      }
      typeToPmids.get(type)!.add(row.pmid);
    }
  }

  const result: StudyTypeSummaryStat[] = [];
  for (const [study_type, pmidSet] of typeToPmids.entries()) {
    result.push({
      study_type,
      count: pmidSet.size,
    });
  }

  return result;
}

export function preparePlotData(studyType: string, data: StydyTypePopulationRecord[]): PlotData[] {
  if (!data || data.length === 0) return [];

  const targetStudyTypeSet = new Set(studyType.split(' / '));

  const filtered = data.filter((row) => {
    const types = row.study_type.split(' / ');
    return types.some(type => targetStudyTypeSet.has(type));
  });

  // Count populations after splitting on " / "
  const populationCounts: Record<string, number> = {};

  filtered.forEach(row => {
    const populations = row.population?.split(' / ') || [];
    populations.forEach(pop => {
      if (!pop) return;
      populationCounts[pop] = (populationCounts[pop] || 0) + 1;
    });
  });

  return Object.entries(populationCounts).map(([population, count]) => ({
    population,
    count,
  }));
}

export function preparePopulationData(pkPlotData: PlotData[], pePlotData: PlotData[], ctPlotData: PlotData[]): any[] {
  const countOf = (data: PlotData[], name: string) =>
    data.find(d => d.population === name)?.count ?? 0;

  return POPULATION_CHART_CATEGORIES.map(({ name, color }) => ({
    name,
    pk: countOf(pkPlotData, name),
    pe: countOf(pePlotData, name),
    ct: countOf(ctPlotData, name),
    color,
  }));
}
