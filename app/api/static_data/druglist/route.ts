

import { NextResponse } from 'next/server';
import data from "../../../data/static_data.json"

export async function GET() {  
  const druglist = (data as any).druglist as Array<any>;
  
  try {
    // Return the data with proper headers
    return NextResponse.json({druglist}, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error in druglist API:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to fetch druglist data'
      },
      { status: 500 }
    );
  }
}

