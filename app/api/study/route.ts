// app/api/type_population/route.ts
import { NextResponse } from "next/server";
import { queriedStudy } from "../../libs/database/query_db";

export async function POST(req: Request) {
  const body = (await req.json());
  const pmids = body.map((item: any) => item.pmid);
  const rows = await queriedStudy(pmids);
  return NextResponse.json(rows);
}
