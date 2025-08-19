'use client';

import React, { useState, useEffect } from 'react';
import Tree from "rc-tree";
import "rc-tree/assets/index.css";
import { Info } from 'lucide-react';
import { RCTreeNode } from './component-utils';
import { build_atc_tree, getAtcCustomIcon } from './component-utils';
import { ConceptRow, EPCData, MOAData, PEData } from '../libs/database/types';
import { daGetExtraData } from '../dataprovider/dataaccessor';

// Custom CSS for tree styling
const treeStyles = `
  .custom-tree .rc-tree-node-content-wrapper {
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .custom-tree .rc-tree-node-content-wrapper:hover {
    background-color: #f3f4f6;
  }
  
  .custom-tree .rc-tree-node-content-wrapper.rc-tree-node-selected {
    background-color: #dbeafe;
    color: #1e40af;
  }
  
  .custom-tree .rc-tree-treenode {
    margin: 2px 0;
  }
  
  .custom-tree .rc-tree-iconEle {
    margin-right: 8px;
    display: flex;
    align-items: center;
  }
  
  .custom-tree .rc-tree-title {
    font-size: 14px;
    font-weight: 500;
  }
`;

interface DrugTabProps {
  selectedDrug: string;
  concepts: ConceptRow[];
}

interface PKProperty {
  property: string;
  description: string;
}

export default function DrugTab({ selectedDrug, concepts }: DrugTabProps) {
  const [pkData, setPkData] = useState<PKProperty[]>([]);
  const [epcTree, setEpcTree] = useState<RCTreeNode[]>([]);
  const [moaTree, setMoaTree] = useState<RCTreeNode[]>([]);
  const [peTree, setPeTree] = useState<RCTreeNode[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntries, setShowEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [atcTree, setAtcTree] = useState<RCTreeNode[]>([]);

  useEffect(() => {

    daGetExtraData(concepts, "atc").then((atcData: any) => {
      console.log("atcData");
      console.log(atcData);
      // setAtcData(atcData);
      const atc_tree = build_atc_tree(atcData);
      setAtcTree(atc_tree);
    });
    daGetExtraData(concepts, "epc").then((data: any) => {
      const epcData = data as EPCData[];
      const theEpcTree: RCTreeNode[] = [{
        key: "Established Pharmacology Class:",
        title: "Established Pharmacology Class:",
        children: epcData.map((item) => ({
          key: item.EPC,
          title: item.EPC,
          children: [],
          level: 1
        })),
        level: 0
      }];

      setEpcTree(theEpcTree);
    });
    daGetExtraData(concepts, "moa").then((data: any) => {
      const moaData = data as MOAData[];
      const theMoaTree: RCTreeNode[] = [{
        key: "Mechanism of Action:",
        title: "Mechanism of Action:",
        children: moaData.map((item) => ({
          key: item.MOA,
          title: item.MOA,
          children: [],
          level: 1,
        })),
        level: 0
      }];

      setMoaTree(theMoaTree);
    });
    daGetExtraData(concepts, "pe").then((data: any) => {
      const peData = data as PEData[];
      const thePeTree: RCTreeNode[] = [{
        key: "Physiology Effect:",
        title: "Physiology Effect:",
        children: peData.map((item) => ({
          key: item.PE,
          title: item.PE,
          children: [],
          level: 1,
        })),
        level: 0
      }];

      setPeTree(thePeTree);
    });
    daGetExtraData(concepts, "pk").then((pkData: any) => {
      console.log("pkData");
      console.log(pkData);
      // setPkData(pkData);
    });
    if (selectedDrug) {
      
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
    <>
      <style dangerouslySetInnerHTML={{ __html: treeStyles }} />
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
              <Tree 
                treeData={atcTree} 
                icon={getAtcCustomIcon}
                showIcon={true}
                showLine={true}
                defaultExpandAll={false}
                defaultExpandedKeys={[]}
                className="custom-tree"
              />
            </div>
          </div>

          {/* EPC MOA PE */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">EPC MOA PE</h4>
            <div className="space-y-3">
              <div>
                <div className="text-gray-900 bg-white border border-gray-300 rounded px-3 py-2">
                  <Tree
                    treeData={epcTree}
                    icon={getAtcCustomIcon}
                    showIcon={true}
                    showLine={true}
                    defaultExpandAll={false}
                    defaultExpandedKeys={[]}
                    className="custom-tree"
                  ></Tree>
                </div>
              </div>
              <div>
                <div className="text-gray-900 bg-white border border-gray-300 rounded px-3 py-2">
                  <Tree
                    treeData={moaTree}
                    icon={getAtcCustomIcon}
                    showIcon={true}
                    showLine={true}
                    defaultExpandAll={false}
                    defaultExpandedKeys={[]}
                    className="custom-tree"
                  ></Tree>
                </div>
              </div>
              <div>
                <div className="text-gray-900 bg-white border border-gray-300 rounded px-3 py-2">
                  <Tree
                    treeData={peTree}
                    icon={getAtcCustomIcon}
                    showIcon={true}
                    showLine={true}
                    defaultExpandAll={false}
                    defaultExpandedKeys={[]}
                    className="custom-tree"
                  ></Tree>
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
    </>
  );
}
