'use client';

import React, { useState, useEffect } from 'react';
import 'react-data-grid/lib/styles.css';
import { DataGrid } from 'react-data-grid';

interface PKModelData {
  MID: string;
  MODEL_TYPE: string;
  PUBLICATION: string;
  POPULATION: string;
  DRUG: string;
  DISEASE: string;
  PMID: string;
  TRAINING_DATA_REFERENCE: string;
  TRAINING_DATA: string;
  PROGRAM_CODE: string;
}

const PKModelsTableColumns = [
  {
    key: "MID",
    name: "MID",
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "MODEL_TYPE",
    name: "MODEL TYPE",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "PUBLICATION",
    name: "PUBLICATION",
    width: 200,
    minWidth: 150,
    maxWidth: 300,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "POPULATION",
    name: "POPULATION",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "DRUG",
    name: "DRUG",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "DISEASE",
    name: "DISEASE",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "PMID",
    name: "PMID",
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "TRAINING_DATA_REFERENCE",
    name: "TRAINING DATA REFERENCE",
    width: 180,
    minWidth: 150,
    maxWidth: 250,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "TRAINING_DATA",
    name: "TRAINING DATA",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
  {
    key: "PROGRAM_CODE",
    name: "PROGRAM/CODE",
    width: 150,
    minWidth: 120,
    maxWidth: 200,
    resizable: true,
    renderCell: ({ row, column }: { row: any; column: any }) => (
      <div title={row[column.key]} className="truncate">
        {row[column.key]}
      </div>
    ),
  },
];

export default function PKModelsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntries, setShowEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pkModelsData, setPkModelsData] = useState<any[]>([]);

  const filteredData = pkModelsData.filter(item =>
    Object.values(item).some(value =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredData.length / showEntries);
  const startIndex = (currentPage - 1) * showEntries;
  const endIndex = startIndex + showEntries;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  useEffect(() => {
    setPkModelsData([
      {
        MID: "MODEL001",
        MODEL_TYPE: "Population PK",
        PUBLICATION: "Pediatric PK Study",
        POPULATION: "Pediatric",
        DRUG: "Drug X",
        DISEASE: "Disease A",
        PMID: "12345678",
        TRAINING_DATA_REFERENCE: "Clinical Trial Data",
        TRAINING_DATA: "PK Profiles",
        PROGRAM_CODE: "NONMEM"
      },
      {
        MID: "MODEL002",
        MODEL_TYPE: "PBPK",
        PUBLICATION: "Maternal PK Modeling",
        POPULATION: "Maternal",
        DRUG: "Drug Y",
        DISEASE: "Disease B",
        PMID: "87654321",
        TRAINING_DATA_REFERENCE: "Literature Data",
        TRAINING_DATA: "PK Parameters",
        PROGRAM_CODE: "Simcyp"
      },
      {
        MID: "MODEL003",
        MODEL_TYPE: "Machine Learning",
        PUBLICATION: "Neonatal PBPK Study",
        POPULATION: "Neonatal",
        DRUG: "Drug Z",
        DISEASE: "Disease C",
        PMID: "11223344",
        TRAINING_DATA_REFERENCE: "Simulation Data",
        TRAINING_DATA: "PK Simulations",
        PROGRAM_CODE: "Python/Scikit-learn"
      }
    ]);
  }, []);

  if (!pkModelsData || pkModelsData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-lg">No PK models data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            placeholder="Search PK models..."
            className="border border-gray-300 rounded px-3 py-1 text-sm w-48"
          />
        </div>
      </div>

      {/* DataGrid */}
      <div className="h-96">
        <DataGrid 
          columns={PKModelsTableColumns} 
          rows={paginatedData} 
          className="rdg-light"
          style={{ height: '100%' }}
          defaultColumnOptions={{
            resizable: true,
            sortable: true,
          }}
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 text-sm border rounded ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
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
