import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiEndpoints = {
      info: {
        title: "Knowledge Portal API",
        description: "API endpoints for the Knowledge Portal (Silver) dashboard",
        version: "1.0.0",
        baseUrl: "/api"
      },
      endpoints: [
        {
          path: "/api/index",
          method: "GET",
          description: "List all available API endpoints",
          parameters: "None",
          response: "List of all endpoints with descriptions"
        },
        {
          path: "/api/static_data/overall_study_type",
          method: "GET",
          description: "Get overall study type statistics",
          parameters: "None",
          response: "JSON with pharmacokinetics, pharmacoepidemiology, and clinical trial counts"
        }
      ],
      categories: {
        "Data Endpoints": [
          {
            path: "/api/static_data/overall_study_type",
            description: "Overall study type statistics and counts"
          }
        ],
        "Utility Endpoints": [
          {
            path: "/api/index",
            description: "API documentation and endpoint listing"
          }
        ]
      },
      usage: {
        example: "GET /api/static_data/overall_study_type",
        responseFormat: "JSON",
        authentication: "None required",
        rateLimit: "No limits currently applied"
      }
    };

    return NextResponse.json(apiEndpoints, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error in API index:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to fetch API index'
      },
      { status: 500 }
    );
  }
} 