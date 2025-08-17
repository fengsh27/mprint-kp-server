import { NextResponse } from 'next/server';
import * as data from "../../data/static_data.json"


export async function GET() {
  return NextResponse.json({ 
    message: "API is working!",
    timestamp: new Date().toISOString()
  });
} 

export async function POST(request: Request) {
  const druglist = (data as any).druglist as Array<any>;
  console.log(druglist);
  return NextResponse.json({ message: "POST request received", timestamp: new Date().toISOString() });
}