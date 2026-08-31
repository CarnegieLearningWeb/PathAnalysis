# CLAUDE.md

Path Analysis Tool — React + TypeScript + Vite app that visualizes student learning paths as directed graphs (`graphviz-react`). User-facing details: `README.md`.

Only non-obvious things live here. Read the code for the rest.

## Gotchas

- **Use bun, not npm.** Deploy runs `bun install && bun run build`. `package-lock.json` is a stray from someone running `npm install` — ignore it, `bun.lock` is authoritative. (`dev:full` still shells out to `npm run` internally; harmless, but don't copy the pattern.)
- **`bun run lint` is broken** — no eslint config file exists at the flat-config path ESLint 8 wants. Pre-existing. Don't chase it unless asked.
- **No test runner.** No vitest/jest. Verify with `bun run build` (tsc + vite build).
- **Env var names disagree with `.env`.** Code reads `VITE_ACCESS_KEY_ID`/`VITE_SECRET_ACCESS_KEY`; the old `.env` template used `VITE_AWS_*`. Trust `src/lib/dataFetchingHooks.ts`, not the template. `.env` is gitignored — never commit it or paste its contents anywhere.
- **Two deploy paths exist**: `amplify.yml` (AWS Amplify) and `.github/workflows/deployVercel.yml` (Vercel CLI). Changing build steps may need both.

## Commands

`bun run dev` (Vite only) · `bun run dev:full` (Vite + local Express API — needed for the GitHub-backed data file feature) · `bun run api` (API alone) · `bun run build`

## Where things are

- `src/components/GraphvizParent.tsx` — graph orchestration; `GraphvizProcessing.ts` — data → dot shaping. Start here for anything graph-related.
- `src/lib/` — `dataFetchingHooks.ts` (React Query + AWS), `dataProcessingUtils.ts`, `GradPromUtils.ts`, `fileWorker.ts` (CSV parsing in a worker), `types.ts`, `routes.tsx`.
- `api/` — Vercel serverless functions proxying to a GitHub repo (default `CarnegieLearningWeb/PathAnalysis`) for data files. `server.ts` + `start-api-server.js` run the same handlers as an Express server locally.

## Conventions

- Graph settings are **per-graph**, not global — each rendered graph owns its min-visits threshold and color mode. Follow that when adding settings.
- `src/components/ui/` is the shadcn/Radix layer. Compose from it; don't add UI deps for something it or an installed lib already covers.
