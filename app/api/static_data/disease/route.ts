

import { NextResponse } from 'next/server';
import data from "../../../data/static_data.json"

export async function GET() {  
  const disease = (data as any).disease as Array<any>;
  
  try {
    // Return the data with proper headers
    return NextResponse.json({disease}, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error in disease API:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to fetch disease data'
      },
      { status: 500 }
    );
  }
}

