import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'drug_class.db');

interface DrugClassHierarchy {
  level1: string[];
  level2: string[];
  level3: string[];
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

    const db = new Database(DB_PATH, { readonly: true });

    try {
      // Get all unique level1, level2, level3 values from any population table
      // We'll use the first available population table
      const populations = ['pregnancy', 'postpartum', 'ped01', 'ped112', 'ped1218'];
      let tableName = '';
      
      // Find first available table
      for (const pop of populations) {
        const tableExists = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `).get(pop);
        if (tableExists) {
          tableName = pop;
          break;
        }
      }

      if (!tableName) {
        return NextResponse.json(
          { error: 'No population table found' },
          { status: 404 }
        );
      }

      // Get unique level1 values
      const level1Query = `
        SELECT DISTINCT json_each.value as value
        FROM ${tableName}
        CROSS JOIN json_each(level1)
        WHERE level1 IS NOT NULL AND level1 != 'null' AND level1 != ''
        ORDER BY json_each.value
      `;
      const level1Rows = db.prepare(level1Query).all() as Array<{ value: string }>;
      const level1 = level1Rows.map(row => row.value).filter(Boolean);

      // Get unique level2 values
      const level2Query = `
        SELECT DISTINCT json_each.value as value
        FROM ${tableName}
        CROSS JOIN json_each(level2)
        WHERE level2 IS NOT NULL AND level2 != 'null' AND level2 != ''
        ORDER BY json_each.value
      `;
      const level2Rows = db.prepare(level2Query).all() as Array<{ value: string }>;
      const level2 = level2Rows.map(row => row.value).filter(Boolean);

      // Get unique level3 values
      const level3Query = `
        SELECT DISTINCT json_each.value as value
        FROM ${tableName}
        CROSS JOIN json_each(level3)
        WHERE level3 IS NOT NULL AND level3 != 'null' AND level3 != ''
        ORDER BY json_each.value
      `;
      const level3Rows = db.prepare(level3Query).all() as Array<{ value: string }>;
      const level3 = level3Rows.map(row => row.value).filter(Boolean);

      const result: DrugClassHierarchy = {
        level1,
        level2,
        level3
      };

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
    console.error('Error in drug_class list API:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch drug class list',
      },
      { status: 500 }
    );
  }
}

