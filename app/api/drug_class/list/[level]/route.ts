import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'drug_class.db');

interface DrugClassWithLabel {
  value: string;
  label: string;
  preferred_label: string | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ level: string }> }
) {
  try {
    const { level } = await params;
    
    // Validate level parameter
    if (!['1', '2', '3'].includes(level)) {
      return NextResponse.json(
        { error: 'Invalid level. Must be 1, 2, or 3' },
        { status: 400 }
      );
    }

    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json(
        { error: 'Database file not found' },
        { status: 404 }
      );
    }

    const db = new Database(DB_PATH, { readonly: true });

    try {
      // Get all unique level values from any population table
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

      // Get unique level values with preferred labels from ATC table
      const levelQuery = `
        SELECT DISTINCT json_each.value as value
        FROM ${tableName}
        CROSS JOIN json_each(level${level})
        WHERE level${level} IS NOT NULL AND level${level} != 'null' AND level${level} != ''
        ORDER BY json_each.value
      `;
      const levelRows = db.prepare(levelQuery).all() as Array<{ value: string }>;
      const levelValues = levelRows.map(row => row.value).filter(Boolean);

      // Get preferred labels from ATC table
      const result: DrugClassWithLabel[] = levelValues.map(value => {
        const atcRow = db.prepare(`
          SELECT preferred_label 
          FROM ATC 
          WHERE level_code = ?
        `).get(value) as { preferred_label: string | null } | undefined;

        const preferred_label = atcRow?.preferred_label || null;
        const displayLabel = preferred_label 
          ? `${value} - ${preferred_label}`
          : value;

        return {
          value,
          label: displayLabel,
          preferred_label
        };
      });

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
    console.error('Error in drug_class list by level API:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch drug class list',
      },
      { status: 500 }
    );
  }
}

