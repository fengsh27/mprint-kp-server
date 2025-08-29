import { NextResponse } from 'next/server';
import data from "../../../data/static_data.json"

export async function GET() {  
  const overall_study_type = (data as any).overall_study_type as Array<any>;
  const pk_count = overall_study_type.find((item: any) => item.type == "PK")?.n;
  const pe_count = overall_study_type.find((item: any) => item.type == "PE")?.n;
  const ct_count = overall_study_type.find((item: any) => item.type == "CT")?.n;
  
  try {
    // Static data for overall study types
    const overallStudyData = {
      pk: {
        count: pk_count,
        label: "Pharmacokinetics",
        description: "Studies examining how drugs are absorbed, distributed, metabolized, and excreted in the body"
      },
      pe: {
        count: pe_count,
        label: "Pharmacoepidemiology", 
        description: "Studies examining the use and effects of drugs in large populations"
      },
      ct: {
        count: ct_count,
        label: "Clinical Trial",
        description: "Controlled studies evaluating the safety and efficacy of drugs in human subjects"
      }
    };

    // Return the data with proper headers
    return NextResponse.json(overallStudyData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error in overall study type API:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Failed to fetch overall study type data'
      },
      { status: 500 }
    );
  }
}
