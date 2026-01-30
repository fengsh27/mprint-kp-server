'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

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
};

type AuthorNetworkTabProps = {
  data: AuthorNetworkData | null;
  isLoading: boolean;
  error?: string | null;
};

const DEFAULT_MIN_NODE_SIZE = 20;
const DEFAULT_MAX_NODE_SIZE = 70;
const DEFAULT_MIN_EDGE_WIDTH = 1;
const DEFAULT_MAX_EDGE_WIDTH = 6;

export default function AuthorNetworkTab({ data, isLoading, error }: AuthorNetworkTabProps) {
  const [spacing, setSpacing] = useState(1.2);
  const cyRef = useRef<any>(null);

  const nodes = data?.nodes ?? [];
  const links = data?.links ?? [];

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
        size: node.size
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
      name: 'cose',
      animate: false,
      nodeRepulsion: 8000 * spacing,
      idealEdgeLength: 90 * spacing,
      edgeElasticity: 0.45,
      gravity: 1.2,
      randomize: true,
      fit: true,
      padding: 30
    } as const;
  }, [spacing]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.layout(layout).run();
    cy.fit(undefined, 40);
  }, [layout, elements]);

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

  const handleZoom = (factor: number) => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const current = cy.zoom();
    cy.zoom({ level: Math.max(0.1, current * factor), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };

  const handleFit = () => {
    if (!cyRef.current) return;
    cyRef.current.fit(undefined, 40);
  };

  const handleReset = () => {
    if (!cyRef.current) return;
    cyRef.current.reset();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Spacing</span>
          <input
            type="range"
            min="0.8"
            max="2.2"
            step="0.1"
            value={spacing}
            onChange={(event) => setSpacing(Number(event.target.value))}
            className="w-40"
          />
          <span className="text-sm text-gray-500 w-8">{spacing.toFixed(1)}x</span>
        </div>
        <button
          type="button"
          className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
          onClick={() => handleZoom(1.2)}
        >
          Zoom In
        </button>
        <button
          type="button"
          className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
          onClick={() => handleZoom(0.8)}
        >
          Zoom Out
        </button>
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

      <CytoscapeComponent
        elements={elements}
        layout={layout}
        style={{ width: '100%', height: '520px' }}
        cy={(cy) => {
          cyRef.current = cy;
        }}
        wheelSensitivity={0.2}
        stylesheet={[
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              'text-opacity': 0,
              'text-outline-width': 2,
              'text-outline-color': '#ffffff',
              'font-size': 10,
              'text-background-color': '#ffffff',
              'text-background-opacity': 0.8,
              'text-background-padding': 2,
              width: `mapData(size, ${nodeSizeStats.min}, ${nodeSizeStats.max}, ${DEFAULT_MIN_NODE_SIZE}, ${DEFAULT_MAX_NODE_SIZE})`,
              height: `mapData(size, ${nodeSizeStats.min}, ${nodeSizeStats.max}, ${DEFAULT_MIN_NODE_SIZE}, ${DEFAULT_MAX_NODE_SIZE})`,
              'background-color': `mapData(size, ${nodeSizeStats.min}, ${nodeSizeStats.max}, #7dd3fc, #1e3a8a)`,
              'border-width': 1,
              'border-color': '#0f172a'
            }
          },
          {
            selector: 'node:selected',
            style: {
              'text-opacity': 1
            }
          },
          {
            selector: 'edge',
            style: {
              width: `mapData(weight, ${edgeWeightStats.min}, ${edgeWeightStats.max}, ${DEFAULT_MIN_EDGE_WIDTH}, ${DEFAULT_MAX_EDGE_WIDTH})`,
              'line-color': 'rgba(30, 41, 59, 0.45)',
              'curve-style': 'bezier'
            }
          }
        ]}
      />
    </div>
  );
}
