# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds the Next.js App Router pages, layouts, API routes, and UI components.
- `app/api/` contains server endpoints (e.g., `app/api/test/route.ts`).
- `app/libs/` and `app/dataprovider/` host shared utilities and data access helpers.
- `public/` contains static assets served at the site root.
- `data/` stores domain datasets and CSVs used by the app and scripts.
- `scripts/` includes data processing helpers (Python).
- `types/` contains shared TypeScript types.

## Build, Test, and Development Commands
- `npm run dev`: start the local Next.js dev server at `http://localhost:3000`.
- `npm run build`: compile the production build.
- `npm run start`: run the built app in production mode.
- `npm run lint`: run Next.js/ESLint checks.
- `npm run release`: cut a versioned release via `standard-version`.

## Coding Style & Naming Conventions
- Language: TypeScript + React (Next.js 15) in `app/`.
- Indentation: 2 spaces (default for Next.js/ESLint; keep consistent with existing files).
- Naming: prefer `camelCase` for variables/functions, `PascalCase` for React components, and `kebab-case` for route segments.
- Styling: Tailwind CSS is configured (`tailwind.config.js`, `postcss.config.mjs`).

## Testing Guidelines
- No dedicated test framework is configured. If you add tests, document the runner and add a `npm run test` script.
- Keep future test files near their targets (e.g., `app/feature/__tests__/feature.test.ts`).

## Commit & Pull Request Guidelines
- Commit messages follow a conventional style in recent history (e.g., `chore(release): 0.1.15`). Keep type scopes consistent.
- PRs should include a clear description, linked issues (if any), and notes on data or schema changes. Add screenshots for UI changes.

## Security & Configuration
- Review `SECURITY.md` for rate-limiting and input validation expectations.
- Local config lives in `.env.local` (do not commit secrets). Use `docker-compose.yml` and `Dockerfile` for containerized runs.


