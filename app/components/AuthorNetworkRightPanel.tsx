'use client';

import React, { useRef, useEffect } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import 'react-data-grid/lib/styles.css';
import { DataGrid } from 'react-data-grid';

type AuthorGridRow = {
  id: string;
  author: string;
  paperCount: number;
  pmids: string;
  affiliations: string;
};

type AuthorNetworkRightPanelProps = {
  rightPanelExpanded: boolean;
  setRightPanelExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  panelWidth: number;
  setPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  showAllAuthors: boolean;
  setShowAllAuthors: React.Dispatch<React.SetStateAction<boolean>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
  currentPage: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  filteredCount: number;
  paginatedRows: AuthorGridRow[];
  gridColumns: {
    key: string;
    name: string;
    resizable?: boolean;
    sortable?: boolean;
    renderCell?: (props: { row: AuthorGridRow }) => React.ReactNode;
  }[];
  selectedAuthorId: string | null;
  onAuthorSelect: (author: string, id: string) => void;
};

export default function AuthorNetworkRightPanel({
  rightPanelExpanded,
  setRightPanelExpanded,
  panelWidth,
  setPanelWidth,
  showAllAuthors,
  setShowAllAuthors,
  searchTerm,
  setSearchTerm,
  pageSize,
  setPageSize,
  currentPage,
  totalPages,
  setPage,
  filteredCount,
  paginatedRows,
  gridColumns,
  selectedAuthorId,
  onAuthorSelect
}: AuthorNetworkRightPanelProps) {
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const { startX, startWidth } = resizeStartRef.current;
      const delta = startX - event.clientX;
      const nextWidth = Math.min(720, Math.max(320, startWidth + delta));
      setPanelWidth(nextWidth);
    };
    const handleMouseUp = () => {
      resizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setPanelWidth]);

  return (
    <div
      className={`${rightPanelExpanded ? '' : 'w-14'} bg-gray-100 rounded-lg min-h-[560px] transition-all duration-300 ease-in-out relative overflow-visible ${rightPanelExpanded ? 'min-w-[320px]' : 'min-w-[56px]'}`}
      style={rightPanelExpanded ? { width: panelWidth } : undefined}
    >
      {rightPanelExpanded && (
        <div
          className="absolute left-0 top-0 h-full w-3 cursor-col-resize bg-transparent hover:bg-blue-200/40 z-20"
          onMouseDown={(event) => {
            event.preventDefault();
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            resizeStartRef.current = { startX: event.clientX, startWidth: panelWidth };
          }}
        />
      )}
      <button
        onClick={() => setRightPanelExpanded((prev) => !prev)}
        className="absolute top-2 left-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors z-10 shadow-md"
        title={rightPanelExpanded ? 'Collapse panel' : 'Expand panel'}
      >
        {rightPanelExpanded ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        )}
      </button>
      <div className={`${rightPanelExpanded ? 'p-2' : 'p-1'} mt-8`}>
        {rightPanelExpanded ? (
          <Accordion.Root type="multiple" defaultValue={["authors"]} className="space-y-4">
            <Accordion.Item value="authors" className="bg-white rounded-lg shadow-sm">
              <Accordion.Trigger className="group flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 transition-colors rounded-lg">
                <span className="font-medium text-gray-900">Authors</span>
                <ChevronDownIcon className="w-5 h-5 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
              <Accordion.Content className="px-3 pb-3">
                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600">Current Page</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={showAllAuthors}
                        onChange={(event) => setShowAllAuthors(event.target.checked)}
                        aria-label="Toggle author scope"
                      />
                      <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </label>
                    <span className="text-xs text-gray-600">All Authors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Search</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Author, PMID, affiliation"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <label>Show</label>
                      <select
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setPage(1);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <label>rows</label>
                    </div>
                    <div className="text-xs text-gray-500">
                      {filteredCount} results
                    </div>
                  </div>
                  <div className="h-[360px]">
                    <DataGrid
                      columns={gridColumns}
                      rows={paginatedRows}
                      className="rdg-light"
                      rowKeyGetter={(row) => row.id}
                      rowClass={(row) => (row.id === selectedAuthorId ? 'bg-blue-50' : '')}
                      onCellClick={(args) => {
                        onAuthorSelect(args.row.author, args.row.id);
                      }}
                      defaultColumnOptions={{ resizable: true, sortable: true }}
                      style={{ height: '100%' }}
                      rowHeight={36}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                        disabled={currentPage <= 1}
                        onClick={() => setPage(Math.max(1, currentPage - 1))}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        ) : (
          <div className="flex items-center justify-center text-xs text-gray-400 h-[460px]">Authors</div>
        )}
      </div>
    </div>
  );
}
