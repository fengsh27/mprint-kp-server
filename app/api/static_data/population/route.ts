import { NextResponse } from 'next/server';
import data from "../../../data/static_data.json"

export async function GET() {
  const population_data = (data as any).population_data as Array<any>;

  try {
    // Return the data with proper headers
    return NextResponse.json({ population_data }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error in population API:', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to fetch population data'
      },
      { status: 500 }
    );
  }
}
