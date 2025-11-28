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

export default function DrugClassTab() {
  const [heatmapType, setHeatmapType] = useState<HeatmapType>('drugs');
  const [data, setData] = useState<PopulationData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState<number | null>(200); // Default to top 200

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await daGetDrugClass(heatmapType);
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
  }, [heatmapType]);

  const createHeatmapData = (populationData: HeatmapData[]) => {
    if (!populationData || populationData.length === 0) {
      return null;
    }

    // Prepare data for heatmap
    const names = populationData.map(d => d.name);
    const pkValues = populationData.map(d => d.pk || 0);
    const peValues = populationData.map(d => d.pe || 0);
    const ctValues = populationData.map(d => d.ct || 0);
    const vcValues = populationData.map(d => d.vc || 0);
    const fbnstpValues = populationData.map(d => d.fbnstp || 0);
    const biomarkerValues = populationData.map(d => d.biomarker || 0);

    // Create data for PK, PE, CT heatmap
    const pkpectOriginalZ: number[][] = [];
    const pkpectZValues: number[][] = [];
    
    // Create data for VC, FBNSTP, Biomarker heatmap
    const vcfbnstpBiomarkerOriginalZ: number[][] = [];
    const vcfbnstpBiomarkerZValues: number[][] = [];
    
    for (let i = 0; i < names.length; i++) {
      // PK, PE, CT data
      pkpectOriginalZ.push([pkValues[i], peValues[i], ctValues[i]]);
      if (heatmapType === 'drugs') {
        pkpectZValues.push([
          Math.log10(pkValues[i] + 1),
          Math.log10(peValues[i] + 1),
          Math.log10(ctValues[i] + 1)
        ]);
      } else {
        pkpectZValues.push([pkValues[i], peValues[i], ctValues[i]]);
      }

      // VC, FBNSTP, Biomarker data
      vcfbnstpBiomarkerOriginalZ.push([vcValues[i], fbnstpValues[i], biomarkerValues[i]]);
      if (heatmapType === 'drugs') {
        vcfbnstpBiomarkerZValues.push([
          Math.log10(vcValues[i] + 1),
          Math.log10(fbnstpValues[i] + 1),
          Math.log10(biomarkerValues[i] + 1)
        ]);
      } else {
        vcfbnstpBiomarkerZValues.push([vcValues[i], fbnstpValues[i], biomarkerValues[i]]);
      }
    }

    // Find max values for each heatmap's color scale
    const maxPkpectZValue = Math.max(...pkpectZValues.flat(), 0.1);
    const maxVcfbnstpBiomarkerZValue = Math.max(...vcfbnstpBiomarkerZValues.flat(), 0.1);
    
    // Find max actual values (for colorbar labels when using log scale)
    const maxPkpectActualValue = heatmapType === 'drugs' 
      ? Math.max(...pkValues, ...peValues, ...ctValues, 1)
      : maxPkpectZValue;
    const maxVcfbnstpBiomarkerActualValue = heatmapType === 'drugs'
      ? Math.max(...vcValues, ...fbnstpValues, ...biomarkerValues, 1)
      : maxVcfbnstpBiomarkerZValue;

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

    const pkpectColorbarTicks = generateLogColorbarTicks(maxPkpectZValue, maxPkpectActualValue);
    const vcfbnstpBiomarkerColorbarTicks = generateLogColorbarTicks(maxVcfbnstpBiomarkerZValue, maxVcfbnstpBiomarkerActualValue);

    // Create heatmap trace for PK, PE, CT
    const pkpectTrace: any = {
      z: pkpectZValues,
      text: pkpectOriginalZ,
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
        title: 'Publications (log scale)',
        titleside: 'right' as const,
        titlefont: { size: 12 },
        ...(pkpectColorbarTicks ? {
          tickvals: pkpectColorbarTicks.tickvals,
          ticktext: pkpectColorbarTicks.ticktext
        } : {})
      },
      hovertemplate: '<b>%{y}</b><br>%{x}: %{text}<extra></extra>',
      zmin: 0,
      zmax: maxPkpectZValue
    };

    // Create heatmap trace for VC, FBNSTP, Biomarker
    const vcfbnstpBiomarkerTrace: any = {
      z: vcfbnstpBiomarkerZValues,
      text: vcfbnstpBiomarkerOriginalZ,
      texttemplate: '', // Hide text, we'll use hover only
      x: ['VC', 'FBNSTP', 'Biomarker'],
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
        ...(vcfbnstpBiomarkerColorbarTicks ? {
          tickvals: vcfbnstpBiomarkerColorbarTicks.tickvals,
          ticktext: vcfbnstpBiomarkerColorbarTicks.ticktext
        } : {})
      },
      hovertemplate: '<b>%{y}</b><br>%{x}: %{text}<extra></extra>',
      zmin: 0,
      zmax: maxVcfbnstpBiomarkerZValue
    };

    return {
      pkpect: [pkpectTrace],
      vcfbnstpBiomarker: [vcfbnstpBiomarkerTrace]
    };
  };

  const createHeatmapLayout = (population: string, numItems: number): any => {
    return {
      xaxis: {
        title: '',
        side: 'bottom' as const,
        tickfont: { size: 12 },
        fixedrange: true
      },
      yaxis: {
        title: '',
        tickfont: { size: 8 },
        automargin: true,
        fixedrange: true,
        tickmode: 'linear' as const,
        tick0: 0,
        dtick: 1
      },
      margin: { l: 200, r: 80, t: 50, b: 40 },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      height: Math.max(400, Math.min(1000, numItems * 12 + 150)),
      autosize: true
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

  return (
    <div className="space-y-6">
      {/* Heatmap Type Selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Heatmap Type:
        </label>
        <div className="flex flex-wrap gap-3">
          {(['drugs', 'level1', 'level2', 'level3'] as HeatmapType[]).map((type) => (
            <button
              key={type}
              onClick={() => setHeatmapType(type)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                heatmapType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type === 'drugs' ? 'Drugs' : `Level ${type.slice(-1)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Limit Controls - Only show for drugs */}
      {heatmapType === 'drugs' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Input */}
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

            {/* Limit Selector */}
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
          </div>
        </div>
      )}

      {/* Heatmaps */}
      <div className="space-y-6">
        {POPULATION_ORDER.map((population) => {
          let populationData = data[population] || [];
          
          // Filter and limit data for drugs heatmap
          if (heatmapType === 'drugs') {
            // Filter by search query
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase();
              populationData = populationData.filter(d => 
                d.name.toLowerCase().includes(query)
              );
            }
            
            // Apply limit (data is already sorted by total publications from API)
            if (limit !== null && limit > 0) {
              populationData = populationData.slice(0, limit);
            }
          }
          
          const heatmapData = createHeatmapData(populationData);
          
          if (!heatmapData) {
            return (
              <div key={population} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
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
            <div key={population} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
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
              
              {/* Heatmaps in one row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PK, PE, CT Heatmap */}
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-3">PK, PE, CT</h4>
                  <div className="flex-1 min-h-0">
                    <Plot
                      data={heatmapData.pkpect}
                      layout={createHeatmapLayout(population, populationData.length)}
                      config={{
                        displayModeBar: false,
                        responsive: true
                      }}
                      style={{ width: '100%', height: '100%', minHeight: '400px' }}
                      useResizeHandler={true}
                    />
                  </div>
                </div>

                {/* VC, FBNSTP, Biomarker Heatmap */}
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-3">VC, FBNSTP, Biomarker</h4>
                  <div className="flex-1 min-h-0">
                    <Plot
                      data={heatmapData.vcfbnstpBiomarker}
                      layout={createHeatmapLayout(population, populationData.length)}
                      config={{
                        displayModeBar: false,
                        responsive: true
                      }}
                      style={{ width: '100%', height: '100%', minHeight: '400px' }}
                      useResizeHandler={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

