// app/api/type_population/route.ts
import { NextResponse } from "next/server";
import { queriedType } from "../../libs/database/query_db";
import type { PmidRow } from "../../libs/database/types";

export async function POST(req: Request) {
  const requestStartTime = performance.now();
  const body = (await req.json()) as PmidRow[];
  const rows = await queriedType(body.map(item => item.pmid));
  
  const requestEndTime = performance.now();
  const requestDurationMs = requestEndTime - requestStartTime;
  console.log(`[API_TIMING] type_population: ${Math.round(requestDurationMs * 100) / 100}ms (${(requestDurationMs / 1000).toFixed(3)}s), resultCount: ${rows.length}, pmidCount: ${body.length}`);
  
  return NextResponse.json(rows);
}
