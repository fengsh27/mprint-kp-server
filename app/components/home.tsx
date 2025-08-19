'use client';

import { useState, useEffect } from 'react';
import { Search, Download, BarChart3, Info, ChevronDownIcon } from 'lucide-react';
import Image from 'next/image';
import * as Accordion from '@radix-ui/react-accordion';
import * as Tabs from '@radix-ui/react-tabs';
import VirtualizedSelect from './VirtualizedSelect';
import OverviewTab from './OverviewTab';
import DrugTab from './DrugTab';

import { 
  daGetConcepts, 
  daGetDiseaseList, 
  daGetDrugList, 
  daGetExtraData, 
  daGetOverallStudyType, 
  daGetPMIDs, 
  daGetStudy, 
  daGetTypePopulation, 
  postTest 
} from "../dataprovider/dataaccessor";
import { ConceptRow, SearchType } from '../libs/database/types';
import { calculateSummaryStats, preparePlotData, preparePopulationData } from '../libs/dataprocessor/utils';



const DEFAULT_LOGO_WIDTH = 150;
const DEFAULT_LOGO_HEIGHT = 182;

const logoSize = {
  w: 100,
  h: 100 * DEFAULT_LOGO_HEIGHT / DEFAULT_LOGO_WIDTH,
};

export default function Home() {
  const [searchMode, setSearchMode] = useState('simple');
  const [drugList, setDrugList] = useState<string[]>([]);
  const [diseaseList, setDiseaseList] = useState<{TERM: string, des: string}[]>([]);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [hasDrugSearched, setHasDrugSearched] = useState(false);
  const [isTabSwitching, setIsTabSwitching] = useState(false);

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

  useEffect(() => {
    daGetOverallStudyType().then((overall_study_type: any) => {
      setOverallStudyType(overall_study_type);
    });
    daGetDrugList().then((data: any) => {
      const drugs = (data.druglist as Array<{name: string, type: string}>).filter(
        (item) => item.type == "drug"
      ).map(item => item.name);
      setDrugList(drugs);
    });
    // postTest();
  }, []);

  useEffect(() => {
    if (searchMode === 'advanced' && diseaseList.length === 0) {
      daGetDiseaseList().then((data: any) => {
        const diseases = (data.disease as Array<{TERM: string, des: string}>);
        setDiseaseList(diseases);
      });
    }
  }, [searchMode]);

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

    setChartLayout(newChartLayout);
    setPkChartData(newPkChartData);
    setPharmChartData(newPharmChartData);
    setClinicalChartData(newClinicalChartData);
  }, [populationData]);

  function handleTabChange(value: string) {
    setIsTabSwitching(true);
    setActiveTab(value);
    // Small delay to show loading state
    setTimeout(() => setIsTabSwitching(false), 150);
  }

  function handleSearch() {
    daGetConcepts(selectedDrug, selectedDisease).then((data: any) => {
      if (!data || data.length === 0) {
        return;
      }
      const concepts: ConceptRow[] = data as ConceptRow[];
      const isDrugConceptQueried = concepts.some(concept => concept.type === "drug");
      setHasDrugSearched(isDrugConceptQueried);
      console.log("data");
      console.log(data);
      setConcepts(data);
      // daGetExtraData(data, "atc").then((atcData: any) => {
      //   console.log("atcData");
      //   console.log(atcData);
      // });
      const searchType: SearchType = [];
      if (selectedDrug) {
        searchType.push("Drug");
      }
      if (selectedDisease) {
        searchType.push("Disease");
      }
      daGetPMIDs(data, searchType).then((pmidData: any) => {
        // console.log(pmidData);
        daGetTypePopulation(pmidData).then((typeData: any) => {
          // console.log("typeData");
          // console.log(typeData);
          const summaryStats = calculateSummaryStats(typeData);
          // console.log(summaryStats);
          // update overallStudyType
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
        daGetStudy(pmidData).then((studyData: any) => {
          console.log("studyData");
          console.log(studyData);
        });
      });
    });
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
                  <Image src="/images/mprint-logo.png" alt="mprint logo" width="180" height="60" />
                </a>              
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Knowledge Portal (Silver)</h1>
            </div>
            <nav className="flex space-x-8">
              <a href="#" className="text-blue-600 border-b-2 border-blue-600 px-1 py-2 text-sm font-medium">
                Explore
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-700 px-1 py-2 text-sm font-medium">
                How we help the comunity
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-700 px-1 py-2 text-sm font-medium">
                About
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar */}
        <div className={`${sidebarExpanded ? 'w-64' : 'w-16'} bg-gray-100 min-h-screen transition-all duration-300 ease-in-out relative overflow-visible`}>
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
                          onChange={(e) => setSearchMode(e.target.value)}
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
                          onClick={() => setSelectedDrug('')}
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
                            onClick={() => setSelectedDisease('')}
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
                  
                  <button 
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                    onClick={handleSearch}
                  >
                    Search
                  </button>
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
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">Study Data</span>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Download CSV
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">Population Data</span>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Download CSV
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">Chart Data</span>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Download JSON
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
          </Tabs.Root>
        </div>
      </div>
    </div>
  );
} 

