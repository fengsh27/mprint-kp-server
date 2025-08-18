import { NextRequest, NextResponse } from "next/server";
import { 
  queriedAtcMySql, 
  queriedEpcMySql, 
  queriedPEMySql, 
  queriedMOAMySql, 
  queriedPKMySql, 
  queriedLabelsMySql 
} from "../../../libs/database/query_db";

import type { ConceptRow, RowDict } from "../../../libs/database/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string } }
) {
  const conceptIds = (await req.json()) as ConceptRow[];
  const { path } = params;

  let rows: RowDict[] = [];

  switch (path) {
    case "atc":
      rows = await queriedAtcMySql(conceptIds);
      break;
    case "epc":
      rows = await queriedEpcMySql(conceptIds);
      break;
    case "pk":
      rows = await queriedPKMySql(conceptIds);
      break;
    case "label_stats":
      rows = await queriedLabelsMySql(conceptIds);
      break;
    default:
      return NextResponse.json({ error: "Unknown path" }, { status: 404 });
  }

  return NextResponse.json(rows);
}
