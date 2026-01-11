'use client';

import React from 'react';
import { Edit, User, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import Plotly to prevent SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => <div className="w-full h-[300px] bg-gray-100 animate-pulse rounded"></div>
});

interface OverviewTabProps {
  overallStudyType: any;
  pkChartData: any[];
  pharmChartData: any[];
  clinicalChartData: any[];
  chartLayout: any;
  isLoadingPopulationData?: boolean;
  maternalWordCloudSvg: string;
  pediatricWordCloudSvg: string;
  isLoadingWordCloud?: boolean;
}

export default function OverviewTab({ 
  overallStudyType, 
  pkChartData, 
  pharmChartData, 
  clinicalChartData, 
  chartLayout,
  isLoadingPopulationData = false,
  maternalWordCloudSvg,
  pediatricWordCloudSvg,
  isLoadingWordCloud = false
}: OverviewTabProps) {
  const isChartDataEmpty = (data: any[]) => {
    return !data || data.length === 0 || data[0].y.every((y: any) => parseInt(y) === 0);
  }

  const normalizeSvg = (svg: string) => {
    if (!svg) return "";
    const widthMatch = svg.match(/width="([\d.]+)"/);
    const heightMatch = svg.match(/height="([\d.]+)"/);
    let updated = svg.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="100%"');
    if (!/viewBox=/.test(updated) && widthMatch && heightMatch) {
      updated = updated.replace(
        "<svg",
        `<svg viewBox="0 0 ${widthMatch[1]} ${heightMatch[1]}" preserveAspectRatio="xMidYMid meet"`
      );
    } else if (!/preserveAspectRatio=/.test(updated)) {
      updated = updated.replace("<svg", '<svg preserveAspectRatio="xMidYMid meet"');
    }
    return updated;
  };

  const maternalSvg = normalizeSvg(maternalWordCloudSvg);
  const pediatricSvg = normalizeSvg(pediatricWordCloudSvg);

  return (
    <div className="space-y-6">
      <style>{`
        .wordcloud-svg svg {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }
      `}</style>
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              {isLoadingPopulationData ? (
                <p className="text-lg font-medium text-gray-500">Retrieving data ...</p>
              ) : (
                <p className="text-4xl font-bold text-blue-600">{overallStudyType.pk.count}</p>
              )}
              <p className="text-gray-600 mt-1">Pharmacokinetics</p>
            </div>
            <Edit className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              {isLoadingPopulationData ? (
                <p className="text-lg font-medium text-gray-500">Retrieving data ...</p>
              ) : (
                <p className="text-4xl font-bold text-blue-600">{overallStudyType.pe.count}</p>
              )}
              <p className="text-gray-600 mt-1">Pharmacoepidemiology</p>
            </div>
            <Edit className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              {isLoadingPopulationData ? (
                <p className="text-lg font-medium text-gray-500">Retrieving data ...</p>
              ) : (
                <p className="text-4xl font-bold text-blue-600">{overallStudyType.ct.count}</p>
              )}
              <p className="text-gray-600 mt-1">Clinical Trial</p>
            </div>
            <User className="w-5 h-5 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PK Study Chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm min-h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">PK study by population</h3>
          {isChartDataEmpty(pkChartData) ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No data available</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <Plot
                data={pkChartData}
                layout={{
                  ...chartLayout,
                  yaxis: { ...chartLayout.yaxis },
                  autosize: true
                }}
                config={{ 
                  displayModeBar: false,
                  responsive: true
                }}
                style={{ width: '100%', height: '100%', minHeight: '350px' }}
                useResizeHandler={true}
              />
            </div>
          )}
        </div>

        {/* Pharmacoepidemiology Chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm min-h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pharmacoepidemiology study by population</h3>
          {isChartDataEmpty(pharmChartData) ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No data available</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <Plot
                data={pharmChartData}
                layout={{
                  ...chartLayout,
                  yaxis: { ...chartLayout.yaxis },
                  autosize: true
                }}
                config={{ 
                  displayModeBar: false,
                  responsive: true
                }}
                style={{ width: '100%', height: '100%', minHeight: '400px' }}
                useResizeHandler={true}
              />
            </div>
          )}
        </div>

        {/* Clinical Trial Chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Clinical trial by population</h3>            
          </div>
          {isChartDataEmpty(clinicalChartData) ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No data available</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <Plot
                data={clinicalChartData}
                layout={{
                  ...chartLayout,
                  yaxis: { ...chartLayout.yaxis },
                  autosize: true
                }}
                config={{ 
                  displayModeBar: false,
                  responsive: true
                }}
                style={{ width: '100%', height: '100%', minHeight: '400px' }}
                useResizeHandler={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Word Clouds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm min-h-[360px] flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Maternal MeSH word cloud</h3>
          {isLoadingWordCloud ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Generating word cloud...</p>
            </div>
          ) : maternalSvg ? (
            <div
              className="flex-1 min-h-0 h-full wordcloud-svg"
              dangerouslySetInnerHTML={{ __html: maternalSvg }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No terms available</p>
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm min-h-[360px] flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pediatric MeSH word cloud</h3>
          {isLoadingWordCloud ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Generating word cloud...</p>
            </div>
          ) : pediatricSvg ? (
            <div
              className="flex-1 min-h-0 h-full wordcloud-svg"
              dangerouslySetInnerHTML={{ __html: pediatricSvg }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No terms available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
