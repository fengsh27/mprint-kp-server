import { PlotData, StudyTypeRecord, StudyTypeSummaryStat, StydyTypePopulationRecord } from "./types";

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

  // Build result with class assignment
  return Object.entries(populationCounts).map(([population, count]) => {
    let populationClass: 'P' | 'A' | 'S' | 'NA' | null = null;
    if (["Child", "Fetus", "Infant", "Neonate", "Newborn", "Premature"].includes(population)) {
      populationClass = 'P';
    } else if (["Pregnant", "Labor", "Postpartum"].includes(population)) {
      populationClass = 'A';
    } else if (["Maternal", "Pediatric"].includes(population)) {
      populationClass = 'S';
    } else {
      populationClass = 'NA';
    }

    return {
      population,
      count,
      class: populationClass
    };
  });
}

export function preparePopulationData(pkPlotData: PlotData[], pePlotData: PlotData[], ctPlotData: PlotData[]): any[] {
    return [{ 
      name: 'Pediatric', 
      pk: pkPlotData.find(d => d.population === 'Pediatric')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Pediatric')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Pediatric')?.count ?? 0, 
      color: '#fbbf24' 
    }, { 
      name: 'Fetus', 
      pk: pkPlotData.find(d => d.population === 'Fetus')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Fetus')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Fetus')?.count ?? 0, 
      color: '#60a5fa' 
    }, { 
      name: 'Premature', 
      pk: pkPlotData.find(d => d.population === 'Premature')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Premature')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Premature')?.count ?? 0, color: '#60a5fa' 
    },
    { 
      name: 'Newborn', 
      pk: pkPlotData.find(d => d.population === 'Newborn')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Newborn')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Newborn')?.count ?? 0, 
      color: '#60a5fa' 
    }, { 
      name: 'Neonate', 
      pk: pkPlotData.find(d => d.population === 'Neonate')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Neonate')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Neonate')?.count ?? 0, 
      color: '#60a5fa' 
    }, { 
      name: 'Infant', 
      pk: pkPlotData.find(d => d.population === 'Infant')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Infant')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Infant')?.count ?? 0, 
      color: '#60a5fa' 
    }, { 
      name: 'Child', 
      pk: pkPlotData.find(d => d.population === 'Child')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Child')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Child')?.count ?? 0, 
      color: '#60a5fa' 
    }, { 
      name: 'Maternal', 
      pk: pkPlotData.find(d => d.population === 'Maternal')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Maternal')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Maternal')?.count ?? 0, 
      color: '#fbbf24' 
    }, { 
      name: 'Pregnant', 
      pk: pkPlotData.find(d => d.population === 'Pregnant')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Pregnant')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Pregnant')?.count ?? 0, 
      color: '#f87171' 
    }, { 
      name: 'Labor', 
      pk: pkPlotData.find(d => d.population === 'Labor')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Labor')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Labor')?.count ?? 0, 
      color: '#f87171' 
    }, { 
      name: 'Postpartum', 
      pk: pkPlotData.find(d => d.population === 'Postpartum')?.count ?? 0, 
      pe: pePlotData.find(d => d.population === 'Postpartum')?.count ?? 0, 
      ct: ctPlotData.find(d => d.population === 'Postpartum')?.count ?? 0, 
      color: '#f87171' 
    }, {
      name: 'NA',
      pk: pkPlotData.find(d => d.class === 'NA')?.count ?? 0, 
      pe: pePlotData.find(d => d.class === 'NA')?.count ?? 0, 
      ct: ctPlotData.find(d => d.class === 'NA')?.count ?? 0, 
      color: '#60a5fa' 
    }];
}
