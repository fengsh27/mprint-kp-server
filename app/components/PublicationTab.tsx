'use client';

import React, { useState, useEffect } from 'react';
import 'react-data-grid/lib/styles.css';
import { DataGrid } from 'react-data-grid';
// import { daGetStudy } from '../dataprovider/dataaccessor';
// import { PmidRow, StudyData, TypeData } from '../libs/database/types';
import { PublicationTableRow } from './component-utils';

// Custom styles for better text wrapping
const customStyles = `
  .rdg-cell {
    white-space: normal !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
    line-height: 1.4 !important;
    padding: 8px !important;
  }
  
  .rdg-header-row {
    white-space: nowrap !important;
  }
  
  .rdg-cell a {
    cursor: pointer !important;
  }
  
  .rdg-cell a:hover {
    cursor: pointer !important;
  }
  
  .rdg-cell a[href*="pubmed"] {
    cursor: pointer !important;
  }
  
  .rdg-cell a[href*="pubmed"]:hover {
    cursor: pointer !important;
  }
  
  /* Force cursor pointer on all links in DataGrid */
  .rdg-cell *[style*="cursor: pointer"] {
    cursor: pointer !important;
  }
`;

const PublicationTableColumns = [
  {
    key: "PMID",
    name: "PMID",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div className="break-words">
        <a 
          href={`https://pubmed.ncbi.nlm.nih.gov/${row[column.key]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors duration-200"
          style={{ 
            cursor: 'pointer',
            display: 'inline-block',
            textDecoration: 'underline'
          }}
          
        >
          {row[column.key]}
        </a>
      </div>
    ),
  },
  {
    key: "Year",
    name: "YEAR",
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div className="text-center">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "Title",
    name: "TITLE",
    width: 400,
    minWidth: 200,
    maxWidth: 500,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div className="break-words">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "StudyType",
    name: "STUDY TYPE",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div className="break-words">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "Population",
    name: "POPULATION",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div className="break-words">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "StudiedDrugs",
    name: "STUDIED DRUGS",
    width: 250,
    minWidth: 120,
    maxWidth: 400,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div className="break-words">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "StudiedDiseases",
    name: "STUDIED DISEASES",
    width: 250,
    minWidth: 120,
    maxWidth: 400,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div className="break-words">
        {row[column.key]}
      </div>
    ),
  },
];

export interface PublicationTabProps {
  publicationData: PublicationTableRow[];
  // pmidData: PmidRow[];
  // typeData: TypeData[];
}

export default function PublicationTab({ publicationData }: PublicationTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntries, setShowEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  // const [publicationData, setPublicationData] = useState<PublicationTableRow[]>([]);

  const filteredData = publicationData.filter(item =>
    Object.values(item).some(value =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredData.length / showEntries);
  const startIndex = (currentPage - 1) * showEntries;
  const endIndex = startIndex + showEntries;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // useEffect(() => {
  //   daGetStudy(pmidData).then((data: any) => {
  //     const studyData = data as StudyData[];
  //     const publicationData = buildPublicationTable(studyData, typeData);
  //     setPublicationData(publicationData);
  //   });
  // }, [pmidData, typeData]);

  if (publicationData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-lg">No publication data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      
      {/* Search and Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Show</label>
          <select
            value={showEntries}
            onChange={(e) => {
              setShowEntries(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <label className="text-sm text-gray-600">entries</label>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Search:</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search publications..."
            className="border border-gray-300 rounded px-3 py-1 text-sm w-48"
          />
        </div>
      </div>

      {/* DataGrid */}
      <div className="min-h-[600px]">
        <DataGrid 
          columns={PublicationTableColumns} 
          rows={paginatedData} 
          className="rdg-light"
          style={{height: '100%'}}
          defaultColumnOptions={{
            resizable: true,
            sortable: true,
          }}
          rowHeight={80}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            
            {/* Smart Page Numbers */}
            {(() => {
              const pages = [];
              const maxVisiblePages = 7; // Show max 7 page numbers
              
              if (totalPages <= maxVisiblePages) {
                // If total pages is small, show all pages
                for (let i = 1; i <= totalPages; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`px-3 py-1 text-sm border rounded ${
                        currentPage === i
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }
              } else {
                // Smart pagination with ellipsis
                const leftBound = Math.max(1, currentPage - 2);
                const rightBound = Math.min(totalPages, currentPage + 2);
                
                // Always show first page
                pages.push(
                  <button
                    key={1}
                    onClick={() => setCurrentPage(1)}
                    className={`px-3 py-1 text-sm border rounded ${
                      currentPage === 1
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    1
                  </button>
                );
                
                // Add left ellipsis if needed
                if (leftBound > 2) {
                  pages.push(
                    <span key="left-ellipsis" className="px-2 py-1 text-gray-500">
                      ...
                    </span>
                  );
                }
                
                // Add middle pages around current page
                for (let i = leftBound; i <= rightBound; i++) {
                  if (i > 1 && i < totalPages) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`px-3 py-1 text-sm border rounded ${
                          currentPage === i
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                }
                
                // Add right ellipsis if needed
                if (rightBound < totalPages - 1) {
                  pages.push(
                    <span key="right-ellipsis" className="px-2 py-1 text-gray-500">
                      ...
                    </span>
                  );
                }
                
                // Always show last page
                if (totalPages > 1) {
                  pages.push(
                    <button
                      key={totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className={`px-3 py-1 text-sm border rounded ${
                        currentPage === totalPages
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {totalPages}
                    </button>
                  );
                }
              }
              
              return pages;
            })()}
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
