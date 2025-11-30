'use client';

import { Search, Download, Info, ChevronDownIcon } from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import VirtualizedSelect from './VirtualizedSelect';
import DrugClassSelect from './DrugClassSelect';

interface LeftPanelProps {
  searchMode: string;
  onSearchModeChange: (e: any) => void;
  drugList: string[];
  diseaseList: Array<{TERM: string, des: string}>;
  selectedDrug: string;
  selectedDisease: string;
  selectedDrugClass: string;
  drugClassHierarchy: {level1: string[], level2: string[], level3: string[]};
  onDrugChange: (drug: string) => void;
  onDiseaseChange: (disease: string) => void;
  onDrugClassChange: (drugClass: string) => void;
  onSearch: () => void;
  onClearAll: () => void;
  publicationData: any[];
  downloadType: 'xlsx' | 'csv' | 'tsv';
  onDownloadTypeChange: (type: 'xlsx' | 'csv' | 'tsv') => void;
  onDownload: () => void;
  pmidData: any[];
  typeData: any[];
  sidebarExpanded: boolean;
  onSidebarToggle: () => void;
}

export default function LeftPanel({
  searchMode,
  onSearchModeChange,
  drugList,
  diseaseList,
  selectedDrug,
  selectedDisease,
  selectedDrugClass,
  drugClassHierarchy,
  onDrugChange,
  onDiseaseChange,
  onDrugClassChange,
  onSearch,
  onClearAll,
  publicationData,
  downloadType,
  onDownloadTypeChange,
  onDownload,
  pmidData,
  typeData,
  sidebarExpanded,
  onSidebarToggle,
}: LeftPanelProps) {
  return (
    <div className={`${sidebarExpanded ? 'w-64' : 'w-16'} bg-gray-100 min-h-screen transition-all duration-300 ease-in-out relative overflow-visible ${sidebarExpanded ? 'min-w-[250px]' : 'min-w-[64px]'}`}>
      {/* Toggle Button */}
      <button
        onClick={onSidebarToggle}
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
              <Accordion.Trigger className="group flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 transition-colors rounded-lg">
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
                          onChange={onSearchModeChange}
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
                          onChange={onSearchModeChange}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Advanced</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="searchMode"
                          value="drugclass"
                          checked={searchMode === 'drugclass'}
                          onChange={onSearchModeChange}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Drug Class</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Drug Name Field - Only shown in Simple and Advanced modes */}
                  {searchMode !== 'drugclass' && (
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
                            onValueChange={onDrugChange}
                            placeholder="Select a drug"
                            options={drugList.map(drug => ({ value: drug, label: drug }))}
                            searchPlaceholder="Search drugs..."
                            maxHeight={300}
                            itemHeight={40}
                          />
                        
                        {selectedDrug && (
                          <button
                            onClick={onClearAll}
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
                  
                  {/* Drug Class Field - Only shown in Drug Class mode */}
                  {searchMode === 'drugclass' && (
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Drug Class:
                      </label>
                      <div className="absolute left-20 top-1 w-4 h-4" title="Select a drug class to search" >
                        <Info className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="relative">
                        <DrugClassSelect
                          value={selectedDrugClass}
                          onValueChange={onDrugClassChange}
                          placeholder="Select a drug class"
                          hierarchy={drugClassHierarchy}
                          searchPlaceholder="Search drug classes..."
                        />
                        
                        {selectedDrugClass && (
                          <button
                            onClick={() => {
                              try {
                                onDrugClassChange('');
                              } catch (error) {
                                console.warn('Error clearing drug class selection:', error);
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
                          onValueChange={onDiseaseChange}
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
                                onDiseaseChange('');
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
                  
                  {searchMode !== 'drugclass' && searchMode !== 'simple' && (
                    <div className="flex space-x-2">
                      <button 
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                        onClick={onSearch}
                      >
                        Search
                      </button>
                      <button 
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                        onClick={onClearAll}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </Accordion.Content>
            </Accordion.Item>

            {/* Download Data Section */}
            <Accordion.Item value="download" className="bg-white rounded-lg shadow-sm">
              <Accordion.Trigger className="group flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 transition-colors rounded-lg">
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
                        onChange={() => onDownloadTypeChange('xlsx')}
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
                        onChange={() => onDownloadTypeChange('csv')}
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
                        onChange={() => onDownloadTypeChange('tsv')}
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
                      onClick={onDownload}
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
  );
}

