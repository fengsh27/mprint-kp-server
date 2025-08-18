// app/api/type_population/route.ts
import { NextResponse } from "next/server";
import { queriedType } from "../../libs/database/query_db";
import type { PmidRow } from "../../libs/database/types";

export async function POST(req: Request) {
  const body = (await req.json()) as PmidRow[];
  const rows = await queriedType(body.map(item => item.pmid));
  return NextResponse.json(rows);
}
