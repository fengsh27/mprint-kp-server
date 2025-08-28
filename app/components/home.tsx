'use client';

import { useState, useEffect } from 'react';
import { Search, Download, BarChart3, Info, ChevronDownIcon } from 'lucide-react';
import Image from 'next/image';
import * as Accordion from '@radix-ui/react-accordion';
import * as Tabs from '@radix-ui/react-tabs';
import { useQueryState } from 'nuqs';
import { useDebouncedCallback } from "use-debounce";
import VirtualizedSelect from './VirtualizedSelect';
import OverviewTab from './OverviewTab';
import DrugTab from './DrugTab';
import PublicationTab from './PublicationTab';

import {
  daGetConcepts, 
  daGetDiseaseList, 
  daGetDrugList, 
  daGetOverallStudyType, 
  daGetPMIDs, 
  daGetStudy, 
  daGetTypePopulation, 
} from "../dataprovider/dataaccessor";
import { 
  ConceptRow, 
  PmidRow, 
  SearchType, 
  StudyData, 
  TypeData 
} from '../libs/database/types';
import { calculateSummaryStats, preparePlotData, preparePopulationData } from '../libs/dataprocessor/utils';
import { 
  buildPublicationTable, 
  downloadPublicationTableAsCsv, 
  downloadPublicationTableAsTsv, 
  downloadPublicationTableAsXlsx,
  PublicationTableRow 
} from './component-utils';



const DEFAULT_LOGO_WIDTH = 150;
const DEFAULT_LOGO_HEIGHT = 182;

const logoSize = {
  w: 100,
  h: 100 * DEFAULT_LOGO_HEIGHT / DEFAULT_LOGO_WIDTH,
};

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

function isQueryStateValid(queryState: any) {
  return queryState && queryState.length > 0;
}

export default function Home() {
  const [searchMode, setSearchMode] = useState('simple');
  const [drugList, setDrugList] = useState<string[]>([]);
  const [diseaseList, setDiseaseList] = useState<{TERM: string, des: string}[]>([]);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('');
   
  const[queryDrug, setQueryDrug] = useQueryState('drug', { 
    defaultValue: '', 
  });
  const [queryDisease, setQueryDisease] = useQueryState('disease', { 
    defaultValue: '', 
  });
  
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [hasDrugSearched, setHasDrugSearched] = useState(false);
  const [isTabSwitching, setIsTabSwitching] = useState(false);
  const [pmidData, setPmidData] = useState<PmidRow[]>([]);
  const [typeData, setTypeData] = useState<TypeData[]>([]);
  const [publicationData, setPublicationData] = useState<PublicationTableRow[]>([]);
  const [downloadType, setDownloadType] = useState<'xlsx' | 'csv' | 'tsv'>('xlsx');

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
  const [populationData, setPopulationData] = useState<any[]>([
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
  ]);
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
      const drugs = (data.druglist as Array<{name: string, type: string}>).filter(
        (item) => item.type == "drug"
      ).map(item => item.name);
      setDrugList(drugs);
    });
  });

  // populate disease list and set selected disease to advanced if disease is selected
  const populateDiseaseList = (disease?: string) => {
    daGetDiseaseList().then((data: any) => {
      const diseases = (data.disease as Array<{TERM: string, des: string}>);
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

  // Auto-search when URL parameters are present on page load
  useEffect(() => {
    if (isQueryStateValid(queryDrug) || isQueryStateValid(queryDisease)) {
      // populate drug list and set selected drug to advanced if drug is selected
      if (isQueryStateValid(queryDrug)) {
        daGetDrugList().then((data: any) => {
          const drugs = (data.druglist as Array<{name: string, type: string}>).filter(
            (item) => item.type == "drug"
          ).map(item => item.name);
          setDrugList(drugs);
          setSelectedDrug(queryDrug);
        });        
      }
      if (isQueryStateValid(queryDisease)) {
        setSearchMode('advanced');
        populateDiseaseList(queryDisease);
      }
      // Trigger search after a short delay to ensure data is loaded
      const timer = setTimeout(() => {
        if (isQueryStateValid(queryDrug) || isQueryStateValid(queryDisease)) {
          handleConceptChange(queryDrug??"", queryDisease??"");
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      initializeOverview();
    }
  }, []);

  useEffect(() => {
    if (!pmidData || pmidData.length === 0 || !typeData || typeData.length === 0) {
      return;
    }
    daGetStudy(pmidData).then((data: any) => {
      const studyData = data as StudyData[];
      const publicationData = buildPublicationTable(studyData, typeData);
      setPublicationData(publicationData);
    }).catch((error: any) => {
      console.error('Error fetching study data:', error);
    });
  }, [pmidData, typeData]);

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
    const {layout, pkChartData, pharmChartData, clinicalChartData} = calculatePlotData(populationData);
    
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
    
    // Ensure we have valid string parameters
    const safeDrug = String(drug || '');
    const safeDisease = String(disease || '');
    
    daGetConcepts(safeDrug, safeDisease).then((data: any) => {
      if (!data || data.length === 0) {
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
          const newOverallStudyType = {...overallStudyType};
          newOverallStudyType.pk.count = summaryStats.find(stat => stat.study_type.toLowerCase()==="pk")?.count ?? 0;
          newOverallStudyType.pe.count = summaryStats.find(stat => stat.study_type.toLowerCase()==="pe")?.count ?? 0;
          newOverallStudyType.ct.count = summaryStats.find(stat => stat.study_type.toLowerCase()==="ct")?.count ?? 0;
          setOverallStudyType(newOverallStudyType);

          const pkPlotData = preparePlotData("PK", typeData);
          const pePlotData = preparePlotData("PE", typeData);
          const ctPlotData = preparePlotData("CT", typeData);
        
          const thePopulationData = preparePopulationData(pkPlotData, pePlotData, ctPlotData);

          setPopulationData(thePopulationData);
        });
      });
    });
  }, 500);

  function handleSearch() {
    if (!selectedDrug && !selectedDisease) {
      return; // Don't search if no parameters are selected
    }
    setQueryDrug(selectedDrug ?? "");
    setQueryDisease(selectedDisease ?? "");
    handleTabChange("overview");
    handleConceptChange(selectedDrug, selectedDisease);
  }

  function handleSearchModeChange(e: any) {
    setSearchMode(e.target.value);
    if (e.target.value === 'simple') {
      try {
        setSelectedDisease('');
      } catch (error) {
        console.warn('Error clearing disease selection:', error);        
      }
    }
  }

  function clearAllSearch() {
    try {
      setSelectedDrug('');
      setSelectedDisease('');
      setQueryDrug('');
      setQueryDisease('');
      initializeOverview();
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

  function handleDownload() {
    if (!publicationData || publicationData.length === 0) {
      return;
    }
    if (downloadType === 'xlsx') {
      downloadPublicationTableAsXlsx(publicationData);
    } else if (downloadType === 'csv') {
      downloadPublicationTableAsCsv(publicationData);
    } else if (downloadType === 'tsv') {
      downloadPublicationTableAsTsv(publicationData);
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
                <a style={{marginLeft: `${logoSize.w - 8}px`}} href="https://www.mprint.org/" target="_blank">
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
        <div className={`${sidebarExpanded ? 'w-64' : 'w-16'} bg-gray-100 min-h-screen transition-all duration-300 ease-in-out relative overflow-visible ${sidebarExpanded ? 'min-w-[250px]' : 'min-w-[64px]'}`}>
          {/* Toggle Button */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="absolute top-2 right-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors z-10 shadow-md"
            title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarExpanded ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
          
          <div className={`${sidebarExpanded ? 'p-2' : 'p-1'} mt-8`}>
          {sidebarExpanded ? (
            <Accordion.Root type="multiple" defaultValue={["search"]} className="space-y-4">
              {/* Search Section */}
              <Accordion.Item value="search" className="bg-white rounded-lg shadow-sm">
              <Accordion.Trigger className="flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 transition-colors rounded-lg">
                <div className="flex items-center space-x-2">
                  <Search className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Search</span>
                </div>
                <ChevronDownIcon className="w-5 h-5 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
              
              <Accordion.Content className="px-3 pb-3">
                <div className="pt-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Mode:
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="searchMode"
                          value="simple"
                          checked={searchMode === 'simple'}
                          onChange={handleSearchModeChange}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Simple</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="searchMode"
                          value="advanced"
                          checked={searchMode === 'advanced'}
                          onChange={(e) => setSearchMode(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Advanced</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Drug Name:
                    </label>
                    <div className="absolute left-20 top-1 w-4 h-4" title="Select a drug to search" >
                      <Info className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="relative">
                        <VirtualizedSelect
                          value={selectedDrug}
                          onValueChange={setSelectedDrug}
                          placeholder="Select a drug"
                          options={drugList.map(drug => ({ value: drug, label: drug }))}
                          searchPlaceholder="Search drugs..."
                          maxHeight={300}
                          itemHeight={40}
                        />
                      
                      {selectedDrug && (
                        <button
                          onClick={() => {
                            try {
                              setSelectedDrug('');
                            } catch (error) {
                              console.warn('Error clearing drug selection:', error);
                            }
                          }}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Clear selection"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Disease Name Field - Only shown in Advanced mode */}
                  {searchMode === 'advanced' && (
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Disease Name:
                      </label>
                      <div className="absolute left-25 top-1 w-4 h-4" title="Select a disease to search" >
                        <Info className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="relative">
                        <VirtualizedSelect
                          value={selectedDisease}
                          onValueChange={setSelectedDisease}
                          placeholder="Select a disease"
                          options={diseaseList.map(disease => ({ 
                            value: disease.TERM, 
                            label: disease.TERM, 
                            description: disease.des 
                          }))}
                          searchPlaceholder="Search diseases..."
                          maxHeight={300}
                          itemHeight={50}
                        />
                        
                        {selectedDisease && (
                          <button
                            onClick={() => {
                              try {
                                setSelectedDisease('');
                              } catch (error) {
                                console.warn('Error clearing disease selection:', error);
                              }
                            }}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Clear selection"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <button 
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                      onClick={handleSearch}
                    >
                      Search
                    </button>
                    <button 
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                      onClick={clearAllSearch}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </Accordion.Content>
            </Accordion.Item>

            {/* Download Data Section */}
            <Accordion.Item value="download" className="bg-white rounded-lg shadow-sm">
              <Accordion.Trigger className="flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 transition-colors rounded-lg">
                <div className="flex items-center space-x-2">
                  <Download className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-900 font-medium">Download Data</span>
                </div>
                <ChevronDownIcon className="w-5 h-5 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
              
              <Accordion.Content className="px-3 pb-3">
                <div className="pt-2 space-y-3">
                  {(!publicationData || publicationData.length === 0) && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-yellow-800 font-medium">Please select drug or disease first</span>
                      </div>
                    </div>
                  )}
                  <div className="text-sm text-gray-700 font-medium mb-3">
                    Download Publication Data as:
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="download-format" 
                        value="excel" 
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                        disabled={!publicationData || publicationData.length === 0}
                        checked={downloadType === 'xlsx'}
                        onChange={() => setDownloadType('xlsx')}
                      />
                      <span className="text-sm text-gray-700">Excel</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="download-format" 
                        value="csv" 
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                        disabled={!publicationData || publicationData.length === 0}
                        checked={downloadType === 'csv'}
                        onChange={() => setDownloadType('csv')}
                      />
                      <span className="text-sm text-gray-700">CSV</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="download-format" 
                        value="tsv" 
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                        disabled={!publicationData || publicationData.length === 0}
                        checked={downloadType === 'tsv'}
                        onChange={() => setDownloadType('tsv')}
                      />
                      <span className="text-sm text-gray-700">TSV</span>
                    </label>
                  </div>
                  <div className="pt-3">
                    <button 
                      className={`w-full py-2 px-4 rounded-md transition-colors ${
                        (!pmidData || pmidData.length === 0 || !typeData || typeData.length === 0)
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      disabled={!publicationData || publicationData.length === 0}
                      onClick={handleDownload}
                    >
                      Download
                    </button>
                  </div>
                </div>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
          ) : (
            // Collapsed sidebar - show only icons
            <div className="space-y-4 pt-4">
              <div className="bg-white rounded-lg shadow-sm p-3 hover:bg-gray-50 transition-colors cursor-pointer" title="Search">
                <Search className="w-5 h-5 text-gray-600 mx-auto" />
              </div>
              <div className="bg-white rounded-lg shadow-sm p-3 hover:bg-gray-50 transition-colors cursor-pointer" title="Download Data">
                <Download className="w-5 h-5 text-gray-600 mx-auto" />
              </div>
            </div>
          )}
          </div>
        </div>

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
                />
              )}
            </Tabs.Content>
            
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
              <PublicationTab publicationData={publicationData} />
            )}
          </Tabs.Content>
          )}
                      
        </Tabs.Root>
        </div>
      </div>
    </div>
  );
} 

