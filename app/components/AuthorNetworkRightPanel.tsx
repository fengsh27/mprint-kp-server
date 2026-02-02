'use client';

import React from 'react';
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
  return (
    <div
      className={`${rightPanelExpanded ? '' : 'w-14'} bg-gray-100 rounded-lg min-h-[560px] transition-all duration-300 ease-in-out relative overflow-visible flex-none ${rightPanelExpanded ? 'min-w-[320px]' : 'min-w-[56px]'}`}
      style={rightPanelExpanded ? { width: panelWidth } : undefined}
    >
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
      <div className={`${rightPanelExpanded ? 'p-3' : 'p-1'} mt-8`}>
        {rightPanelExpanded ? (
          <div className="bg-white rounded-lg shadow-sm p-3 space-y-3">
            <div className="font-medium text-gray-900">Authors</div>

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
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50 text-xs"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(1)}
                  aria-label="First page"
                >
                  {'<<'}
                </button>
                <button
                  type="button"
                  className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50 text-xs"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  aria-label="Previous page"
                >
                  {'<'}
                </button>
                <button
                  type="button"
                  className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50 text-xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  aria-label="Next page"
                >
                  {'>'}
                </button>
                <button
                  type="button"
                  className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50 text-xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(totalPages)}
                  aria-label="Last page"
                >
                  {'>>'}
                </button>
              </div>
            </div>

            <div className="h-[360px] overflow-hidden">
              <DataGrid
                columns={gridColumns}
                rows={paginatedRows}
                className="rdg-light"
                rowKeyGetter={(row) => row.id}
                rowClass={(row) => (row.id === selectedAuthorId ? 'bg-blue-50' : '')}
                onCellClick={(args) => {
                  onAuthorSelect(args.row.author, args.row.id);
                }}
                defaultColumnOptions={{ resizable: false, sortable: true }}
                style={{ height: '100%', width: '100%' }}
                rowHeight={36}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{filteredCount} results</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center text-xs text-gray-400 h-[460px]">Authors</div>
        )}
      </div>
    </div>
  );
}
