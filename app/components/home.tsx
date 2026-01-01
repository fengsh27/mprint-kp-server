'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart3 } from 'lucide-react';
import Image from 'next/image';
import * as Tabs from '@radix-ui/react-tabs';
import { useQueryState } from 'nuqs';
import { useDebouncedCallback } from "use-debounce";
import LeftPanel from './LeftPanel';
import OverviewTab from './OverviewTab';
import DrugTab from './DrugTab';
import PublicationTab from './PublicationTab';
import DrugClassTab from './DrugClassTab';

import {
  daGetConcepts,
  daGetDiseaseList,
  daGetDrugList,
  daGetOverallStudyType,
  daGetPMIDs,
  daGetStudy,
  daGetStudyCount,
  daGetTypePopulation,
  daGetDrugClassList,
  daGetDrugClassListByLevel,
  daExportStudy,
} from "../dataprovider/dataaccessor";
import {
  ConceptRow,
  PmidRow,
  SearchType,
  StudyData,
  TypeData
} from '../libs/database/types';
import { calculateSummaryStats, preparePlotData, preparePopulationData } from '../libs/dataprocessor/utils';
import { buildPublicationTable, PublicationTableRow } from './component-utils';



const DEFAULT_LOGO_WIDTH = 150;
const DEFAULT_LOGO_HEIGHT = 182;
const DEFAULT_PUBLICATION_PAGE_SIZE = 25;
const PUBLICATION_CACHE_LIMIT = 5;
const PUBLICATION_PAGE_CACHE_LIMIT = 20;

const logoSize = {
  w: 100,
  h: 100 * DEFAULT_LOGO_HEIGHT / DEFAULT_LOGO_WIDTH,
};

const DEFAULT_POPULATION_DATA = [
  { name: 'Pediatric', pk: 270204, pe: 630043, ct: 139298, color: '#fbbf24' },
  { name: 'Fetus', pk: 37109, pe: 60054, ct: 9072, color: '#60a5fa' },
  { name: 'Premature', pk: 7716, pe: 15098, ct: 0, color: '#60a5fa' },
  { name: 'Newborn', pk: 62531, pe: 130494, ct: 28553, color: '#60a5fa' },
  { name: 'Neonate', pk: 29009, pe: 60287, ct: 14235, color: '#60a5fa' },
  { name: 'Infant', pk: 118132, pe: 269421, ct: 66022, color: '#60a5fa' },
  { name: 'Child', pk: 184057, pe: 457026, ct: 102569, color: '#60a5fa' },
  { name: 'Maternal', pk: 136152, pe: 293668, ct: 57541, color: '#fbbf24' },
  { name: 'Pregnant', pk: 85462, pe: 187872, ct: 34886, color: '#f87171' },
  { name: 'Labor', pk: 7254, pe: 20170, ct: 7385, color: '#f87171' },
  { name: 'Postpartum', pk: 8380, pe: 19236, ct: 4338, color: '#f87171' },
];

function calculatePlotData(populationData: any[]) {
  const clinicalData = populationData.filter(item => item.ct > 0);

  const newChartLayout = {
    margin: { l: 30, r: 20, t: 10, b: 60 },
    showlegend: false,
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    font: { size: 14 },
    xaxis: {
      tickangle: -45,
      tickfont: { size: 12 },
      title: { text: 'Population', font: { size: 12 } }
    },
    yaxis: {
      tickfont: { size: 10 },
      title: { text: '', font: { size: 12 } },
      showticklabels: true
    }
  };

  const newPkChartData = [{
    x: populationData.map(d => d.name),
    y: populationData.map(d => d.pk),
    type: 'bar' as const,
    marker: {
      color: populationData.map(d => d.color),
      line: { width: 1, color: '#374151' }
    },
    text: populationData.map(d => d.pk.toString()),
    textposition: 'outside' as const,
    textfont: { size: 16 }
  }];

  const newPharmChartData = [{
    x: populationData.map(d => d.name),
    y: populationData.map(d => d.pe),
    type: 'bar' as const,
    marker: {
      color: populationData.map(d => d.color),
      line: { width: 1, color: '#374151' }
    },
    text: populationData.map(d => d.pe.toString()),
    textposition: 'outside' as const,
    textfont: { size: 16 }
  }];

  const newClinicalChartData = [{
    x: clinicalData.map(d => d.name),
    y: clinicalData.map(d => d.ct),
    type: 'bar' as const,
    marker: {
      color: clinicalData.map(d => d.color),
      line: { width: 1, color: '#374151' }
    },
    text: clinicalData.map(d => d.ct.toString()),
    textposition: 'outside' as const,
    textfont: { size: 16 }
  }];

  return {
    layout: newChartLayout,
    pkChartData: newPkChartData,
    pharmChartData: newPharmChartData,
    clinicalChartData: newClinicalChartData
  };
}

function hashPmids(pmids: PmidRow[]) {
  let hash = 5381;
  for (const item of pmids) {
    const pmid = item.pmid ?? '';
    for (let i = 0; i < pmid.length; i += 1) {
      hash = (hash * 33) ^ pmid.charCodeAt(i);
    }
  }
  return `${hash >>> 0}-${pmids.length}`;
}

function isQueryStateValid(queryState: any) {
  return queryState && queryState.length > 0;
}

export default function Home() {
  const [searchMode, setSearchMode] = useState('simple');
  const [drugList, setDrugList] = useState<string[]>([]);
  const [diseaseList, setDiseaseList] = useState<{ TERM: string, des: string }[]>([]);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('');
  const [selectedDrugClass, setSelectedDrugClass] = useState('');
  const [selectedDrugClassLevel, setSelectedDrugClassLevel] = useState<1 | 2 | 3>(1);
  const [drugClassList, setDrugClassList] = useState<Array<{ value: string, label: string, preferred_label: string | null }>>([]);
  const [drugClassHierarchy, setDrugClassHierarchy] = useState<{ level1: string[], level2: string[], level3: string[] }>({
    level1: [],
    level2: [],
    level3: []
  });

  const [queryDrug, setQueryDrug] = useQueryState('drug', {
    defaultValue: '',
  });
  const [queryDisease, setQueryDisease] = useQueryState('disease', {
    defaultValue: '',
  });
  const [queryDrugClass, setQueryDrugClass] = useQueryState('drugClass', {
    defaultValue: '',
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [hasDrugSearched, setHasDrugSearched] = useState(false);
  const [isTabSwitching, setIsTabSwitching] = useState(false);
  const [pmidData, setPmidData] = useState<PmidRow[]>([]);
  const [typeData, setTypeData] = useState<TypeData[]>([]);
  const [publicationData, setPublicationData] = useState<PublicationTableRow[]>([]);
  const [publicationCount, setPublicationCount] = useState<number | null>(null);
  const [isLoadingPublications, setIsLoadingPublications] = useState(false);
  const [publicationPage, setPublicationPage] = useState(1);
  const [publicationPageSize, setPublicationPageSize] = useState(DEFAULT_PUBLICATION_PAGE_SIZE);
  const [isLoadingPopulationData, setIsLoadingPopulationData] = useState(false);
  const [downloadType, setDownloadType] = useState<'xlsx' | 'csv' | 'tsv'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const studyCacheRef = useRef(
    new Map<string, { count: number | null; pages: Map<string, StudyData[]> }>()
  );
  const previousPmidKeyRef = useRef<string>('');

  const pmidKey = useMemo(() => {
    if (!pmidData || pmidData.length === 0) {
      return '';
    }
    return hashPmids(pmidData);
  }, [pmidData]);

  const [overallStudyType, setOverallStudyType] = useState({
    pk: {
      count: 0,
      label: "Pharmacokinetics",
      description: "Studies examining the use and effects of drugs in large populations"
    },
    pe: {
      count: 0,
      label: "Pharmacoepidemiology",
      description: "Studies examining the use and effects of drugs in large populations"
    },
    ct: {
      count: 0,
      label: "Clinical Trial",
      description: "Controlled studies evaluating the safety and efficacy of drugs in human subjects"
    }
  });
  const [populationData, setPopulationData] = useState<any[]>(DEFAULT_POPULATION_DATA);
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);

  // Chart data and layout
  const [pkChartData, setPkChartData] = useState<any[]>([]);
  const [pharmChartData, setPharmChartData] = useState<any[]>([]);
  const [clinicalChartData, setClinicalChartData] = useState<any[]>([]);
  const [chartLayout, setChartLayout] = useState<any>({
    margin: { l: 50, r: 50, t: 50, b: 50 },
    yaxis: {
      showticklabels: false,
      tickmode: 'array',
      tickvals: [],
      ticktext: []
    }
  });

  // initialize overview data
  // 1. populate overall study type
  // 2. populate drug list
  const initializeOverview = useDebouncedCallback(() => {
    daGetOverallStudyType().then((overall_study_type: any) => {
      setOverallStudyType(overall_study_type);
    });
    daGetDrugList().then((data: any) => {
      const drugs = (data.druglist as Array<{ name: string, type: string }>).filter(
        (item) => item.type == "drug"
      ).map(item => item.name);
      setDrugList(drugs);
    });
  });

  // populate disease list and set selected disease to advanced if disease is selected
  const populateDiseaseList = (disease?: string) => {
    daGetDiseaseList().then((data: any) => {
      const diseases = (data.disease as Array<{ TERM: string, des: string }>);
      setDiseaseList(diseases);
      if (disease) {
        setSelectedDisease(disease);
      }
    });
  };

  useEffect(() => {
    if (searchMode === 'advanced' && diseaseList.length === 0) {
      populateDiseaseList()
    }
  }, [searchMode]);

  // Auto-search when drug is selected in simple mode
  useEffect(() => {
    if (searchMode === 'simple' && selectedDrug) {
      // Only trigger search if drug is actually selected (not on initial render)
      // Clear disease and drug class when user selects a drug in simple mode
      setSelectedDisease('');
      setSelectedDrugClass('');
      setQueryDrug(selectedDrug);
      setQueryDisease('');
      setQueryDrugClass('');
      setConcepts([]);
      setPmidData([]);
      setTypeData([]);
      setPublicationData([]);
      handleTabChange("overview");
      handleConceptChange(selectedDrug, '');
    }
  }, [selectedDrug, searchMode]);

  // Load drug class hierarchy when drug class mode is selected
  useEffect(() => {
    if (searchMode === 'drugclass' && drugClassHierarchy.level1.length === 0) {
      daGetDrugClassList().then((data: any) => {
        setDrugClassHierarchy(data);
      }).catch((error: any) => {
        console.error('Error fetching drug class list:', error);
      });
    }
  }, [searchMode]);

  // Load drug class list for selected level
  useEffect(() => {
    if (searchMode === 'drugclass') {
      daGetDrugClassListByLevel(selectedDrugClassLevel).then((data: any) => {
        setDrugClassList(data);
      }).catch((error: any) => {
        console.error('Error fetching drug class list by level:', error);
      });
    }
  }, [searchMode, selectedDrugClassLevel]);

  // Auto-search when URL parameters are present on page load
  useEffect(() => {
    if (
      isQueryStateValid(queryDrug) ||
      isQueryStateValid(queryDisease) ||
      isQueryStateValid(queryDrugClass)
    ) {
      // Handle drug class query parameter
      if (isQueryStateValid(queryDrugClass)) {
        setSearchMode('drugclass');
        // Load drug class hierarchy
        daGetDrugClassList().then((data: any) => {
          setDrugClassHierarchy(data);
          // Set selected drug class and jump to DrugClass tab
          setSelectedDrugClass(queryDrugClass);
          setActiveTab('drugclass');
        }).catch((error: any) => {
          console.error('Error fetching drug class list:', error);
        });
      } else {
        // populate drug list and set selected drug to advanced if drug is selected
        daGetDrugList().then((data: any) => {
          const drugs = (data.druglist as Array<{ name: string, type: string }>).filter(
            (item) => item.type == "drug"
          ).map(item => item.name);
          setDrugList(drugs);
          if (isQueryStateValid(queryDrug)) {
            setSelectedDrug(queryDrug);
          }
        });
        if (isQueryStateValid(queryDisease)) {
          setSearchMode('advanced');
          populateDiseaseList(queryDisease);
        }
        // Trigger search after a short delay to ensure data is loaded
        const timer = setTimeout(() => {
          if (isQueryStateValid(queryDrug) || isQueryStateValid(queryDisease)) {
            handleConceptChange(queryDrug ?? "", queryDisease ?? "");
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    } else {
      initializeOverview();
    }
  }, []);

  useEffect(() => {
    if (!pmidData || pmidData.length === 0 || !typeData || typeData.length === 0) {
      setPublicationData([]);
      setPublicationCount(null);
      setIsLoadingPublications(false);
      return;
    }

    if (previousPmidKeyRef.current !== pmidKey) {
      previousPmidKeyRef.current = pmidKey;
      setPublicationData([]);
      setPublicationCount(null);
      setIsLoadingPublications(false);
      if (publicationPage !== 1) {
        setPublicationPage(1);
        return;
      }
    }

    const controller = new AbortController();
    const { signal } = controller;
    let isActive = true;

    const cache = studyCacheRef.current;
    let entry = cache.get(pmidKey);
    if (!entry) {
      entry = { count: null, pages: new Map() };
      cache.set(pmidKey, entry);
      if (cache.size > PUBLICATION_CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) {
          cache.delete(oldestKey);
        }
      }
    }

    if (entry.count !== null) {
      setPublicationCount(entry.count);
    }

    const pageKey = `${publicationPage}-${publicationPageSize}`;
    const cachedPage = entry.pages.get(pageKey);
    if (cachedPage) {
      const publicationData = buildPublicationTable(cachedPage, typeData);
      setPublicationData(publicationData);
      setIsLoadingPublications(false);
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    setIsLoadingPublications(true);
    setPublicationData([]);

    const offset = (publicationPage - 1) * publicationPageSize;

    if (entry.count === null) {
      console.log("get study count", new Date().toISOString());
      daGetStudyCount(pmidData, { signal })
        .then((response: any) => {
          if (!isActive) return;
          console.log("get study count: ", response?.count ?? 0, new Date().toISOString());
          const count = response?.count ?? 0;
          if (entry) {
            entry.count = count;
          }
          setPublicationCount(count);
        })
        .catch((error: any) => {
          if (!isActive || error?.name === "AbortError") return;
          console.error("Error fetching study count:", error);
        });
    }

    daGetStudy(pmidData, { signal, limit: publicationPageSize, offset })
      .then((data: any) => {
        if (!isActive) return;
        console.log("got study data", new Date().toISOString());
        const studyData = data as StudyData[];
        entry?.pages.set(pageKey, studyData);
        if (entry && entry.pages.size > PUBLICATION_PAGE_CACHE_LIMIT) {
          const oldestPageKey = entry.pages.keys().next().value;
          if (oldestPageKey) {
            entry.pages.delete(oldestPageKey);
          }
        }
        const publicationData = buildPublicationTable(studyData, typeData);
        setPublicationData(publicationData);
        setIsLoadingPublications(false);
      })
      .catch((error: any) => {
        if (!isActive || error?.name === "AbortError") return;
        console.error("Error fetching study data:", error);
        setIsLoadingPublications(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [pmidData, typeData, pmidKey, publicationPage, publicationPageSize]);

  // Handle window resize for responsive charts
  useEffect(() => {
    const handleResize = () => {
      // Trigger Plotly resize event
      if (typeof window !== 'undefined' && (window as any).Plotly) {
        const plotElements = document.querySelectorAll('.js-plotly-plot');
        plotElements.forEach((element) => {
          (window as any).Plotly.Plots.resize(element);
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate chart data when population data changes
  useEffect(() => {
    const { layout, pkChartData, pharmChartData, clinicalChartData } = calculatePlotData(populationData);

    setChartLayout(layout);
    setPkChartData(pkChartData);
    setPharmChartData(pharmChartData);
    setClinicalChartData(clinicalChartData);
  }, [populationData]);

  function handleTabChange(value: string) {
    setIsTabSwitching(true);
    setActiveTab(value);
    // Small delay to show loading state
    setTimeout(() => setIsTabSwitching(false), 150);
  }

  const handleConceptChange = useDebouncedCallback((drug: string, disease: string) => {
    // Don't search if both parameters are empty
    if (!drug && !disease) {
      return;
    }

    // Set loading state for population data
    setIsLoadingPopulationData(true);

    // Ensure we have valid string parameters
    const safeDrug = String(drug || '');
    const safeDisease = String(disease || '');

    daGetConcepts(safeDrug, safeDisease).then((data: any) => {
      if (!data) {
        setIsLoadingPopulationData(false);
        return;
      }
      const concepts: ConceptRow[] = data as ConceptRow[];
      const isDrugConceptQueried = concepts.some(concept => concept.type === "drug");
      setHasDrugSearched(isDrugConceptQueried);
      setConcepts(concepts);
      const searchType: SearchType = [];
      if (safeDrug) {
        searchType.push("Drug");
      }
      if (safeDisease) {
        searchType.push("Disease");
      }
      daGetPMIDs(data, searchType).then((pmidData: any) => {
        setPmidData(pmidData);
        daGetTypePopulation(pmidData).then((data: any) => {
          const typeData = data as TypeData[];
          setTypeData(typeData);
          const summaryStats = calculateSummaryStats(typeData);
          const newOverallStudyType = { ...overallStudyType };
          newOverallStudyType.pk.count = summaryStats.find(stat => stat.study_type.toLowerCase() === "pk")?.count ?? 0;
          newOverallStudyType.pe.count = summaryStats.find(stat => stat.study_type.toLowerCase() === "pe")?.count ?? 0;
          newOverallStudyType.ct.count = summaryStats.find(stat => stat.study_type.toLowerCase() === "ct")?.count ?? 0;
          setOverallStudyType(newOverallStudyType);

          const pkPlotData = preparePlotData("PK", typeData);
          const pePlotData = preparePlotData("PE", typeData);
          const ctPlotData = preparePlotData("CT", typeData);

          const thePopulationData = preparePopulationData(pkPlotData, pePlotData, ctPlotData);

          setPopulationData(thePopulationData);
          setIsLoadingPopulationData(false);
        }).catch((error: any) => {
          console.error('Error fetching type population data:', error);
          setIsLoadingPopulationData(false);
        });
      }).catch((error: any) => {
        console.error('Error fetching PMIDs:', error);
        setIsLoadingPopulationData(false);
      });
    }).catch((error: any) => {
      console.error('Error fetching concepts:', error);
      setIsLoadingPopulationData(false);
    });
  }, 500);

  function handleSearch() {
    if (!selectedDrug && !selectedDisease) {
      return; // Don't search if no parameters are selected
    }
    // Clear drug class when searching in Advanced mode (since Advanced mode uses drug/disease)
    setSelectedDrugClass('');
    setQueryDrugClass('');
    setQueryDrug(selectedDrug ?? "");
    setQueryDisease(selectedDisease ?? "");
    setConcepts([]);
    setPmidData([]);
    setTypeData([]);
    setPublicationData([]);
    handleTabChange("overview");
    handleConceptChange(selectedDrug, selectedDisease);
  }

  function handleSearchModeChange(e: any) {
    setSearchMode(e.target.value);
    // Reset drug class level to 1 when switching to drug class mode
    if (e.target.value === 'drugclass') {
      setSelectedDrugClassLevel(1);
    }
    // Don't clear selections when switching modes - only clear when user makes new selections
  }

  function clearAllSearch() {
    try {
      setSelectedDrug('');
      setSelectedDisease('');
      setSelectedDrugClass('');
      setSelectedDrugClassLevel(1);
      setQueryDrug('');
      setQueryDisease('');
      setQueryDrugClass('');
      setIsLoadingPopulationData(false);
      initializeOverview();
      setPopulationData(DEFAULT_POPULATION_DATA);
    } catch (error) {
      console.warn('Error clearing search parameters:', error);
    }
    setConcepts([]);
    setPmidData([]);
    setTypeData([]);
    setPublicationData([]);
    setHasDrugSearched(false);
    setActiveTab('overview');
  }

  function handleDrugChange(drug: string) {
    setSelectedDrug(drug);
    if (searchMode === 'simple') {
      setQueryDrug(drug);
      if (drug) {
        setSelectedDrugClass('');
        setQueryDrugClass('');
        setSelectedDisease('');
        setQueryDisease('');
      }
    }
  }

  function handleDrugClassChange(drugClass: string) {
    setSelectedDrugClass(drugClass);
    if (drugClass) {
      // Set query parameter
      setQueryDrugClass(drugClass);
      // Clear drug and disease selections
      setSelectedDrug('');
      setSelectedDisease('');
      setQueryDrug('');
      setQueryDisease('');
      // Set search mode to drugclass
      setSearchMode('drugclass');
      // Jump to DrugClass tab
      setActiveTab('drugclass');
      setHasDrugSearched(false);
      setConcepts([]);
    } else {
      // Clear query parameter when drug class is cleared
      setQueryDrugClass('');
      // Reset to overview tab when clearing
      setActiveTab('overview');
    }
  }

  function handleDrugClassLevelChange(level: 1 | 2 | 3) {
    setSelectedDrugClassLevel(level);
    // Clear selected drug class when level changes
    setSelectedDrugClass('');
    setQueryDrugClass('');
    setActiveTab('overview');
  }

  async function handleDownload() {
    if (!pmidData || pmidData.length === 0 || isExporting) {
      return;
    }
    setIsExporting(true);
    try {
      const { blob, filename } = await daExportStudy(pmidData, downloadType);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error exporting publication data:', error);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="mprint-header-bg-blue shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <a style={{ marginLeft: `${logoSize.w - 8}px` }} href="https://www.mprint.org/" target="_blank">
                  <Image src="/images/mprint-logo.png" alt="mprint logo" width="180" height="60" priority />
                </a>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Knowledge Portal (Silver)</h1>
            </div>
            <nav className="flex space-x-8">
              <a href="/" className="text-gray-500 hover:text-gray-700 px-1 py-2 text-sm font-medium">
                Explore
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-700 px-1 py-2 text-sm font-medium">
                How we help the community
              </a>
              <a href="/about" className="text-gray-500 hover:text-gray-700 px-1 py-2 text-sm font-medium">
                About
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar */}
        <LeftPanel
          searchMode={searchMode}
          onSearchModeChange={handleSearchModeChange}
          drugList={drugList}
          diseaseList={diseaseList}
          selectedDrug={selectedDrug}
          selectedDisease={selectedDisease}
          selectedDrugClass={selectedDrugClass}
          selectedDrugClassLevel={selectedDrugClassLevel}
          drugClassList={drugClassList}
          drugClassHierarchy={drugClassHierarchy}
          onDrugChange={handleDrugChange}
          onDiseaseChange={setSelectedDisease}
          onDrugClassChange={handleDrugClassChange}
          onDrugClassLevelChange={handleDrugClassLevelChange}
          onSearch={handleSearch}
          onClearAll={clearAllSearch}
          downloadType={downloadType}
          onDownloadTypeChange={setDownloadType}
          onDownload={handleDownload}
          isExporting={isExporting}
          pmidData={pmidData}
          sidebarExpanded={sidebarExpanded}
          onSidebarToggle={() => setSidebarExpanded(!sidebarExpanded)}
        />

        {/* Main Content */}
        <div className="flex-1 bg-white p-10">
          {/* Tabs */}
          <Tabs.Root
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
            defaultValue="overview"
          >
            <Tabs.List
              className="flex border-b border-gray-200 mb-8"
              aria-label="Dashboard navigation tabs"
            >
              <Tabs.Trigger
                value="overview"
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Overview</span>
              </Tabs.Trigger>

              {selectedDrugClass && (
                <Tabs.Trigger
                  value="drugclass"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Drug & Publication</span>
                </Tabs.Trigger>
              )}

              {hasDrugSearched && (
                <Tabs.Trigger
                  value="drug"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Drug</span>
                </Tabs.Trigger>
              )}

              {concepts.length > 0 && (
                <Tabs.Trigger
                  value="publication"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Publication</span>
                </Tabs.Trigger>
              )}

            </Tabs.List>

            <Tabs.Content
              value="overview"
              className="outline-none animate-in fade-in-0 slide-in-from-left-1 duration-300"
            >
              {isTabSwitching && activeTab !== 'overview' ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <OverviewTab
                  overallStudyType={overallStudyType}
                  pkChartData={pkChartData}
                  pharmChartData={pharmChartData}
                  clinicalChartData={clinicalChartData}
                  chartLayout={chartLayout}
                  isLoadingPopulationData={isLoadingPopulationData}
                />
              )}
            </Tabs.Content>

            {selectedDrugClass && (
              <Tabs.Content
                value="drugclass"
                className="outline-none animate-in fade-in-0 slide-in-from-left-1 duration-300"
              >
                {isTabSwitching && activeTab !== 'drugclass' ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <DrugClassTab selectedDrugClass={selectedDrugClass} />
                )}
              </Tabs.Content>
            )}

            {hasDrugSearched && (
              <Tabs.Content
                value="drug"
                className="outline-none animate-in fade-in-0 slide-in-from-right-1 duration-300"
              >
                {isTabSwitching && activeTab !== 'drug' ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <DrugTab selectedDrug={selectedDrug} concepts={concepts} />
                )}
              </Tabs.Content>
            )}

            {concepts.length > 0 && (
              <Tabs.Content
                value="publication"
                className="outline-none animate-in fade-in-0 slide-in-from-right-1 duration-300"
              >
                {isTabSwitching && activeTab !== 'publication' ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <PublicationTab
                    publicationData={publicationData}
                    publicationCount={publicationCount}
                    estimatedCount={pmidData.length}
                    isLoading={isLoadingPublications}
                    currentPage={publicationPage}
                    pageSize={publicationPageSize}
                    onPageChange={setPublicationPage}
                    onPageSizeChange={setPublicationPageSize}
                    serverSide
                  />
                )}
              </Tabs.Content>
            )}

          </Tabs.Root>
        </div>
      </div>
    </div>
  );
}
