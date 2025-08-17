'use client';

import { useState, useEffect } from 'react';
import { Search, Download, BarChart3, Edit, User, Plus, Info, ChevronDownIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import * as Accordion from '@radix-ui/react-accordion';
import * as Select from '@radix-ui/react-select';

import { getDiseaseList, getDrugList, getOverallStudyType, postTest } from "../dataprovider/dataaccessor";

// Dynamically import Plotly to prevent SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => <div className="w-full h-[300px] bg-gray-100 animate-pulse rounded"></div>
});

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
  const [drugSearchTerm, setDrugSearchTerm] = useState('');
  const [diseaseSearchTerm, setDiseaseSearchTerm] = useState('');
  const [drugDisplayCount, setDrugDisplayCount] = useState(50);
  const [diseaseDisplayCount, setDiseaseDisplayCount] = useState(50);
  const [diseaseDropdownOpen, setDiseaseDropdownOpen] = useState(false);
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

  useEffect(() => {
    getOverallStudyType().then((overall_study_type: any) => {
      setOverallStudyType(overall_study_type);
    });
    getDrugList().then((data: any) => {
      const drugs = (data.druglist as Array<{name: string, type: string}>).filter(
        (item) => item.type == "drug"
      ).map(item => item.name).sort();
      setDrugList(drugs);
    });
    // postTest();
  }, []);

  useEffect(() => {
    if (searchMode === 'advanced' && diseaseList.length === 0) {
      getDiseaseList().then((data: any) => {
        const diseases = (data.disease as Array<{TERM: string, des: string}>).sort(
          (a, b) => a.TERM.localeCompare(b.TERM)
        );
        setDiseaseList(diseases);
    });
    }
  }, [searchMode]);

  // Computed properties for lazy loading
  const filteredDrugs = drugList.filter(drug => 
    drug.toLowerCase().includes(drugSearchTerm.toLowerCase())
  );
  
  const filteredDiseases = diseaseList.filter(disease => 
    disease.TERM.toLowerCase().includes(diseaseSearchTerm.toLowerCase()) ||
    disease.des.toLowerCase().includes(diseaseSearchTerm.toLowerCase())
  );
  
  const displayedDrugs = filteredDrugs.slice(0, drugDisplayCount);
  const displayedDiseases = filteredDiseases.slice(0, diseaseDisplayCount);
  
  const populationData = [
    { name: 'Pediatric', pk: 270204, pharm: 630043, clinical: 139298, color: '#fbbf24' },
    { name: 'Fetus', pk: 37109, pharm: 60054, clinical: 9072, color: '#60a5fa' },
    { name: 'Premature', pk: 7716, pharm: 15098, clinical: 0, color: '#60a5fa' },
    { name: 'Newborn', pk: 62531, pharm: 130494, clinical: 28553, color: '#60a5fa' },
    { name: 'Neonate', pk: 29009, pharm: 60287, clinical: 14235, color: '#60a5fa' },
    { name: 'Infant', pk: 118132, pharm: 269421, clinical: 66022, color: '#60a5fa' },
    { name: 'Child', pk: 184057, pharm: 457026, clinical: 102569, color: '#60a5fa' },
    { name: 'Maternal', pk: 136152, pharm: 293668, clinical: 57541, color: '#fbbf24' },
    { name: 'Pregnant', pk: 85462, pharm: 187872, clinical: 34886, color: '#f87171' },
    { name: 'Labor', pk: 7254, pharm: 20170, clinical: 7385, color: '#f87171' },
    { name: 'Postpartum', pk: 8380, pharm: 19236, clinical: 4338, color: '#f87171' },
  ];

  // Filter out Premature for Clinical Trial chart as it has 0 value
  const clinicalData = populationData.filter(item => item.clinical > 0);

  // Chart configurations
  const chartLayout = {
    margin: { l: 60, r: 20, t: 40, b: 80 },
    showlegend: false,
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    font: { size: 10 },
    xaxis: {
      tickangle: -45,
      tickfont: { size: 10 },
      title: { text: 'Population', font: { size: 12 } }
    },
    yaxis: {
      tickfont: { size: 10 },
      title: { text: '', font: { size: 12 } },
      showticklabels: true
    }
  };

  const pkChartData = [{
    x: populationData.map(d => d.name),
    y: populationData.map(d => d.pk),
    type: 'bar' as const,
    marker: {
      color: populationData.map(d => d.color),
      line: { width: 1, color: '#374151' }
    },
    text: populationData.map(d => d.pk.toLocaleString()),
    textposition: 'outside' as const,
    textfont: { size: 10 }
  }];

  const pharmChartData = [{
    x: populationData.map(d => d.name),
    y: populationData.map(d => d.pharm),
    type: 'bar' as const,
    marker: {
      color: populationData.map(d => d.color),
      line: { width: 1, color: '#374151' }
    },
    text: populationData.map(d => d.pharm.toLocaleString()),
    textposition: 'outside' as const,
    textfont: { size: 10 }
  }];

  const clinicalChartData = [{
    x: clinicalData.map(d => d.name),
    y: clinicalData.map(d => d.clinical),
    type: 'bar' as const,
    marker: {
      color: clinicalData.map(d => d.color),
      line: { width: 1, color: '#374151' }
    },
    text: clinicalData.map(d => d.clinical.toLocaleString()),
    textposition: 'outside' as const,
    textfont: { size: 10 }
  }];

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
        <div className="w-80 bg-gray-100 min-h-screen p-6">
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
                                              <Select.Root value={selectedDrug} onValueChange={setSelectedDrug}>
                          <Select.Trigger className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white flex items-center justify-between">
                            <Select.Value placeholder="Select a drug" />
                            <Select.Icon className="text-gray-400">
                              <ChevronDownIcon className="w-4 h-4" />
                            </Select.Icon>
                          </Select.Trigger>
                          
                          <Select.Portal>
                            <Select.Content className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
                              <Select.Viewport className="p-1">
                                {/* Search Input */}
                                <div className="p-2 border-b border-gray-200">
                                  <input
                                    type="text"
                                    placeholder="Search drugs..."
                                    value={drugSearchTerm}
                                    onChange={(e) => setDrugSearchTerm(e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                
                                <Select.Item value=" " className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 rounded cursor-pointer">
                                  <Select.ItemText>Select</Select.ItemText>
                                </Select.Item>
                                
                                {displayedDrugs.map((item) => (
                                  <Select.Item 
                                    key={item} 
                                    value={item} 
                                    className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 rounded cursor-pointer"
                                  >
                                    <Select.ItemText>{item}</Select.ItemText>
                                  </Select.Item>
                                ))}
                                
                                {/* Load More Button */}
                                {filteredDrugs.length > drugDisplayCount && (
                                  <div className="p-2 border-t border-gray-200">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDrugDisplayCount(prev => Math.min(prev + 50, filteredDrugs.length));
                                      }}
                                      className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    >
                                      Load {Math.min(50, filteredDrugs.length - drugDisplayCount)} more...
                                    </button>
                                    </div>
                                )}
                                
                                {/* Results Count */}
                                {drugSearchTerm && (
                                  <div className="px-3 py-2 text-xs text-gray-500 text-center border-t border-gray-100">
                                    {filteredDrugs.length} of {drugList.length} drugs found
                                  </div>
                                )}
                              </Select.Viewport>
                            </Select.Content>
                          </Select.Portal>
                        </Select.Root>
                      
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
                        <div className="relative">
                          <button
                            onClick={() => setDiseaseDropdownOpen(!diseaseDropdownOpen)}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white flex items-center justify-between"
                          >
                            <span className={selectedDisease ? "text-gray-900" : "text-gray-500"}>
                              {selectedDisease || "Select a disease"}
                            </span>
                            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                          </button>
                          
                          {diseaseDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {/* Search Input */}
                              <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                                <input
                                  type="text"
                                  placeholder="Search diseases..."
                                  value={diseaseSearchTerm}
                                  onChange={(e) => setDiseaseSearchTerm(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              
                              {/* Select Option */}
                              <div 
                                className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                                onClick={() => {
                                  setSelectedDisease("");
                                  setDiseaseDropdownOpen(false);
                                }}
                              >
                                Select
                              </div>
                              
                              {/* Disease Options */}
                              {displayedDiseases.map((item, index) => (
                                <div 
                                  key={`${item.TERM}-${index}`}
                                  className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                                  onClick={() => {
                                    setSelectedDisease(item.TERM);
                                    setDiseaseDropdownOpen(false);
                                  }}
                                >
                                  <div className="max-w-[300px] flex flex-col">
                                    <div className="font-bold text-sm truncate" title={item.TERM}>{item.TERM}</div>
                                    <div className="text-gray-500 text-xs truncate mt-1" title={item.des}>{item.des}</div>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Load More Button */}
                              {filteredDiseases.length > diseaseDisplayCount && (
                                <div className="p-2 border-t border-gray-200">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDiseaseDisplayCount(prev => Math.min(prev + 50, filteredDiseases.length));
                                    }}
                                    className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  >
                                    Load {Math.min(50, filteredDiseases.length - diseaseDisplayCount)} more...
                                  </button>
                                </div>
                              )}
                              
                              {/* Results Count */}
                              {diseaseSearchTerm && (
                                <div className="px-3 py-2 text-xs text-gray-500 text-center border-t border-gray-100">
                                  {filteredDiseases.length} of {diseaseList.length} diseases found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
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
                  
                  <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
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
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white p-8">
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Overview</span>
              </button>
            </nav>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold text-blue-600">{overallStudyType.pk.count}</p>
                  <p className="text-gray-600 mt-1">Pharmacokinetics</p>
                </div>
                <Edit className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold text-blue-600">{overallStudyType.pe.count}</p>
                  <p className="text-gray-600 mt-1">Pharmacoepidemiology</p>
                </div>
                <Edit className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold text-blue-600">{overallStudyType.ct.count}</p>
                  <p className="text-gray-600 mt-1">Clinical Trial</p>
                </div>
                <User className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-3 gap-6">
            {/* PK Study Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">PK study by population</h3>
              <Plot
                data={pkChartData}
                layout={{
                  ...chartLayout,
                  yaxis: { ...chartLayout.yaxis }
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%', height: '300px' }}
              />
            </div>

            {/* Pharmacoepidemiology Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pharmacoepidemiology study by population</h3>
              <Plot
                data={pharmChartData}
                layout={{
                  ...chartLayout,
                  yaxis: { ...chartLayout.yaxis }
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%', height: '300px' }}
              />
            </div>

            {/* Clinical Trial Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Clinical trial by population</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-white border border-gray-300 rounded flex items-center justify-center">
                    <Plus className="w-3 h-3 text-gray-600" />
                  </div>
                  <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
                  <div className="w-6 h-6 bg-pink-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    CA
                  </div>
                </div>
              </div>
              <Plot
                data={clinicalChartData}
                layout={{
                  ...chartLayout,
                  yaxis: { ...chartLayout.yaxis }
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%', height: '300px' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 