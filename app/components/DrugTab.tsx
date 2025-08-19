'use client';

import React, { useState, useEffect } from 'react';
import { Info, ChevronRight } from 'lucide-react';

interface DrugTabProps {
  selectedDrug: string;
}

interface PKProperty {
  property: string;
  description: string;
}

interface ATCCategory {
  code: string;
  name: string;
  children?: ATCCategory[];
  isSelected?: boolean;
}

export default function DrugTab({ selectedDrug }: DrugTabProps) {
  const [pkData, setPkData] = useState<PKProperty[]>([]);
  const [atcData, setAtcData] = useState<ATCCategory[]>([]);
  const [epcData, setEpcData] = useState({
    establishedPharmacologyClass: '',
    mechanismOfAction: '',
    physiologyEffect: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntries, setShowEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (selectedDrug) {
      setAtcData([
        {
          code: 'B',
          name: 'BLOOD AND BLOOD FORMING ORGANS',
          isSelected: true,
          children: [
            {
              code: 'B02',
              name: 'ANTIHEMORRHAGICS',
              children: [
                {
                  code: 'B02B',
                  name: 'VITAMIN K AND OTHER HEMOSTATICS',
                  children: [
                    {
                      code: 'B02BA',
                      name: 'Vitamin K',
                      children: [
                        { code: 'B02BA01', name: 'Phylloquinone' }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]);

      setPkData([
        {
          property: 'absorption',
          description: 'Oral bioavailability of phylloquinone (Vitamin K) is approximately 80%. Tmax occurs at 2-4 hours. Plasma concentrations: 0.5-2.0 nmol/L (fasting), 2-10 nmol/L (postprandial). Cmax: 5-15 nmol/L (oral), 20-50 nmol/L (IM), 100-200 nmol/L (IV). AUC: 50-200 nmol·h/L (oral), 200-500 nmol·h/L (IM), 500-1000 nmol·h/L (IV).'
        },
        {
          property: 'half_life',
          description: 'Intravenous phylloquinone has an initial half life of 22 minutes, followed by a half life of 125 minutes.'
        },
        {
          property: 'protein_binding',
          description: 'Phylloquinone is primarily bound to lipoproteins in plasma, with approximately 90% bound to VLDL, LDL, and HDL.'
        }
      ]);

      setEpcData({
        establishedPharmacologyClass: 'Vitamin K agonist',
        mechanismOfAction: 'Acts as a cofactor for gamma-glutamyl carboxylase, which is required for the synthesis of functional clotting factors II, VII, IX, and X',
        physiologyEffect: 'Promotes blood clotting and bone metabolism through vitamin K-dependent protein synthesis'
      });
    }
  }, [selectedDrug]);

  const filteredPkData = pkData.filter(item =>
    item.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredPkData.length / showEntries);
  const startIndex = (currentPage - 1) * showEntries;
  const endIndex = startIndex + showEntries;
  const paginatedData = filteredPkData.slice(startIndex, endIndex);

  const renderATCTree = (categories: ATCCategory[], level: number = 0) => {
    return categories.map((category, index) => (
      <div key={`${category.code}-${index}`} className="ml-4">
        <div className={`flex items-center py-1 ${level === 0 ? 'font-semibold' : ''}`}>
          {category.children && category.children.length > 0 && (
            <ChevronRight className="w-4 h-4 mr-2 text-gray-500" />
          )}
          <span 
            className={`px-2 py-1 rounded cursor-pointer hover:bg-blue-50 ${
              category.isSelected ? 'bg-blue-100 text-blue-800' : 'text-gray-700'
            }`}
          >
            {category.code} {category.name}
          </span>
        </div>
        {category.children && (
          <div className="ml-4">
            {renderATCTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  if (!selectedDrug) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Info className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Please select a drug to view detailed information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Drug Classification Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center mb-4">
          <Info className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Drug Classification</h3>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ATC Classification */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">ATC Classification</h4>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {renderATCTree(atcData)}
            </div>
          </div>

          {/* EPC MOA PE */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">EPC MOA PE</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Established Pharmacology Class:
                </label>
                <div className="text-gray-900 bg-white border border-gray-300 rounded px-3 py-2">
                  {epcData.establishedPharmacologyClass}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Mechanism of Action:
                </label>
                <div className="text-gray-900 bg-white border border-gray-300 rounded px-3 py-2">
                  {epcData.mechanismOfAction}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Physiology Effect:
                </label>
                <div className="text-gray-900 bg-white border border-gray-300 rounded px-3 py-2">
                  {epcData.physiologyEffect}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PK Information Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center mb-4">
          <Info className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">PK Information</h3>
        </div>

        {/* Search and Pagination Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
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
              placeholder="Search PK properties..."
              className="border border-gray-300 rounded px-3 py-1 text-sm w-48"
            />
          </div>
        </div>

        {/* PK Data Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700">
                  PK PROPERTY
                </th>
                <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700">
                  DESCRIPTION
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900">
                    {item.property}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-sm text-gray-700">
                    {item.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredPkData.length)} of {filteredPkData.length} entries
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
    </div>
  );
}
