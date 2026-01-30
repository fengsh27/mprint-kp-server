'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDownIcon } from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import 'react-data-grid/lib/styles.css';
import { DataGrid } from 'react-data-grid';
import cytoscape from 'cytoscape';

const CytoscapeComponent = dynamic(() => import('react-cytoscapejs'), {
  ssr: false,
  loading: () => <div className="w-full h-[520px] bg-gray-100 animate-pulse rounded" />
});

type AuthorNode = {
  id: string;
  size: number;
};

type AuthorLink = {
  source: string;
  target: string;
  weight: number;
};

export type AuthorNetworkData = {
  nodes: AuthorNode[];
  links: AuthorLink[];
  authors?: {
    author: string;
    paperCount: number;
    pmids: string[];
    affiliations: string[];
  }[];
};

type AuthorNetworkTabProps = {
  data: AuthorNetworkData | null;
  isLoading: boolean;
  error?: string | null;
};

const DEFAULT_MIN_NODE_SIZE = 10;
const DEFAULT_MAX_NODE_SIZE = 40;
const DEFAULT_MIN_EDGE_WIDTH = 0.6;
const DEFAULT_MAX_EDGE_WIDTH = 2.6;
const NODE_COLORS = ['#4E79A7', '#59A14F', '#E15759', '#B07AA1', '#76B7B2', '#EDC948', '#F28E2B', '#FF9DA7', '#9C755F', '#BAB0AC'];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export default function AuthorNetworkTab({ data, isLoading, error }: AuthorNetworkTabProps) {
  const spacing = 1.0;
  const cyRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; content: string } | null>(null);
  const [isCyReady, setIsCyReady] = useState(false);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(true);
  const [panelWidth, setPanelWidth] = useState(420);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const panzoomReadyRef = useRef(false);

  const nodes = data?.nodes ?? [];
  const links = data?.links ?? [];
  const authorRows = data?.authors ?? [];

  const gridRows = useMemo(() => {
    return authorRows.map((row) => ({
      id: row.author,
      author: row.author,
      paperCount: row.paperCount,
      pmids: row.pmids.join(', '),
      affiliations: row.affiliations.join('; ')
    }));
  }, [authorRows]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return gridRows;
    return gridRows.filter((row) => {
      return (
        row.author.toLowerCase().includes(term) ||
        row.pmids.toLowerCase().includes(term) ||
        row.affiliations.toLowerCase().includes(term)
      );
    });
  }, [gridRows, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const gridColumns = useMemo(() => [
    { key: 'author', name: 'Author', resizable: true, sortable: true },
    { key: 'paperCount', name: 'Paper Count', resizable: true, sortable: true },
    {
      key: 'pmids',
      name: 'PMIDs',
      resizable: true,
      sortable: false,
      renderCell: ({ row }) => (
        <div className="overflow-x-auto whitespace-nowrap max-w-full" title={row.pmids}>
          {row.pmids}
        </div>
      )
    },
    { key: 'affiliations', name: 'Affiliation', resizable: true, sortable: false }
  ], []);

  const nodeSizeStats = useMemo(() => {
    let min = Infinity;
    let max = 0;
    nodes.forEach((node) => {
      min = Math.min(min, node.size);
      max = Math.max(max, node.size);
    });
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 1;
    return { min, max };
  }, [nodes]);

  const edgeWeightStats = useMemo(() => {
    let min = Infinity;
    let max = 0;
    links.forEach((link) => {
      min = Math.min(min, link.weight);
      max = Math.max(max, link.weight);
    });
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 1;
    return { min, max };
  }, [links]);

  const elements = useMemo(() => {
    const nodeElements = nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.id,
        size: node.size,
        paperCount: node.size,
        color: NODE_COLORS[hashString(node.id) % NODE_COLORS.length]
      }
    }));

    const edgeElements = links.map((link, index) => ({
      data: {
        id: `edge-${index}-${link.source}-${link.target}`,
        source: link.source,
        target: link.target,
        weight: link.weight
      }
    }));

    return [...nodeElements, ...edgeElements];
  }, [nodes, links]);

  const layout = useMemo(() => {
    return {
      name: 'concentric',
      animate: false,
      fit: false,
      padding: 20,
      concentric: (node: any) => node.data('size') ?? 1,
      levelWidth: () => 50 * spacing,
      minNodeSpacing: 10 * spacing
    } as const;
  }, [spacing]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (panzoomReadyRef.current) return;
    let isMounted = true;
    Promise.all([import('jquery'), import('cytoscape-panzoom')])
      .then(([jqueryModule, panzoomModule]) => {
        if (!isMounted) return;
        const jq = (jqueryModule as any).default ?? jqueryModule;
        const register = (panzoomModule as any).default ?? panzoomModule;
        register(cytoscape, jq);
        panzoomReadyRef.current = true;
        if (cyRef.current?.panzoom && !cyRef.current.data('panzoom')) {
          cyRef.current.panzoom();
          cyRef.current.data('panzoom', true);
        }
      })
      .catch(() => {
        // ignore panzoom init failures
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.layout(layout).run();
    cy.once('layoutstop', () => {
      cy.fit(undefined, 40);
      cy.userZoomingEnabled(true);
      cy.userPanningEnabled(true);
    });
  }, [layout]);

  useEffect(() => {
    if (!isCyReady || !cyRef.current) return;
    const cy = cyRef.current;
    const getTooltipPosition = (pos: { x: number; y: number }) => {
      if (!containerRef.current || !cy.container) {
        return { x: pos.x + 12, y: pos.y + 12 };
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const cyRect = cy.container().getBoundingClientRect();
      const offsetX = cyRect.left - containerRect.left;
      const offsetY = cyRect.top - containerRect.top;
      const maxWidth = 220;
      const maxHeight = 90;
      let x = offsetX + pos.x + 12;
      let y = offsetY + pos.y + 12;
      x = Math.max(8, Math.min(x, containerRect.width - maxWidth));
      y = Math.max(8, Math.min(y, containerRect.height - maxHeight));
      return { x, y };
    };
    const showNodeHover = (event: any) => {
      const node = event.target;
      cy.elements().style('opacity', 0.05);
      node.closedNeighborhood().style('opacity', 1);
      const collaboratorCount = node.neighborhood('node').length;
      const pos = node.renderedPosition();
      const coords = getTooltipPosition(pos);
      setHoverInfo({
        x: coords.x,
        y: coords.y,
        content: `Author: ${node.data('label')}\nPapers: ${node.data('paperCount') ?? 0}\nCollaborators: ${collaboratorCount}`
      });
    };
    const showEdgeHover = (event: any) => {
      const edge = event.target;
      cy.elements().style('opacity', 0.05);
      edge.connectedNodes().style('opacity', 1);
      edge.style('opacity', 1);
      const pos = edge.renderedMidpoint ? edge.renderedMidpoint() : edge.source().renderedPosition();
      const coords = getTooltipPosition(pos);
      setHoverInfo({
        x: coords.x,
        y: coords.y,
        content: `${edge.source().data('label')} ↔ ${edge.target().data('label')}\nCoauthored: ${edge.data('weight')}`
      });
    };
    const clearHover = () => {
      cy.elements().style('opacity', 1);
      setHoverInfo(null);
    };
    cy.on('mouseenter', 'node', showNodeHover);
    cy.on('mouseenter', 'edge', showEdgeHover);
    cy.on('mouseleave', 'node', clearHover);
    cy.on('mouseleave', 'edge', clearHover);
    return () => {
      cy.off('mouseenter', 'node', showNodeHover);
      cy.off('mouseenter', 'edge', showEdgeHover);
      cy.off('mouseleave', 'node', clearHover);
      cy.off('mouseleave', 'edge', clearHover);
    };
  }, [isCyReady]);

  useEffect(() => {
    if (!isCyReady || !cyRef.current) return;
    const cy = cyRef.current;
    const getTooltipPosition = (pos: { x: number; y: number }) => {
      if (!containerRef.current || !cy.container) {
        return { x: pos.x + 12, y: pos.y + 12 };
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const cyRect = cy.container().getBoundingClientRect();
      const offsetX = cyRect.left - containerRect.left;
      const offsetY = cyRect.top - containerRect.top;
      const maxWidth = 220;
      const maxHeight = 90;
      let x = offsetX + pos.x + 12;
      let y = offsetY + pos.y + 12;
      x = Math.max(8, Math.min(x, containerRect.width - maxWidth));
      y = Math.max(8, Math.min(y, containerRect.height - maxHeight));
      return { x, y };
    };
    const handleEdgeClick = (event: any) => {
      const edge = event.target;
      cy.elements().unselect();
      edge.select();
      const pos = edge.renderedMidpoint ? edge.renderedMidpoint() : edge.source().renderedPosition();
      const coords = getTooltipPosition(pos);
      setHoverInfo({
        x: coords.x,
        y: coords.y,
        content: `${edge.source().data('label')} ↔ ${edge.target().data('label')}\nCoauthored: ${edge.data('weight')}`
      });
    };
    cy.on('tap', 'edge', handleEdgeClick);
    const handleNodeClick = (event: any) => {
      const node = event.target;
      cy.elements().unselect();
      node.select();
      const collaboratorCount = node.neighborhood('node').length;
      const pos = node.renderedPosition();
      const coords = getTooltipPosition(pos);
      setHoverInfo({
        x: coords.x,
        y: coords.y,
        content: `Author: ${node.data('label')}\nPapers: ${node.data('paperCount') ?? 0}\nCollaborators: ${collaboratorCount}`
      });
    };
    const handleCanvasClick = (event: any) => {
      if (event.target === cy) {
        cy.elements().unselect();
        setHoverInfo(null);
      }
    };
    cy.on('tap', 'node', handleNodeClick);
    cy.on('tap', handleCanvasClick);
    return () => {
      cy.off('tap', 'edge', handleEdgeClick);
      cy.off('tap', 'node', handleNodeClick);
      cy.off('tap', handleCanvasClick);
    };
  }, [isCyReady]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[520px] bg-white border border-gray-200 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[520px] bg-white border border-gray-200 rounded-lg">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center h-[520px] bg-white border border-gray-200 rounded-lg">
        <p className="text-gray-500">No author network data available</p>
      </div>
    );
  }

  const handleFit = () => {
    if (!cyRef.current) return;
    cyRef.current.fit(undefined, 40);
  };

  const handleReset = () => {
    if (!cyRef.current) return;
    cyRef.current.reset();
  };

  const focusAuthorNode = (author: string) => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    let node = cy.getElementById(author);
    if (!node || node.empty()) {
      node = cy.nodes().filter((n: any) => n.data('label') === author);
    }
    if (!node || node.empty()) return;
    cy.elements().unselect();
    node.select();
    const collaboratorCount = node.neighborhood('node').length;
    cy.fit(node, 80);
    const pos = node.renderedPosition();
    setHoverInfo({
      x: pos.x + 12,
      y: pos.y + 12,
      content: `Author: ${node.data('label')}\nPapers: ${node.data('paperCount') ?? 0}\nCollaborators: ${collaboratorCount}`
    });
  };
  /*
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const { startX, startWidth } = resizeStartRef.current;
      const delta = startX - event.clientX;
      const nextWidth = Math.min(640, Math.max(320, startWidth + delta));
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
  }, []);
  */

  return (
    <div ref={containerRef} className="relative bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
            onClick={handleFit}
          >
            Fit
          </button>
          <button
            type="button"
            className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <CytoscapeComponent
            elements={elements}
            layout={layout}
            style={{ width: '100%', height: '520px' }}
            cy={(cy) => {
              cyRef.current = cy;
              if (panzoomReadyRef.current && cy.panzoom && !cy.data('panzoom')) {
                cy.panzoom();
                cy.data('panzoom', true);
              }
              if (!isCyReady) setIsCyReady(true);
            }}
            wheelSensitivity={0.6}
            stylesheet={[
              {
                selector: 'node',
                style: {
                  label: '',
                  width: `mapData(size, ${nodeSizeStats.min}, ${nodeSizeStats.max}, ${DEFAULT_MIN_NODE_SIZE}, ${DEFAULT_MAX_NODE_SIZE})`,
                  height: `mapData(size, ${nodeSizeStats.min}, ${nodeSizeStats.max}, ${DEFAULT_MIN_NODE_SIZE}, ${DEFAULT_MAX_NODE_SIZE})`,
                  'background-color': 'data(color)',
                  opacity: 0.9
                }
              },
              {
                selector: 'node:selected',
                style: {
                  'border-width': 2,
                  'border-color': '#1d4ed8'
                }
              },
              {
                selector: 'edge',
                style: {
                  width: `mapData(weight, ${edgeWeightStats.min}, ${edgeWeightStats.max}, ${DEFAULT_MIN_EDGE_WIDTH}, ${DEFAULT_MAX_EDGE_WIDTH})`,
                  'line-color': '#4b5563',
                  opacity: 0.6,
                  'curve-style': 'haystack'
                }
              },
              {
                selector: 'edge:selected',
                style: {
                  width: `mapData(weight, ${edgeWeightStats.min}, ${edgeWeightStats.max}, ${DEFAULT_MIN_EDGE_WIDTH + 0.8}, ${DEFAULT_MAX_EDGE_WIDTH + 2.2})`,
                  'line-color': '#1d4ed8',
                  opacity: 0.9
                }
              }
            ]}
          />
        </div>
        <div
          className={`${rightPanelExpanded ? '' : 'w-14'} bg-gray-100 rounded-lg min-h-[560px] transition-all duration-300 ease-in-out relative overflow-visible ${rightPanelExpanded ? 'min-w-[320px]' : 'min-w-[56px]'}`}
          style={rightPanelExpanded ? { width: panelWidth } : undefined}
        >
          {rightPanelExpanded && (
            <div
              className="absolute left-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-200/40 z-20"
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
                          {filteredRows.length} results
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
                            setSelectedAuthorId(args.row.id);
                            focusAuthorNode(args.row.author);
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
      </div>
      {hoverInfo && (
        <div
          className="absolute z-10 max-w-xs whitespace-pre-line rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-sm text-gray-700 shadow-lg"
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          {hoverInfo.content}
        </div>
      )}
    </div>
  );
}
