// app/api/concepts/route.ts
import { NextResponse } from "next/server";
import pool from "../../libs/database/silverdb"
import { 
  queryConceptsMySql,
  queriedAtcMySql,
} from "../../libs/database/query_db";
import type { QueryInputs } from "../../libs/database/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  
  const inputs: QueryInputs = {
    drugName: url.searchParams.get("drug")?.trim() ?? undefined,
    diseaseName: url.searchParams.get("disease")?.trim() ?? undefined,
  };
  if (inputs.drugName?.length === 0) {
    inputs.drugName = undefined;
  }
  if (inputs.diseaseName?.length === 0) {
    inputs.diseaseName = undefined;
  }

  const rows = await queryConceptsMySql(pool, inputs);
  return NextResponse.json(rows);
}
