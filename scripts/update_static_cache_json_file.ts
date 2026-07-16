/**
 * Regenerates the derived counts in `app/data/static_data.json` from MySQL.
 *
 *   npm run update-static-cache
 *   node --experimental-strip-types scripts/update_static_cache_json_file.ts
 *
 * Updates two keys:
 *   - `overall_study_type` — the PK/PE/CT totals on the Overview stat cards.
 *   - `population_data`    — the landing-page population bar charts.
 *
 * The `druglist` and `disease` keys are hand-curated (preferred names only) and
 * are deliberately left untouched: deriving them from `concept` pulls in every
 * synonym and chemical name in the vocabulary.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DATA_PATH = join(ROOT, 'app', 'data', 'static_data.json');
const ENV_PATH = join(ROOT, '.env.local');

const STUDY_TYPES = ['PK', 'PE', 'CT'] as const;

const PARENT_COLOR = '#fbbf24';
const SUBPOPULATION_COLORS: Record<string, string> = {
  Pediatric: '#60a5fa',
  Maternal: '#f87171',
};

/** Display order. Populations found in the DB but absent here are appended to their parent group. */
const PARENT_ORDER = ['Pediatric', 'Maternal'];
const SUBPOPULATION_ORDER: Record<string, string[]> = {
  Pediatric: ['Fetal', 'Neonatal', 'Infant', 'Child', 'Adolescent'],
  Maternal: [
    'Preconception/Fertility',
    'Pregnant',
    'Peripartum',
    'Postpartum',
    'Lactation',
    'Adverse Pregnancy Outcome',
  ],
};

type StudyTypeEntry = { type: string; n: number };
type PopulationEntry = { name: string; pk: number; pe: number; ct: number; color: string };

/** Minimal .env.local reader so the script runs outside Next's runtime. */
function loadEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(ENV_PATH, 'utf8');
  } catch {
    return; // rely on the ambient environment
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}

/** PK/PE/CT totals: distinct PMIDs carrying each study type. */
async function fetchOverallStudyType(conn: mysql.Connection): Promise<StudyTypeEntry[]> {
  const [rows] = await conn.query(
    `SELECT type, COUNT(DISTINCT pmid) AS n
       FROM new_study_type
      WHERE type IN (?, ?, ?)
      GROUP BY type`,
    STUDY_TYPES as unknown as string[]
  );
  const counts = new Map((rows as any[]).map(r => [String(r.type), Number(r.n)]));
  // Keep the CT/PE/PK ordering the API route and existing file rely on.
  return ['CT', 'PE', 'PK'].map(type => ({ type, n: counts.get(type) ?? 0 }));
}

/**
 * Population bars: distinct PMIDs per population, split by study type.
 * A subpopulation's parent is inferred from the top-level population that
 * co-occurs on the most of its PMIDs, rather than hard-coded.
 */
async function fetchPopulationData(conn: mysql.Connection): Promise<PopulationEntry[]> {
  const [parentRows] = await conn.query(
    `SELECT DISTINCT type FROM new_population WHERE cate = 'Population' AND type <> ''`
  );
  const parents = new Set((parentRows as any[]).map(r => String(r.type)));

  const [countRows] = await conn.query(
    `SELECT p.type AS pop, s.type AS st, COUNT(DISTINCT p.pmid) AS n
       FROM new_population p
       JOIN new_study_type s ON s.pmid = p.pmid
      WHERE s.type IN (?, ?, ?) AND p.type <> ''
      GROUP BY p.type, s.type`,
    STUDY_TYPES as unknown as string[]
  );
  const counts = new Map<string, { pk: number; pe: number; ct: number }>();
  for (const r of countRows as any[]) {
    const pop = String(r.pop);
    const entry = counts.get(pop) ?? { pk: 0, pe: 0, ct: 0 };
    entry[String(r.st).toLowerCase() as 'pk' | 'pe' | 'ct'] = Number(r.n);
    counts.set(pop, entry);
  }

  const [coRows] = await conn.query(
    `SELECT sub.type AS subpop, pop.type AS parent, COUNT(DISTINCT sub.pmid) AS n
       FROM new_population sub
       JOIN new_population pop ON pop.pmid = sub.pmid AND pop.cate = 'Population'
      WHERE sub.cate = 'Subpopulation' AND sub.type <> ''
      GROUP BY sub.type, pop.type`
  );
  const best = new Map<string, { parent: string; n: number }>();
  for (const r of coRows as any[]) {
    const sub = String(r.subpop);
    if (parents.has(sub)) continue; // e.g. "Maternal" is also its own subpopulation row
    const n = Number(r.n);
    const cur = best.get(sub);
    if (!cur || n > cur.n) best.set(sub, { parent: String(r.parent), n });
  }

  const grouped = new Map<string, string[]>();
  for (const [sub, { parent }] of best) {
    if (!counts.has(sub)) continue;
    const siblings = grouped.get(parent) ?? [];
    siblings.push(sub);
    grouped.set(parent, siblings);
  }

  const orderedParents = [
    ...PARENT_ORDER.filter(p => parents.has(p)),
    ...[...parents].filter(p => !PARENT_ORDER.includes(p)).sort(),
  ];

  const out: PopulationEntry[] = [];
  for (const parent of orderedParents) {
    const parentCounts = counts.get(parent);
    if (parentCounts) out.push({ name: parent, ...parentCounts, color: PARENT_COLOR });

    const subColor = SUBPOPULATION_COLORS[parent] ?? PARENT_COLOR;
    const configured = SUBPOPULATION_ORDER[parent] ?? [];
    const found = grouped.get(parent) ?? [];
    const extras = found
      .filter(s => !configured.includes(s))
      .sort((a, b) => (counts.get(b)!.pe - counts.get(a)!.pe));

    for (const sub of [...configured.filter(s => found.includes(s)), ...extras]) {
      out.push({ name: sub, ...counts.get(sub)!, color: subColor });
    }
  }
  return out;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 15_000,
  });

  try {
    console.log(`Reading ${STATIC_DATA_PATH}`);
    const data = JSON.parse(readFileSync(STATIC_DATA_PATH, 'utf8')) as Record<string, unknown>;

    console.log('Querying overall_study_type ...');
    const overall_study_type = await fetchOverallStudyType(conn);
    console.log('  ' + overall_study_type.map(e => `${e.type}=${e.n.toLocaleString()}`).join('  '));

    console.log('Querying population_data (this joins two large tables, ~1-2 min) ...');
    const population_data = await fetchPopulationData(conn);
    for (const p of population_data) {
      console.log(`  ${p.name.padEnd(26)} pk=${String(p.pk).padStart(7)} pe=${String(p.pe).padStart(7)} ct=${String(p.ct).padStart(7)}`);
    }

    // Sanity check: no population may exceed its study-type total.
    const totals = Object.fromEntries(overall_study_type.map(e => [e.type.toLowerCase(), e.n]));
    for (const p of population_data) {
      for (const k of ['pk', 'pe', 'ct'] as const) {
        if (p[k] > totals[k]) {
          throw new Error(`Inconsistent: ${p.name}.${k}=${p[k]} exceeds ${k.toUpperCase()} total ${totals[k]}`);
        }
      }
    }

    writeFileSync(STATIC_DATA_PATH, JSON.stringify({ ...data, overall_study_type, population_data }));
    console.log(`\nUpdated ${STATIC_DATA_PATH}`);
    console.log('  overall_study_type and population_data refreshed; all other keys untouched.');
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Failed to update static cache:', err instanceof Error ? err.message : err);
  process.exit(1);
});
