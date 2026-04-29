import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'drug_class.db');

interface DrugClassRow {
  GENNME_manual: string;
  level1: string | null;
  level2: string | null;
  level3: string | null;
  count_pk: number | null;
  count_pe: number | null;
  count_ct: number | null;
}

export async function GET(req: NextRequest) {
  try {
    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json(
        { error: 'Database file not found' },
        { status: 404 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const heatmapType = searchParams.get('type') || 'drugs'; // 'drugs', 'level1', 'level2', 'level3'
    const population = searchParams.get('population');
    const drugClass = searchParams.get('drugClass'); // Filter drugs by specific drug class

    const VALID_HEATMAP_TYPES = new Set(['drugs', 'level1', 'level2', 'level3']);
    const VALID_POPULATIONS = new Set(['pregnancy', 'postpartum', 'ped01', 'ped112', 'ped1218']);

    if (!VALID_HEATMAP_TYPES.has(heatmapType)) {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
    if (population && !VALID_POPULATIONS.has(population)) {
      return NextResponse.json({ error: 'Invalid population parameter' }, { status: 400 });
    }

    const db = new Database(DB_PATH, { readonly: true });

    try {
      // Get all populations if not specified
      const populations = population
        ? [population]
        : ['pregnancy', 'postpartum', 'ped01', 'ped112', 'ped1218'];

      const result: Record<string, any> = {};

      for (const pop of populations) {
        let query = '';
        let groupBy = '';

        if (heatmapType === 'drugs') {
          // Filter by drug class if provided - use a subquery approach
          if (drugClass) {
            query = `
              SELECT DISTINCT
                t.GENNME_manual as name,
                COALESCE(t.count_pk, 0) as pk,
                COALESCE(t.count_pe, 0) as pe,
                COALESCE(t.count_ct, 0) as ct,
                COALESCE(t.count_vc, 0) as vc,
                COALESCE(t.count_fbnstp, 0) as fbnstp,
                COALESCE(t.count_biomarker, 0) as biomarker,
                COALESCE(t.count_all, 0) as count_all
              FROM ${pop} t
              WHERE t.GENNME_manual IS NOT NULL AND t.GENNME_manual != ''
                AND (COALESCE(t.count_pk, 0) + COALESCE(t.count_pe, 0) + COALESCE(t.count_ct, 0) + 
                     COALESCE(t.count_vc, 0) + COALESCE(t.count_fbnstp, 0) + COALESCE(t.count_biomarker, 0)) > 0
                AND (
                  EXISTS (
                    SELECT 1 FROM json_each(t.level1) 
                    WHERE json_each.value = ?
                  )
                  OR EXISTS (
                    SELECT 1 FROM json_each(t.level2) 
                    WHERE json_each.value = ?
                  )
                  OR EXISTS (
                    SELECT 1 FROM json_each(t.level3) 
                    WHERE json_each.value = ?
                  )
                )
              ORDER BY COALESCE(t.count_all, 0) DESC, t.GENNME_manual
            `;
          } else {
            query = `
              SELECT 
                GENNME_manual as name,
                COALESCE(count_pk, 0) as pk,
                COALESCE(count_pe, 0) as pe,
                COALESCE(count_ct, 0) as ct,
                COALESCE(count_vc, 0) as vc,
                COALESCE(count_fbnstp, 0) as fbnstp,
                COALESCE(count_biomarker, 0) as biomarker,
                COALESCE(count_all, 0) as count_all
              FROM ${pop}
              WHERE GENNME_manual IS NOT NULL AND GENNME_manual != ''
                AND (COALESCE(count_pk, 0) + COALESCE(count_pe, 0) + COALESCE(count_ct, 0) + 
                     COALESCE(count_vc, 0) + COALESCE(count_fbnstp, 0) + COALESCE(count_biomarker, 0)) > 0
              ORDER BY COALESCE(count_all, 0) DESC, GENNME_manual
            `;
          }
        } else if (heatmapType === 'level1') {
          query = `
            SELECT 
              json_each.value as name,
              SUM(COALESCE(count_pk, 0)) as pk,
              SUM(COALESCE(count_pe, 0)) as pe,
              SUM(COALESCE(count_ct, 0)) as ct,
              SUM(COALESCE(count_vc, 0)) as vc,
              SUM(COALESCE(count_fbnstp, 0)) as fbnstp,
              SUM(COALESCE(count_biomarker, 0)) as biomarker,
              SUM(COALESCE(count_all, 0)) as count_all
            FROM ${pop}
            CROSS JOIN json_each(level1)
            WHERE level1 IS NOT NULL AND level1 != 'null' AND level1 != ''
            GROUP BY json_each.value
            HAVING (SUM(COALESCE(count_pk, 0)) + SUM(COALESCE(count_pe, 0)) + SUM(COALESCE(count_ct, 0)) + 
                    SUM(COALESCE(count_vc, 0)) + SUM(COALESCE(count_fbnstp, 0)) + SUM(COALESCE(count_biomarker, 0))) > 0
            ORDER BY SUM(COALESCE(count_all, 0)) DESC, json_each.value
          `;
        } else if (heatmapType === 'level2') {
          query = `
            SELECT 
              json_each.value as name,
              SUM(COALESCE(count_pk, 0)) as pk,
              SUM(COALESCE(count_pe, 0)) as pe,
              SUM(COALESCE(count_ct, 0)) as ct,
              SUM(COALESCE(count_vc, 0)) as vc,
              SUM(COALESCE(count_fbnstp, 0)) as fbnstp,
              SUM(COALESCE(count_biomarker, 0)) as biomarker,
              SUM(COALESCE(count_all, 0)) as count_all
            FROM ${pop}
            CROSS JOIN json_each(level2)
            WHERE level2 IS NOT NULL AND level2 != 'null' AND level2 != ''
            GROUP BY json_each.value
            HAVING (SUM(COALESCE(count_pk, 0)) + SUM(COALESCE(count_pe, 0)) + SUM(COALESCE(count_ct, 0)) + 
                    SUM(COALESCE(count_vc, 0)) + SUM(COALESCE(count_fbnstp, 0)) + SUM(COALESCE(count_biomarker, 0))) > 0
            ORDER BY SUM(COALESCE(count_all, 0)) DESC, json_each.value
          `;
        } else if (heatmapType === 'level3') {
          query = `
            SELECT 
              json_each.value as name,
              SUM(COALESCE(count_pk, 0)) as pk,
              SUM(COALESCE(count_pe, 0)) as pe,
              SUM(COALESCE(count_ct, 0)) as ct,
              SUM(COALESCE(count_vc, 0)) as vc,
              SUM(COALESCE(count_fbnstp, 0)) as fbnstp,
              SUM(COALESCE(count_biomarker, 0)) as biomarker,
              SUM(COALESCE(count_all, 0)) as count_all
            FROM ${pop}
            CROSS JOIN json_each(level3)
            WHERE level3 IS NOT NULL AND level3 != 'null' AND level3 != ''
            GROUP BY json_each.value
            HAVING (SUM(COALESCE(count_pk, 0)) + SUM(COALESCE(count_pe, 0)) + SUM(COALESCE(count_ct, 0)) + 
                    SUM(COALESCE(count_vc, 0)) + SUM(COALESCE(count_fbnstp, 0)) + SUM(COALESCE(count_biomarker, 0))) > 0
            ORDER BY SUM(COALESCE(count_all, 0)) DESC, json_each.value
          `;
        }

        if (query) {
          let stmt;
          if (drugClass && heatmapType === 'drugs') {
            stmt = db.prepare(query);
            const rows = stmt.all(drugClass, drugClass, drugClass) as Array<{ name: string; pk: number; pe: number; ct: number; vc: number; fbnstp: number; biomarker: number; count_all: number }>;
            result[pop] = rows;
          } else {
            stmt = db.prepare(query);
            const rows = stmt.all() as Array<{ name: string; pk: number; pe: number; ct: number; vc: number; fbnstp: number; biomarker: number; count_all: number }>;
            result[pop] = rows;
          }
        }
      }

      return NextResponse.json(result, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } finally {
      db.close();
    }
  } catch (error: any) {
    console.error('Error in drug_class API:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch drug class data',
      },
      { status: 500 }
    );
  }
}

