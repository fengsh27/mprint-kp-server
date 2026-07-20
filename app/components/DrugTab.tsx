'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Tree from "rc-tree";
import "rc-tree/assets/index.css";
import { Info, ChevronDown, X, ExternalLink } from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import 'react-data-grid/lib/styles.css';
import { DataGrid } from 'react-data-grid';
import { buildLabelStatsTable, buildLabelStatsColumns, LABEL_CHECKED, LabelStatsTableRow, RCTreeNode } from './component-utils';
import { build_atc_tree, getAtcCustomIcon } from './component-utils';
import { ConceptRow, EPCData, LabelStatsData, MOAData, PEData, PKData } from '../libs/database/types';
import { daGetExtraData, daGetLabelSection, LabelSectionResponse } from '../dataprovider/dataaccessor';

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

export default function DrugTab({ selectedDrug, concepts }: DrugTabProps) {
  const [pkData, setPkData] = useState<PKData[]>([]);
  const [epcTree, setEpcTree] = useState<RCTreeNode[]>([]);
  const [moaTree, setMoaTree] = useState<RCTreeNode[]>([]);
  const [peTree, setPeTree] = useState<RCTreeNode[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntries, setShowEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [atcTree, setAtcTree] = useState<RCTreeNode[]>([]);
  const [labelStatsData, setLabelStatsData] = useState<LabelStatsTableRow[]>([]);

  // Drawer showing the FDA label section text for a clicked ✅️ cell.
  const [section, setSection] = useState<{
    open: boolean;
    loading: boolean;
    error: string | null;
    sectionName: string;
    clickedTitle: string;
    clickedSetId: string;
    sourcedTitle: string | null; // label the shown text actually came from
    data: LabelSectionResponse | null;
  }>({
    open: false,
    loading: false,
    error: null,
    sectionName: '',
    clickedTitle: '',
    clickedSetId: '',
    sourcedTitle: null,
    data: null,
  });

  // Guards against a slower fallback loop overwriting a newer click's result.
  const sectionRequestRef = useRef(0);

  // labelColumns is memoized once, so its click handler would otherwise close
  // over the initial empty rows; read the latest rows through a ref instead.
  const labelStatsDataRef = useRef(labelStatsData);
  labelStatsDataRef.current = labelStatsData;

  // Cap how many sibling labels we try before giving up.
  const MAX_SECTION_ATTEMPTS = 8;

  const handleSectionClick = (
    setId: string,
    flagKey: string,
    sectionName: string,
    drugTitle: string
  ) => {
    const token = ++sectionRequestRef.current;

    // Some valid set_ids aren't served by DailyMed's XML API, so build a
    // fallback list: the clicked label first, then other rows of the same drug
    // that have this same section checked. The regulatory section text is
    // essentially the same across a drug's labels, so a live sibling answers
    // the same question.
    const seen = new Set<string>();
    const candidates: Array<{ setId: string; title: string }> = [];
    const addCandidate = (sid: string, title: string) => {
      if (sid && !seen.has(sid)) {
        seen.add(sid);
        candidates.push({ setId: sid, title });
      }
    };
    addCandidate(setId, drugTitle);
    for (const row of labelStatsDataRef.current) {
      if ((row as unknown as Record<string, string>)[flagKey] === LABEL_CHECKED) {
        addCandidate(row.set_id, row.TITLE);
      }
    }
    const tryList = candidates.slice(0, MAX_SECTION_ATTEMPTS);

    setSection({
      open: true,
      loading: true,
      error: null,
      sectionName,
      clickedTitle: drugTitle,
      clickedSetId: setId,
      sourcedTitle: null,
      data: null,
    });

    (async () => {
      for (const candidate of tryList) {
        try {
          const data = await daGetLabelSection(candidate.setId, flagKey);
          if (sectionRequestRef.current !== token) return; // superseded
          if (data.status === 'ok') {
            setSection((s) => ({ ...s, loading: false, data, sourcedTitle: candidate.title }));
            return;
          }
        } catch {
          if (sectionRequestRef.current !== token) return; // superseded
          // try the next candidate
        }
      }
      if (sectionRequestRef.current !== token) return;
      // No label could be displayed inline; the DailyMed link still works.
      setSection((s) => ({ ...s, loading: false, data: null, error: 'unavailable' }));
    })();
  };

  const closeSection = () => setSection((s) => ({ ...s, open: false }));

  const dailyMedLink = (setId: string) =>
    `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`;

  // Columns are rebuilt once so ✅️ cells carry the click handler.
  const labelColumns = useMemo(() => buildLabelStatsColumns(handleSectionClick), []);


  useEffect(() => {

    daGetExtraData(concepts, "atc").then((atcData: any) => {
      // console.log("atcData");
      // console.log(atcData);
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
    daGetExtraData(concepts, "pk").then((data: any) => {
      
      const pkData = data as PKData[];
      setPkData(pkData);
    });
    daGetExtraData(concepts, "label_stats").then((data: any) => {
      const labelStatsData = data as LabelStatsData[];
      setLabelStatsData(buildLabelStatsTable(labelStatsData));
    });
    if (selectedDrug) {
      
      // Note: PK data will be populated from API call above
    }
  }, [selectedDrug]);

  const filteredPkData = pkData.filter(item =>
    item.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.value.toLowerCase().includes(searchTerm.toLowerCase())
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
          <Accordion.Root
            type="multiple"
            defaultValue={["drug-classification"]}
            className="w-full space-y-4"
          >
            {/* Drug Classification Accordion */}
            <Accordion.Item value="drug-classification" className="border border-gray-200 rounded-lg bg-white shadow-sm">
              <Accordion.Header className="flex">
                <Accordion.Trigger className="group flex-1 flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors rounded-t-lg data-[state=open]:bg-blue-50 data-[state=open]:border-b data-[state=open]:border-blue-200">
                <div className="flex items-center">
                  <Info className="w-5 h-5 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Drug Classification</h3>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-200 ease-[cubic-bezier(0.87,_0,_0.13,_1)] group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="px-6 pb-6">
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
                          />
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
                          />
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
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>

          {/* PK Information Accordion */}
            <Accordion.Item value="pk-information" className="border border-gray-200 rounded-lg bg-white shadow-sm">
              <Accordion.Header className="flex">
                <Accordion.Trigger className="group flex-1 flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors data-[state=open]:bg-blue-50 data-[state=open]:border-b data-[state=open]:border-blue-200">
                <div className="flex items-center">
                  <Info className="w-5 h-5 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">PK Information</h3>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-200 ease-[cubic-bezier(0.87,_0,_0.13,_1)] group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="px-6 pb-6">
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
                            {item.value}
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
            </Accordion.Content>
          </Accordion.Item>

          {/* Maternal and Pediatric Use in Labels Accordion */}
            <Accordion.Item value="maternal-pediatric" className="border border-gray-200 rounded-lg bg-white shadow-sm">
              <Accordion.Header className="flex">
                <Accordion.Trigger className="group flex-1 flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors data-[state=open]:bg-blue-50 data-[state=open]:border-b data-[state=open]:border-blue-200">
                <div className="flex items-center">
                  <Info className="w-5 h-5 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Maternal and Pediatric Use in Labels</h3>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-200 ease-[cubic-bezier(0.87,_0,_0.13,_1)] group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="px-6 pb-6">
                <div className="space-y-4">
                                     <div className="h-96">
                     <DataGrid
                       columns={labelColumns}
                       rows={labelStatsData}
                       className="rdg-light"
                       style={{ height: '100%' }}
                       defaultColumnOptions={{
                         resizable: true,
                         sortable: true,
                       }}
                     />
                   </div>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </div>

      {/* FDA label section drawer */}
      {section.open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeSection}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${section.sectionName} label section`}
            className="relative h-full w-full max-w-xl bg-white shadow-xl flex flex-col"
          >
            <div className="flex items-start justify-between border-b border-gray-200 p-4">
              <div className="pr-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {section.data?.section_name || section.sectionName}
                </h3>
                <p className="text-sm text-gray-500 truncate" title={section.clickedTitle}>
                  {section.clickedTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSection}
                className="text-gray-400 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm text-gray-800">
              {section.loading && (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              )}

              {!section.loading && section.error && (
                <p className="text-gray-600">
                  This “{section.sectionName}” section can’t be displayed here. Use the
                  link below to read the full label on DailyMed.
                </p>
              )}

              {!section.loading && !section.error && section.data?.status === 'ok' && (
                <>
                  {section.sourcedTitle && section.sourcedTitle !== section.clickedTitle && (
                    <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      The label you selected isn’t available from DailyMed’s data
                      service. Showing this section from a related label:{' '}
                      <span className="font-medium">{section.sourcedTitle}</span>.
                    </p>
                  )}
                  <div
                    className="label-section-content space-y-2 [&_h4]:font-semibold [&_h4]:mt-3 [&_table]:w-full [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_ul]:list-disc [&_ul]:pl-5"
                    // Server-sanitized: only whitelisted tags are emitted and all
                    // text nodes are HTML-escaped in extract-section.ts.
                    dangerouslySetInnerHTML={{ __html: section.data.html }}
                  />
                </>
              )}
            </div>

            <div className="border-t border-gray-200 p-4">
              <a
                href={
                  section.data?.status === 'ok' && section.data.source_url
                    ? section.data.source_url
                    : dailyMedLink(section.clickedSetId)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                View full label on DailyMed
                <ExternalLink className="w-4 h-4" />
              </a>
              <p className="mt-1 text-xs text-gray-400">
                Source: U.S. National Library of Medicine, DailyMed
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
