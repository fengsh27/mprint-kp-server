import { NextResponse } from "next/server";


export async function POST(req: Request) {
  const { pmidData, typeData } = await req.json();
  //const data = await daDownloadData(pmidData, typeData);
  return NextResponse.json({});
}
