'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import cytoscape from 'cytoscape';
import AuthorNetworkRightPanel from './AuthorNetworkRightPanel';
import InfoPopover from './InfoPopover';

const CytoscapeComponent = dynamic(() => import('react-cytoscapejs'), {
  ssr: false,
  loading: () => <div className="w-full h-[520px] bg-gray-100 animate-pulse rounded" />
});

export type ColouredStudyType = 'PK' | 'CT' | 'PE';

type AuthorNode = {
  id: string;
  size: number;
  typeCounts?: Record<ColouredStudyType, number>;
  dominantType?: ColouredStudyType | null;
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

/**
 * Cytoscape scales edge width by the zoom level, so a fixed base width goes
 * sub-pixel once the graph is zoomed out. With ~500 nodes the initial fit lands
 * near zoom 0.28, where the base 0.6–2.6 range renders as 0.17–0.73px — every
 * edge, even the heaviest, is thinner than one pixel.
 *
 * These are floors expressed in *screen* pixels: the base widths below are
 * divided by the current zoom so an edge never renders thinner than this, while
 * zooming in still thickens edges the normal way (the floor stops applying once
 * the natural width exceeds it).
 */
const MIN_RENDERED_EDGE_WIDTH = 0.6;
const MAX_RENDERED_EDGE_WIDTH = 2.6;
const GRAPH_NODE_LIMIT = 500;
/**
 * Node colour encodes the author's dominant study type (the type most of their
 * retrieved papers carry; ties break PK > CT > PE, resolved server-side).
 *
 * These are the first three categorical slots of the validated palette, kept in
 * fixed order. A network is a scatter-like form — any two nodes can end up
 * adjacent — so the trio was validated with all pairs in play against the white
 * canvas: worst CVD ΔE 9.2, worst normal-vision ΔE 24.0. `OTHER` is a
 * deliberate neutral (authors with no PK/CT/PE papers, ~3% of records); it
 * reads as grey on purpose so it never competes with the three identities.
 *
 * Aqua sits just under 3:1 contrast on white, so colour is never the only
 * signal: the legend below the graph and the hover tooltip both name the type.
 */
const STUDY_TYPE_COLORS: Record<ColouredStudyType, string> = {
  PK: '#2a78d6',
  CT: '#eb6834',
  PE: '#1baf7a'
};
const OTHER_TYPE_COLOR = '#52514e';

const STUDY_TYPE_LABELS: Record<ColouredStudyType, string> = {
  PK: 'Pharmacokinetics',
  CT: 'Clinical Trial',
  PE: 'Pharmacoepidemiology'
};

const nodeColorForType = (type?: ColouredStudyType | null) =>
  (type && STUDY_TYPE_COLORS[type]) || OTHER_TYPE_COLOR;

const FIT_PADDING = 10;


const renderNodeSize = (size: number) => Math.max(12, 8 + size * 14);

/**
 * Tooltip text for a node. The dominant study type is spelled out here as well
 * as encoded in the dot colour, so the colour is never the only way to read it.
 */
const nodeTooltip = (node: any, collaboratorCount: number) => {
  const dominant = node.data('dominantType') as ColouredStudyType | null;
  const counts = node.data('typeCounts') as Record<ColouredStudyType, number> | null;
  const lines = [
    `Author: ${node.data('label')}`,
    `Papers: ${node.data('paperCount') ?? 0}`,
    `Collaborators: ${collaboratorCount}`,
    `Study type: ${dominant ? `${dominant} — ${STUDY_TYPE_LABELS[dominant]}` : 'Other / none'}`
  ];
  if (counts) {
    lines.push(`PK ${counts.PK ?? 0} · CT ${counts.CT ?? 0} · PE ${counts.PE ?? 0}`);
  }
  return lines.join('\n');
};

/**
 * What the graph means and how to read it. The floating legend already covers
 * dot colour and dot size; this covers everything it cannot — what a line is,
 * what the controls do, and the two limits that are otherwise invisible (the
 * GRAPH_NODE_LIMIT cap and name-based author matching).
 */
function AuthorNetworkInfo() {
  return (
    <InfoPopover label="About the author network" title="About this network">
      <p>
        Who writes these papers together. Each dot is an author, and a line joins two authors who
        appear on the same paper.
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        <li>Dot size — how many of these papers the author wrote.</li>
        <li>Dot colour — the study type most of their papers carry.</li>
        <li>Thicker line — the two wrote more papers together.</li>
      </ul>
      <p className="mt-2 font-medium text-gray-700">Using it</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        <li>Hover or click a dot for the author&apos;s papers, collaborators and study types.</li>
        <li>Click a line to see the two names and how many papers they share.</li>
        <li>Drag to move, scroll to zoom, Fit to bring everything back into view.</li>
        <li>Layout only rearranges the dots — it does not change the data.</li>
        <li>
          Current Page / All Authors switches between the authors listed on the current page and
          everyone.
        </li>
      </ul>
      <p className="mt-2 font-medium text-gray-700">Worth knowing</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        <li>
          With All Authors on, only the {GRAPH_NODE_LIMIT} authors with the most papers are drawn.
        </li>
        <li>Authors are matched by name, so two people with the same name share one dot.</li>
        <li>It covers the papers matching your current search and filters, and changes with them.</li>
      </ul>
    </InfoPopover>
  );
}

export default function AuthorNetworkTab({ data, isLoading, error }: AuthorNetworkTabProps) {
  const spacing = 1.0;
  const cyRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; content: string } | null>(null);
  const [pinnedInfo, setPinnedInfo] = useState<{ x: number; y: number; content: string } | null>(null);
  const [isCyReady, setIsCyReady] = useState(false);
  /** Current zoom, used to keep edges above a minimum on-screen thickness. */
  const [edgeZoom, setEdgeZoom] = useState(1);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(true);
  const panelWidth = 420;
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [showAllAuthors, setShowAllAuthors] = useState(true);
  const [layoutType, setLayoutType] = useState<'fcose' | 'circle' | 'concentric' | 'klay'>('fcose');
  const [isKlayReady, setIsKlayReady] = useState(false);
  const [isFcoseReady, setIsFcoseReady] = useState(false);
  const panzoomReadyRef = useRef(false);
  const klayReadyRef = useRef(false);
  const fitRafRef = useRef<number | null>(null);

  const scheduleFit = React.useCallback((padding = FIT_PADDING) => {
    if (!cyRef.current) return;
    if (fitRafRef.current) {
      cancelAnimationFrame(fitRafRef.current);
    }
    fitRafRef.current = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const cy = cyRef.current;
        if (!cy || cy.destroyed()) return;
        cy.resize();
        cy.fit(undefined, padding);
      });
    });
  }, []);


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
    { key: 'author', name: 'Author', sortable: true },
    { key: 'paperCount', name: 'Paper Count', sortable: true },
    {
      key: 'pmids',
      name: 'PMIDs',
      sortable: false,
      width: 180,
      renderCell: ({ row }: { row: any }) => (
        <div className="truncate whitespace-nowrap max-w-full" title={row.pmids}>
          {row.pmids}
        </div>
      )
    },
    {
      key: 'affiliations',
      name: 'Affiliation',
      sortable: false,
      width: 200,
      renderCell: ({ row }) => (
        <div className="truncate whitespace-nowrap max-w-full" title={row.affiliations}>
          {row.affiliations}
        </div>
      )
    }
  ], []);

  const visibleAuthors = useMemo(() => {
    if (showAllAuthors) return null;
    return new Set(paginatedRows.map((row) => row.id));
  }, [showAllAuthors, paginatedRows]);

  const graphNodesBase = useMemo(() => {
    if (!showAllAuthors) return nodes;
    return nodes.slice(0, GRAPH_NODE_LIMIT);
  }, [nodes, showAllAuthors]);

  const graphNodeSet = useMemo(() => new Set(graphNodesBase.map((node) => node.id)), [graphNodesBase]);

  const graphLinksBase = useMemo(() => {
    if (!showAllAuthors) return links;
    return links.filter((link) => graphNodeSet.has(link.source) && graphNodeSet.has(link.target));
  }, [links, graphNodeSet, showAllAuthors]);

  const visibleLinks = useMemo(() => {
    if (showAllAuthors || !visibleAuthors) return graphLinksBase;
    return graphLinksBase.filter((link) => visibleAuthors.has(link.source) || visibleAuthors.has(link.target));
  }, [graphLinksBase, showAllAuthors, visibleAuthors]);

  const visibleNodes = useMemo(() => {
    if (showAllAuthors || !visibleAuthors) return graphNodesBase;
    const nodeIds = new Set<string>(visibleAuthors);
    visibleLinks.forEach((link) => {
      nodeIds.add(link.source);
      nodeIds.add(link.target);
    });
    return nodes.filter((node) => nodeIds.has(node.id));
  }, [nodes, graphNodesBase, visibleAuthors, visibleLinks, showAllAuthors]);

  const nodeSizeStats = useMemo(() => {
    let min = Infinity;
    let max = 0;
    visibleNodes.forEach((node) => {
      min = Math.min(min, node.size);
      max = Math.max(max, node.size);
    });
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 1;
    return { min, max };
  }, [visibleNodes]);

  const edgeWeightStats = useMemo(() => {
    let min = Infinity;
    let max = 0;
    visibleLinks.forEach((link) => {
      min = Math.min(min, link.weight);
      max = Math.max(max, link.weight);
    });
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 1;
    // mapData divides by (max - min); when every visible edge shares a weight
    // that is zero, which yields a NaN width and invisible edges.
    if (max <= min) max = min + 1;
    return { min, max };
  }, [visibleLinks]);

  const elements = useMemo(() => {
    const nodeElements = visibleNodes.map((node) => ({
      data: {
        id: node.id,
        label: node.id,
        size: node.size,
        paperCount: node.size,
        dominantType: node.dominantType ?? null,
        typeCounts: node.typeCounts ?? null,
        color: nodeColorForType(node.dominantType)
      }
    }));

    const edgeElements = visibleLinks.map((link, index) => ({
      data: {
        id: `edge-${index}-${link.source}-${link.target}`,
        source: link.source,
        target: link.target,
        weight: link.weight
      }
    }));

    return [...nodeElements, ...edgeElements];
  }, [visibleNodes, visibleLinks]);

  const layout = useMemo(() => {
    if (layoutType === 'klay' && !isKlayReady) {
      return {
        name: 'cose',
        animate: false,
        fit: false,
        padding: 20
      } as const;
    }
    if (layoutType === 'fcose' && !isFcoseReady) {
      return {
        name: 'cose',
        animate: false,
        fit: false,
        padding: 20
      } as const;
    }
    if (layoutType === 'fcose') {
      return {
        name: 'fcose',
        animate: false,
        fit: false,
        padding: 20,
        nodeSeparation: 160,
        idealEdgeLength: 220,
        edgeElasticity: 0.1,
        gravity: 0.001,
        numIter: 3000,
        randomize: true,
        packComponents: true
      } as const;
    }
    if (layoutType === 'circle') {
      return {
        name: 'circle',
        animate: false,
        fit: false,
        padding: 20
      } as const;
    }
    if (layoutType === 'klay') {
      return {
        name: 'klay',
        animate: false,
        fit: false,
        padding: 20,
        klay: {
          direction: 'RIGHT',
          spacing: 20,
          edgeSpacingFactor: 0.2,
          nodeLayering: 'INTERACTIVE'
        }
      } as const;
    }
    if (!showAllAuthors && visibleAuthors && layoutType === 'concentric') {
      const hasNonPageNodes = visibleNodes.some((node) => !visibleAuthors.has(node.id));
      return {
        name: 'concentric',
        animate: false,
        fit: false,
        padding: 20,
        concentric: (nd: any) => {
          const id = nd.data('id');
          const level = hasNonPageNodes
            ? (visibleAuthors.has(id) ? 100 : 0)
            : (nd.data('size') ?? 1);
          console.log(`[fengsh] current page mode level: ${level}`);
          return level;
        },
        levelWidth: () => 50, // (hasNonPageNodes ? 120 : 60) * spacing,
        minNodeSpacing: 16 * spacing
      } as const;
    }
    return {
      name: 'concentric',
      animate: false,
      fit: false,
      padding: 20,
      concentric: (nd: any) => {
        const s = nd.data('size');
        if (s >= 20) return 300;
        if (s >= 10) return 200;
        if (s >= 5) return 100;
        return 0;
      },
      levelWidth: () => 50,
      minNodeSpacing: 10 * spacing
    } as const;
  }, [spacing, showAllAuthors, visibleAuthors, layoutType, isKlayReady, isFcoseReady, visibleNodes]);

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
          scheduleFit(FIT_PADDING);
        }
      })
      .catch(() => {
        // ignore panzoom init failures
      });
    return () => {
      isMounted = false;
    };
  }, [scheduleFit]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (klayReadyRef.current) return;
    let isMounted = true;
    import('cytoscape-klay')
      .then((module) => {
        if (!isMounted) return;
        const register = (module as any).default ?? module;
        (cytoscape as any).use(register);
        klayReadyRef.current = true;
        setIsKlayReady(true);
      })
      .catch(() => {
        // ignore klay init failures
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isFcoseReady) return;
    let isMounted = true;
    import('cytoscape-fcose')
      .then((module) => {
        if (!isMounted) return;
        const register = (module as any).default ?? module;
        (cytoscape as any).use(register);
        setIsFcoseReady(true);
      })
      .catch(() => {
        // ignore fcose init failures
      });
    return () => {
      isMounted = false;
    };
  }, [isFcoseReady]);

  useEffect(() => {
    const cy = cyRef.current;
    // Guard against a destroyed instance: clearing the filter to an empty set
    // unmounts the graph (destroying cy) while this layout effect still re-runs.
    if (!cy || cy.destroyed() || elements.length === 0) return;
    cy.layout(layout).run();
    cy.once('layoutstop', () => {
      if (cy.destroyed()) return;
      scheduleFit(FIT_PADDING);
      cy.userZoomingEnabled(true);
      cy.userPanningEnabled(true);
    });
  }, [layout, scheduleFit, elements]);

  useEffect(() => {
    if (!isCyReady || !cyRef.current || cyRef.current.destroyed()) return;
    const cy = cyRef.current;
    const container = cy.container?.();
    if (!container) return;
    const observer = new ResizeObserver(() => {
      scheduleFit(FIT_PADDING);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [isCyReady, scheduleFit]);

  useEffect(() => {
    scheduleFit(FIT_PADDING);
  }, [rightPanelExpanded, scheduleFit]);

  // Track zoom so the edge-width floor can be expressed in screen pixels.
  // Coalesced to a frame and quantised, so restyling only happens when the
  // rendered thickness would actually change noticeably.
  useEffect(() => {
    if (!isCyReady || !cyRef.current || cyRef.current.destroyed()) return;
    const cy = cyRef.current;
    let frame: number | null = null;
    const syncZoom = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const zoom = cy.zoom();
        if (!Number.isFinite(zoom) || zoom <= 0) return;
        setEdgeZoom((previous) =>
          Math.abs(zoom - previous) / (previous || 1) > 0.1 ? zoom : previous
        );
      });
    };
    syncZoom();
    cy.on('zoom', syncZoom);
    return () => {
      cy.off('zoom', syncZoom);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [isCyReady, elements]);

  /**
   * Base widths handed to cytoscape. Dividing the screen-pixel floors by the
   * current zoom keeps thin edges visible when zoomed out; once the natural
   * width is already thicker, the defaults win and edges scale as usual.
   */
  const edgeWidthRange = useMemo(() => {
    const zoom = edgeZoom > 0 ? edgeZoom : 1;
    return {
      min: Math.max(DEFAULT_MIN_EDGE_WIDTH, MIN_RENDERED_EDGE_WIDTH / zoom),
      max: Math.max(DEFAULT_MAX_EDGE_WIDTH, MAX_RENDERED_EDGE_WIDTH / zoom)
    };
  }, [edgeZoom]);


  useEffect(() => {
    if (!isCyReady || !cyRef.current || cyRef.current.destroyed()) return;
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
        content: nodeTooltip(node, collaboratorCount)
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
        content: `Authors: ${edge.source().data('label')}; ${edge.target().data('label')}\nCoauthored: ${edge.data('weight')}`
      });
    };
    const clearHover = () => {
      cy.elements().style('opacity', 1);
      setHoverInfo(null);
    };
    cy.on('mouseenter', 'node', showNodeHover);
    cy.on("mouseenter", "node", () => console.log("node hover"));
    cy.on('mouseenter', 'edge', showEdgeHover);
    cy.on('mouseleave', 'node', clearHover);
    cy.on("mouseleave", "node", () => console.log("node leave"));
    cy.on('mouseleave', 'edge', clearHover);
    return () => {
      cy.off('mouseenter', 'node', showNodeHover);
      cy.off('mouseenter', 'edge', showEdgeHover);
      cy.off('mouseleave', 'node', clearHover);
      cy.off('mouseleave', 'edge', clearHover);
    };
  }, [isCyReady]);

  useEffect(() => {
    if (!isCyReady || !cyRef.current || cyRef.current.destroyed()) return;
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
      setPinnedInfo({
        x: coords.x,
        y: coords.y,
        content: `Authors: ${edge.source().data('label')}; ${edge.target().data('label')}\nCoauthored: ${edge.data('weight')}`
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
      setPinnedInfo({
        x: coords.x,
        y: coords.y,
        content: nodeTooltip(node, collaboratorCount)
      });
    };
    const handleCanvasClick = (event: any) => {
      if (event.target === cy) {
        cy.elements().unselect();
        setHoverInfo(null);
        setPinnedInfo(null);
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
    cyRef.current.fit(undefined, FIT_PADDING);
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
    const setTooltipForNode = () => {
      const pos = node.renderedPosition();
      if (!containerRef.current || !cy.container) {
        setHoverInfo({
          x: pos.x + 30,
          y: pos.y + 30,
          content: nodeTooltip(node, collaboratorCount)
        });
        return;
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const cyRect = cy.container().getBoundingClientRect();
      const offsetX = cyRect.left - containerRect.left;
      const offsetY = cyRect.top - containerRect.top;
      const maxWidth = 260;
      const maxHeight = 110;
      let x = offsetX + pos.x + 12;
      let y = offsetY + pos.y + 12;
      x = Math.max(8, Math.min(x, containerRect.width - maxWidth));
      y = Math.max(8, Math.min(y, containerRect.height - maxHeight));
      setPinnedInfo({
        x,
        y,
        content: nodeTooltip(node, collaboratorCount)
      });
    };

    // During animated fit, renderedPosition changes over time; set tooltip after animation completes.
    cy.animate(
      { fit: { eles: node, padding: 250 } },
      { duration: 600, complete: setTooltipForNode }
    );
  };

  return (
    <div ref={containerRef} className="relative bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            Author network
            <AuthorNetworkInfo />
          </span>
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Layout</span>
            <select
              value={layoutType}
              onChange={(event) => setLayoutType(event.target.value as 'fcose' | 'circle' | 'concentric' | 'klay')}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="fcose" disabled={!isFcoseReady}>Force-directed</option>
              <option value="circle">Circle</option>
              <option value="concentric">Concentric</option>
              <option value="klay" disabled={!isKlayReady}>Klay</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
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
        </div>
        <div className="text-xs text-gray-500">
          Nodes: {visibleNodes.length} · Edges: {visibleLinks.length}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Taller than the right panel's min-h-[560px] so the graph, not the
            Authors panel, drives the row height — this spends the vertical space
            the floated legend gave back on the graph itself. */}
        <div className="relative flex-1 min-w-0 min-h-[620px]">
          {/* Legend floats over the graph so it costs no vertical space, with a
              fully transparent background. It is click-through
              (pointer-events-none) so panning and node hover still work
              underneath. Indented past the cytoscape panzoom widget, which
              occupies the first ~46px of the graph. */}
          <div className="pointer-events-none absolute left-14 top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
            <span className="text-gray-500">Dot colour — most frequent study type:</span>
            {(['PK', 'CT', 'PE'] as ColouredStudyType[]).map((type) => (
              <span key={type} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STUDY_TYPE_COLORS[type] }}
                  aria-hidden="true"
                />
                <span>
                  {type} <span className="text-gray-400">({STUDY_TYPE_LABELS[type]})</span>
                </span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: OTHER_TYPE_COLOR }}
                aria-hidden="true"
              />
              <span>Other / none</span>
            </span>
            <span className="text-gray-400">Dot size — number of papers</span>
          </div>

          <CytoscapeComponent
            elements={elements}
            layout={layout}
            style={{ width: '100%', height: '100%' }}
            cy={(cy) => {
              cyRef.current = cy;
              const cyAny = cy as any;
              if (panzoomReadyRef.current && cyAny.panzoom && !cyAny.data?.('panzoom')) {
                cyAny.panzoom();
                cyAny.data?.('panzoom', true);
              }
              if (!isCyReady) {
                setIsCyReady(true);
                scheduleFit(FIT_PADDING);
              }
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
                  width: `mapData(weight, ${edgeWeightStats.min}, ${edgeWeightStats.max}, ${edgeWidthRange.min}, ${edgeWidthRange.max})`,
                  'line-color': '#4b5563',
                  opacity: 0.6,
                  'curve-style': 'haystack'
                }
              },
              {
                selector: 'edge:selected',
                style: {
                  width: `mapData(weight, ${edgeWeightStats.min}, ${edgeWeightStats.max}, ${edgeWidthRange.min * 1.8}, ${edgeWidthRange.max * 1.8})`,
                  'line-color': '#1d4ed8',
                  opacity: 0.9
                }
              }
            ]}
          />
        </div>
        <AuthorNetworkRightPanel
          rightPanelExpanded={rightPanelExpanded}
          setRightPanelExpanded={setRightPanelExpanded}
          panelWidth={panelWidth}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          pageSize={pageSize}
          setPageSize={setPageSize}
          currentPage={currentPage}
          totalPages={totalPages}
          setPage={setPage}
          filteredCount={filteredRows.length}
          paginatedRows={paginatedRows}
          gridColumns={gridColumns}
          selectedAuthorId={selectedAuthorId}
          onAuthorSelect={(author, id) => {
            setSelectedAuthorId(id);
            focusAuthorNode(author);
          }}
        />
      </div>
      {(hoverInfo ?? pinnedInfo) && (
        <div
          className="absolute z-10 max-w-xs whitespace-pre-line rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-sm text-gray-700 shadow-lg"
          style={{ left: (hoverInfo ?? pinnedInfo)!.x, top: (hoverInfo ?? pinnedInfo)!.y }}
        >
          {(hoverInfo ?? pinnedInfo)!.content}
        </div>
      )}
    </div>
  );
}
