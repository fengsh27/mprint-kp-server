// app/api/pmids/route.ts
import { NextResponse } from "next/server";
import { queriedPMIDMySql } from "../../libs/database/query_db";
import type { QueriedPmidInput } from "../../libs/database/types";

export async function POST(req: Request) {
  const body = (await req.json()) as QueriedPmidInput;
  const rows = await queriedPMIDMySql(body);
  return NextResponse.json(rows);
}
