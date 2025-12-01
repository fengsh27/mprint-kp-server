'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { daGetDrugClass } from '../dataprovider/dataaccessor';

// Dynamically import Plotly to prevent SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => <div className="w-full h-[300px] bg-gray-100 animate-pulse rounded"></div>
});

type HeatmapType = 'drugs' | 'level1' | 'level2' | 'level3';

interface HeatmapData {
  name: string;
  pk: number;
  pe: number;
  ct: number;
  vc: number;
  fbnstp: number;
  biomarker: number;
  count_all: number;
}

interface PopulationData {
  [key: string]: HeatmapData[];
}

const POPULATION_LABELS: Record<string, string> = {
  pregnancy: 'Pregnancy',
  postpartum: 'Postpartum',
  ped01: 'Pediatric 0-1',
  ped112: 'Pediatric 1-12',
  ped1218: 'Pediatric 12-17'
};

const POPULATION_ORDER = ['pregnancy', 'postpartum', 'ped01', 'ped112', 'ped1218'];
const MIN_PLOT_HEIGHT = 400;
const MAX_PLOT_HEIGHT = 800;
const EXTRA_MAX_PLOT_HEIGHT = 1000;
const EXTRA_EXTRA_MAX_PLOT_HEIGHT = 1500;
const EXTRA_EXTRA_EXTRA_MAX_PLOT_HEIGHT = 2000;
const MAX_PLOT_WIDTH = 1800;

interface DrugClassTabProps {
  selectedDrugClass?: string;
}

export default function DrugClassTab({ selectedDrugClass }: DrugClassTabProps) {
  const [heatmapType, setHeatmapType] = useState<HeatmapType>('drugs');
  const [data, setData] = useState<PopulationData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState<number | null>(100); // Default to top 100
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // If selectedDrugClass is provided, always use 'drugs' type and filter by drug class
        const typeToUse = selectedDrugClass ? 'drugs' : heatmapType;
        const response = await daGetDrugClass(typeToUse, undefined, selectedDrugClass);
        const result = await response as PopulationData;
        setData(result);
      } catch (err: any) {
        console.error('Error fetching drug class data:', err);
        setError(err.message || 'Failed to load drug class data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [heatmapType, selectedDrugClass]);

  // Track window width for responsive grid
  useEffect(() => {
    const updateWindowWidth = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial width
    if (typeof window !== 'undefined') {
      updateWindowWidth();
      window.addEventListener('resize', updateWindowWidth);
      return () => window.removeEventListener('resize', updateWindowWidth);
    }
  }, []);

  // Handle window resize for responsive heatmaps
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;
    
    const handleResize = () => {
      // Debounce resize events
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).Plotly) {
          const plotElements = document.querySelectorAll('.js-plotly-plot');
          plotElements.forEach((element) => {
            try {
              (window as any).Plotly.Plots.resize(element);
            } catch (error) {
              // Silently handle errors
            }
          });
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    
    // Initial resize after a short delay to ensure plots are rendered
    const initialResize = setTimeout(() => {
      handleResize();
    }, 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      clearTimeout(initialResize);
    };
  }, [data, heatmapType]);

  const getHeatmapMinHeight = (numItems: number) => {
    if (numItems === 0) {
      return MIN_PLOT_HEIGHT;
    }
    if (numItems <= 50) {
        return MIN_PLOT_HEIGHT;
    } else if (numItems <= 100) {
        return MAX_PLOT_HEIGHT;
    } else if (numItems <= 200) {
        return EXTRA_MAX_PLOT_HEIGHT;
    } else if (numItems <= 500) {
        return EXTRA_EXTRA_MAX_PLOT_HEIGHT;
    } else {
        return EXTRA_EXTRA_EXTRA_MAX_PLOT_HEIGHT;
    }
  };

  const createHeatmapData = (populationData: HeatmapData[]) => {
    if (!populationData || populationData.length === 0) {
      return null;
    }

    // Prepare data for heatmap
    const names = populationData.map(d => d.name);
    const pkValues = populationData.map(d => d.pk || 0);
    const peValues = populationData.map(d => d.pe || 0);
    const ctValues = populationData.map(d => d.ct || 0);

    // Create combined data for 3 columns: PK, PE, CT
    const originalZ: number[][] = [];
    const zValues: number[][] = [];
    
    for (let i = 0; i < names.length; i++) {
      // Combine 3 columns: PK, PE, CT
      originalZ.push([
        pkValues[i], 
        peValues[i], 
        ctValues[i]
      ]);
      
      if (heatmapType === 'drugs') {
        zValues.push([
          Math.log10(pkValues[i] + 1),
          Math.log10(peValues[i] + 1),
          Math.log10(ctValues[i] + 1)
        ]);
      } else {
        zValues.push([
          pkValues[i], 
          peValues[i], 
          ctValues[i]
        ]);
      }
    }

    // Find max value for color scale
    const maxZValue = Math.max(...zValues.flat(), 0.1);
    
    // Find max actual value (for colorbar labels when using log scale)
    const maxActualValue = heatmapType === 'drugs' 
      ? Math.max(...pkValues, ...peValues, ...ctValues, 1)
      : maxZValue;

    // Helper function to generate colorbar ticks for log scale
    const generateLogColorbarTicks = (maxLogValue: number, maxActualValue: number) => {
      if (heatmapType !== 'drugs') return undefined;
      
      // Generate tick values showing actual publication counts
      // We want to show: 0, 3, 10, 100, 1000, etc.
      const tickVals: number[] = [];
      const tickTexts: string[] = [];
      
      // Add 0 (log value 0 represents actual value 0)
      tickVals.push(0);
      tickTexts.push('0');
      
      // Add 3 (log value ≈ 0.6)
      if (maxActualValue >= 3) {
        tickVals.push(Math.log10(3 + 1));
        tickTexts.push('3');
      }
      
      // Add powers of 10: 10, 100, 1000, etc.
      let power = 1;
      while (true) {
        const actualValue = Math.pow(10, power);
        const logValue = Math.log10(actualValue + 1);
        
        if (logValue > maxLogValue) break;
        if (actualValue > maxActualValue) break;
        
        tickVals.push(logValue);
        tickTexts.push(actualValue.toString());
        power += 1;
      }
      
      return { tickvals: tickVals, ticktext: tickTexts };
    };

    const colorbarTicks = generateLogColorbarTicks(maxZValue, maxActualValue);

    // Create single heatmap trace with 3 columns: PK, PE, CT
    const trace: any = {
      z: zValues,
      text: originalZ,
      texttemplate: '', // Hide text, we'll use hover only
      x: ['PK', 'PE', 'CT'],
      y: names,
      type: 'heatmap' as const,
      colorscale: [
        [0, '#f5f5f5'],
        [0.01, '#e0e0e0'],
        [0.1, '#bdbdbd'],
        [0.3, '#9e9e9e'],
        [0.5, '#757575'],
        [0.7, '#424242'],
        [0.9, '#212121'],
        [1, '#000000']
      ],
      showscale: true,
      colorbar: {
        title: heatmapType === 'drugs' ? 'Publications (log scale)' : 'Publications',
        titleside: 'right' as const,
        titlefont: { size: 12 },
        ...(colorbarTicks ? {
          tickvals: colorbarTicks.tickvals,
          ticktext: colorbarTicks.ticktext
        } : {})
      },
      hovertemplate: '<b>%{y}</b><br>%{x}: %{text}<extra></extra>',
      zmin: 0,
      zmax: maxZValue
    };

    return [trace];
  };

  const createHeatmapLayout = (population: string, numItems: number): any => {
    // Calculate fixed height based on number of items
    const minHeight = getHeatmapMinHeight(numItems);
    const calculatedHeight = Math.max(minHeight, Math.min(minHeight, numItems * 12 + 150));
    console.log(`windowWidth: ${windowWidth}, calculatedHeight: ${calculatedHeight}`);
    
    return {
      xaxis: {
        title: '',
        side: 'bottom' as const,
        tickfont: { size: 12 },
        fixedrange: false // Allow horizontal responsive behavior
      },
      yaxis: {
        title: '',
        tickfont: { size: 8 },
        automargin: true,
        fixedrange: true, // Keep y-axis fixed (no vertical resize)
        tickmode: 'linear' as const,
        tick0: 0,
        dtick: 1
      },
      margin: { l: 200, r: 80, t: 50, b: 40 },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      height: calculatedHeight,
      autosize: false, // Disable autosize to keep height fixed
      width: undefined // Let width be responsive
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  const heatmapTypeLabels: Record<HeatmapType, string> = {
    drugs: 'Individual Drugs',
    level1: 'Drug Class Level 1',
    level2: 'Drug Class Level 2',
    level3: 'Drug Class Level 3'
  };

  return (
    <div className="space-y-6">
      {/* Selected Drug Class Info */}
      {selectedDrugClass && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Selected Drug Class:</span> {selectedDrugClass}
          </p>
          <p className="text-xs mt-1">
            Showing heatmaps for all drugs with this drug class
          </p>
        </div>
      )}

      {/* Controls Row */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Heatmap Type Dropdown - Only show if no drug class is selected */}
          {!selectedDrugClass && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heatmap Type:
              </label>
              <select
                value={heatmapType}
                onChange={(e) => setHeatmapType(e.target.value as HeatmapType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {(['drugs', 'level1', 'level2', 'level3'] as HeatmapType[]).map((type) => (
                  <option key={type} value={type}>
                    {heatmapTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Input - Only show for drugs */}
          {(heatmapType === 'drugs' || selectedDrugClass) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Drugs:
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to filter drugs..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Limit Selector - Only show for drugs */}
          {(heatmapType === 'drugs' || selectedDrugClass) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Show Top N Drugs:
              </label>
              <select
                value={limit === null ? 'all' : limit.toString()}
                onChange={(e) => setLimit(e.target.value === 'all' ? null : parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="100">Top 100</option>
                <option value="200">Top 200</option>
                <option value="500">Top 500</option>
                <option value="all">All Drugs</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Heatmaps */}
      <div 
        className="grid gap-6" 
        style={{
          gridTemplateColumns: windowWidth >= 1800 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(1, minmax(0, 1fr))'
        } as React.CSSProperties}
      >
        {POPULATION_ORDER.map((population) => {
          let populationData = data[population] || [];
          
          // Sort by count_all in ascending order (lowest first) so when displayed, highest will be at top
          // Plotly displays first row at bottom, so we want lowest first in array to show highest at top
          populationData = [...populationData].sort((a, b) => {
            const countA = a.count_all || 0;
            const countB = b.count_all || 0;
            return countA - countB; // Ascending order (lowest first)
          });
          
          // Filter and limit data for drugs heatmap
          if (heatmapType === 'drugs' || selectedDrugClass) {
            // Filter by search query
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase();
              populationData = populationData.filter(d => 
                d.name.toLowerCase().includes(query)
              );
            }
            
            // Apply limit (data is sorted ascending, so take last N items which are highest)
            if (limit !== null && limit > 0) {
              populationData = populationData.slice(-limit);
            }
          }
          
          // Reverse so highest values are at the end of array (will display at top of heatmap)
          // populationData = [...populationData].reverse();
          
          const heatmapData = createHeatmapData(populationData);
          
          if (!heatmapData) {
            return (
              <div key={population} className="bg-white border border-gray-200 rounded-lg p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {POPULATION_LABELS[population] || population}
                </h3>
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">No data available</p>
                </div>
              </div>
            );
          }

          const totalCount = data[population]?.length || 0;
          const displayedCount = populationData.length;
          
          return (
            <div key={population} className="bg-white border border-gray-200 rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {POPULATION_LABELS[population] || population}
                </h3>
                {heatmapType === 'drugs' && (
                  <span className="text-sm text-gray-500">
                    Showing {displayedCount} of {totalCount} drugs
                  </span>
                )}
              </div>
              
              {/* Combined Heatmap with all 6 columns */}
              <div className="flex-1 min-h-0 w-full" style={{ position: 'relative' }}>
                <Plot
                  data={heatmapData}
                  layout={createHeatmapLayout(population, populationData.length)}
                  config={{
                    displayModeBar: false,
                    responsive: true
                  }}
                  style={{ width: '100%', minHeight: `${getHeatmapMinHeight(populationData.length)}px` }}
                  useResizeHandler={true}
                  onInitialized={(figure, graphDiv) => {
                    // Ensure plot resizes horizontally on initialization
                    if (typeof window !== 'undefined' && (window as any).Plotly) {
                      setTimeout(() => {
                        (window as any).Plotly.Plots.resize(graphDiv);
                      }, 100);
                    }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

