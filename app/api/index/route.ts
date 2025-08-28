import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiEndpoints = {
      info: {
        title: "Knowledge Portal API",
        description: "Comprehensive API endpoints for the Knowledge Portal (Silver) dashboard - A platform for pharmacokinetics, pharmacoepidemiology, and clinical trial data",
        version: "1.0.0",
        baseUrl: "/api",
        contact: "API Documentation",
        lastUpdated: new Date().toISOString()
      },
      endpoints: [
        {
          path: "/api/index",
          method: "GET",
          description: "Get comprehensive API documentation and endpoint listing",
          parameters: "None",
          response: "Complete API documentation with all endpoints, examples, and usage information",
          example: "GET /api/index"
        },
        {
          path: "/api/static_data/overall_study_type",
          method: "GET",
          description: "Get overall study type statistics and counts",
          parameters: "None",
          response: "JSON with pharmacokinetics, pharmacoepidemiology, and clinical trial counts",
          example: "GET /api/static_data/overall_study_type"
        },
        {
          path: "/api/static_data/disease",
          method: "GET",
          description: "Get list of all available diseases",
          parameters: "None",
          response: "JSON array of disease data",
          example: "GET /api/static_data/disease"
        },
        {
          path: "/api/static_data/druglist",
          method: "GET",
          description: "Get list of all available drugs",
          parameters: "None",
          response: "JSON array of drug data",
          example: "GET /api/static_data/druglist"
        },
        {
          path: "/api/concepts",
          method: "GET",
          description: "Query concepts by drug and/or disease names",
          parameters: "Query parameters: drug (string, optional), disease (string, optional)",
          response: "JSON array of concept data with CUI and type",
          example: "GET /api/concepts?drug=aspirin&disease=diabetes"
        },
        {
          path: "/api/pmid",
          method: "POST",
          description: "Query PMIDs based on concept IDs and search type",
          parameters: "JSON body: { conceptIds: [{ cui: string, type: 'drug'|'disease' }], searchType: 'Drug'|'Disease'|['Drug','Disease'] }",
          response: "JSON array of PMID data",
          example: "POST /api/pmid with body: {\"conceptIds\":[{\"cui\":\"C0004057\",\"type\":\"drug\"}],\"searchType\":\"Drug\"}"
        },
        {
          path: "/api/study",
          method: "POST",
          description: "Get study information by PMIDs",
          parameters: "JSON body: Array of objects with PMID property",
          response: "JSON array of study data including title, year, studied drugs, and diseases",
          example: "POST /api/study with body: [{\"pmid\":\"12345678\"},{\"pmid\":\"87654321\"}]"
        },
        {
          path: "/api/type_population",
          method: "POST",
          description: "Get study type and population information by PMIDs",
          parameters: "JSON body: Array of objects with PMID property",
          response: "JSON array of type and population data",
          example: "POST /api/type_population with body: [{\"pmid\":\"12345678\"}]"
        },
        {
          path: "/api/download/publications",
          method: "POST",
          description: "Download publication data (currently returns empty response)",
          parameters: "JSON body: { pmidData: any[], typeData: any[] }",
          response: "JSON response (currently empty)",
          example: "POST /api/download/publications with body: {\"pmidData\":[],\"typeData\":[]}"
        },
        {
          path: "/api/extradata/[path]",
          method: "GET",
          description: "Get extra data by path parameter",
          parameters: "Path parameter: [path] - dynamic path segment",
          response: "JSON data based on the path",
          example: "GET /api/extradata/some-path"
        }
      ],
      categories: {
        "Data Retrieval": [
          {
            path: "/api/static_data/overall_study_type",
            description: "Overall study type statistics and counts"
          },
          {
            path: "/api/static_data/disease",
            description: "List of all available diseases"
          },
          {
            path: "/api/static_data/druglist",
            description: "List of all available drugs"
          }
        ],
        "Search & Query": [
          {
            path: "/api/concepts",
            description: "Query concepts by drug/disease names"
          },
          {
            path: "/api/pmid",
            description: "Query PMIDs by concept IDs and search type"
          },
          {
            path: "/api/study",
            description: "Get study information by PMIDs"
          },
          {
            path: "/api/type_population",
            description: "Get study type and population data"
          }
        ],
        "Download & Export": [
          {
            path: "/api/download/publications",
            description: "Download publication data"
          }
        ],
        "Utility": [
          {
            path: "/api/index",
            description: "API documentation and endpoint listing"
          },
          {
            path: "/api/extradata/[path]",
            description: "Dynamic extra data retrieval"
          }
        ]
      },
      usage: {
        baseUrl: "https://your-domain.com/api",
        authentication: "None required",
        rateLimit: "Rate limiting applied per endpoint type",
        responseFormat: "JSON",
        errorHandling: "Standard HTTP status codes with error messages",
        caching: "Public endpoints cached for 1 hour",
        security: "Input validation, SQL injection protection, request size limits"
      },
      rateLimiting: {
        "General API": "100 requests per minute per IP",
        "Search Endpoints": "30 requests per minute per IP",
        "Download Endpoints": "10 requests per minute per IP",
        "Headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
        "Response": "429 Too Many Requests with Retry-After header"
      },
      security: {
        "Input Validation": "All inputs validated for type, length, and format",
        "SQL Injection Protection": "Pattern-based detection and blocking",
        "Request Size Limits": "GET: 1MB, POST: 5MB maximum",
        "Security Headers": "XSS protection, content type options, frame options",
        "Input Sanitization": "Automatic removal of potentially harmful content",
        "Logging": "Security events logged for monitoring"
      },
      examples: {
        "Get All Diseases": {
          request: "GET /api/static_data/disease",
          response: "{\"disease\":[...]}"
        },
        "Search Concepts": {
          request: "GET /api/concepts?drug=aspirin&disease=diabetes",
          response: "[{\"cui\":\"C0004057\",\"type\":\"drug\"},...]"
        },
        "Query PMIDs": {
          request: "POST /api/pmid",
          body: "{\"conceptIds\":[{\"cui\":\"C0004057\",\"type\":\"drug\"}],\"searchType\":\"Drug\"}",
          response: "[{\"pmid\":\"12345678\"},...]"
        },
        "Get Study Data": {
          request: "POST /api/study",
          body: "[{\"pmid\":\"12345678\"}]",
          response: "[{\"PMID\":\"12345678\",\"Title\":\"Study Title\",\"Year\":\"2023\",\"StudiedDrugs\":\"aspirin\",\"StudiedDiseases\":\"diabetes\"}]"
        }
      },
      dataTypes: {
        "ConceptRow": {
          description: "Concept data structure",
          fields: {
            "cui": "string - Concept Unique Identifier",
            "type": "'drug' | 'disease' - Concept type"
          }
        },
        "StudyResult": {
          description: "Study information structure",
          fields: {
            "PMID": "string - PubMed ID",
            "Title": "string - Study title",
            "Year": "string - Publication year",
            "StudiedDrugs": "string - Comma-separated drug names",
            "StudiedDiseases": "string - Comma-separated disease names"
          }
        },
        "TypeData": {
          description: "Study type and population data",
          fields: {
            "pmid": "string - PubMed ID",
            "study_type": "string - Type of study",
            "population": "string - Population studied"
          }
        }
      },
      errorCodes: {
        "200": "Success - Request completed successfully",
        "400": "Bad Request - Invalid parameters or request format",
        "404": "Not Found - Endpoint or resource not found",
        "500": "Internal Server Error - Server-side error occurred"
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