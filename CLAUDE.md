# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server at http://localhost:3000
- `npm run build` — production build (Next.js 15, `output: 'standalone'` in `next.config.ts`)
- `npm run start` — run built app
- `npm run lint` — Next.js/ESLint checks
- `npm run release` — cut a versioned release via `standard-version`

No test framework is configured. If adding tests, also add an `npm run test` script and colocate files under `app/feature/__tests__/`.

Python scripts in `scripts/` (used for dataset preparation and word-cloud generation at runtime) require the deps in `requirements.txt`. The Dockerfile installs both Node and Python into a single runtime image.

## Environment

The MySQL pool (`app/libs/database/silverdb.ts`) reads `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` from the environment. Local config lives in `.env.local`. Rate-limiting and validation limits are tuned via env vars documented in `SECURITY.md` (e.g. `RATE_LIMIT_MAX_REQUESTS`, `MAX_STRING_LENGTH`, `SEARCH_RATE_LIMIT_MAX_REQUESTS`).

## Architecture

This is a Next.js 15 App Router app (React 19 + TypeScript + Tailwind 4) that serves a pharmacology knowledge portal over a MySQL database of PubMed-derived data. The client renders tabs of drug/disease/study visualizations; the server exposes JSON APIs that query MySQL and occasionally shell out to Python for word-cloud image generation.

### Request flow (client → MySQL)

1. **UI components** in `app/components/` (`home.tsx` is the root; tabs: `OverviewTab`, `DrugTab`, `DrugClassTab`, `PublicationTab`, `PKModelsTab`, `AuthorNetworkTab`, `WordCloud`). `AuthorNetworkTab` is dynamically imported (`ssr: false`) because it depends on `cytoscape`.
2. **Data accessor layer** `app/dataprovider/`:
   - `access-api.ts` — typed `fetch` wrapper (`api.get/post/put/del`) with retries on 429/502/503/504, `ApiError` class, automatic JSON body handling, and `AbortSignal` support. Use this instead of raw `fetch` from the client.
   - `dataaccessor.ts` — `da*` functions (`daGetConcepts`, `daGetPMIDs`, `daGetStudy`, `daGetWordClouds`, `daGetAuthorNetwork`, `daExportStudy`, etc.) are the only API surface UI code should call.
3. **Next.js route handlers** under `app/api/*/route.ts`: `concepts`, `pmid`, `extradata/{atc|epc|pe|moa|pk|label_stats}`, `type_population`, `mesh_terms`, `word_clouds`, `author_network`, `study` (+ `count`, `export`), `drug_class` (+ `list`), `static_data/*`, `download`, `test`. Each handler: validates input, rate-limits, calls query functions, adds security headers.
4. **Query layer** `app/libs/database/query_db.ts` — all SQL lives here. Key conventions:
   - `placeholders(n)` builds `?,?,?` for `IN (...)` clauses with `mysql2` positional params; never string-interpolate user input.
   - Large PMID lists are **batched** (typically 1000; 10000 for `queriedStudyCount`) — follow this when adding new PMID-based queries.
   - Queries are wrapped in `timeQuery` / `timeBatchedQuery` (from `query_timer.ts`) for structured timing logs.
   - `dedup_rows` handles distinct-by-key (mirrors R's `distinct()` from the original R pipeline).
   - Concept lookup (`queryConceptsMySql`): when a search term resolves to a disease, it recursively expands to child CUIs via the `rel` table.
5. **Pool** `silverdb.ts` exports a single `mysql2/promise` pool consumed across handlers.

### Security middleware (non-negotiable for new API routes)

Every route handler in `app/api/` must use the security stack from `app/libs/middleware/`:

- `withRateLimit(handler, <limiter>)` — wrap the handler. Pick the right limiter: `searchRateLimiter` for query endpoints, `downloadRateLimiter` for exports, default otherwise.
- `validateRequestSize(req, mb)` — 1 MB for GET, 5 MB for POST.
- `InputValidator.validateString` / `validateArray` / `validatePMID` / `validateCUI` — validate every user-supplied field.
- `detectSQLInjection(input)` — call on raw string inputs before use.
- `sanitizeInput` — strip HTML/JS from free-text fields.
- `logSecurityEvent(req, 'EVENT_NAME', details)` — log rejections.
- `addSecurityHeaders(response)` — apply before returning.

`MAX_QUERIED_ARRAY_LENGTH` in `app/libs/constants.ts` is the hard cap on array-body sizes (PMIDs, concept lists). See `SECURITY.md` for the full threat model; don't weaken these limits without reason.

### Database schema

Documented in `docs/database_schema.md`. Core tables the query layer hits:
- `concept`, `rel` — CUI lookup + disease hierarchy expansion.
- `new_pmid2drug`, `new_pmid2disease` — PMID↔CUI inverted indexes used by `queriedPMIDMySql`.
- `atc`, `epc`, `pe`, `moa`, `pk`, `label_stats` — per-drug "extra data" tables fetched by `fetch_by_cui_list`.
- `new_study_type`, `new_population`, `maternal_database_with_scores`, `pediatric_database_with_scores` — joined in `queriedType` and mesh-term queries.
- `cache_full_study` — denormalized publication table for `/api/study` (built by `scripts/create_cache_full_study.py`).
- `pubmed_author_affiliation` — used by the author-network feature.

### Word cloud generation

`/api/word_clouds` (route + `app/libs/wordcloud.ts`) fetches mesh-term rows, filters via `STOP_WORDS` and user keywords, writes a temp CSV, and shells out to `scripts/word_cloud_generator.py` via `execFile`. The Dockerfile explicitly copies this script and installs Python so both runtimes coexist at runtime.

### Python scripts

`scripts/` contains one-shot ETL helpers (`process_maternal_database_with_scores.py`, `process_pediatric_database_with_scores.py`, `process_drug_class.py`, `create_cache_full_study.py`, `create_mesh_term_indexes.py`, `extract_author_from_pubmed.py`) plus the runtime `word_cloud_generator.py`. The ETL scripts build the MySQL tables the Next.js app queries — changing a query often means also updating the relevant script.

## Conventions

- Never interpolate user input into SQL — use `placeholders(n)` + positional params.
- Batch any query over a PMID or CUI list larger than ~1000; use `timeBatchedQuery` for visibility.
- Client code should go through `dataaccessor.ts` rather than constructing fetch URLs inline.
- Commit messages follow conventional style (`feat:`, `fix:`, `chore(release): X.Y.Z`).
