# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

Path Analysis Tool — a React + TypeScript + Vite app that visualizes student learning paths through educational content as directed graphs (Graphviz via `graphviz-react`). See `README.md` for feature/user-facing details.

## Package manager

Use **bun**, not npm. `amplify.yml` (the production deploy config) runs `bun install && bun run build`. A stray `package-lock.json` exists from someone running plain `npm install` — prefer `bun.lock` and `bun install`/`bun run <script>` for consistency with deploy.

## Commands

- `bun run dev` — Vite dev server only.
- `bun run dev:full` — Vite + local Express API server together (needed for the GitHub-backed data file feature).
- `bun run api` — local API server alone (`start-api-server.js`).
- `bun run build` — `tsc` typecheck then `vite build`.
- `bun run lint` — eslint (currently broken: no eslint config file present at the flat-config path ESLint 8 expects; pre-existing, not caused by dependency updates).

There is no test runner configured in this repo (no vitest/jest).

## Architecture

- `src/components/` — UI. Key pieces: `GraphvizParent.tsx` (main graph orchestration), `GraphvizProcessing.ts` (data shaping for graph rendering), `GraphMenu.tsx` + `GraphMinVisitsSlider.tsx` (per-graph settings, one min-visits threshold per rendered graph), `FilterComponent.tsx` (multi-checkbox status filter), `SequenceSelector.tsx`/`SequenceFilterCheckbox.tsx` (Selected Sequence graph), `Upload.tsx`/`DropZone.tsx` (CSV/TSV upload). `src/components/ui/` is the shadcn/Radix primitive layer — prefer composing from there over adding new UI deps.
- `src/lib/` — `dataFetchingHooks.ts` (React Query + AWS-backed data fetching), `dataProcessingUtils.ts`, `GradPromUtils.ts`, `fileWorker.ts` (web worker for CSV parsing off the main thread), `types.ts`, `routes.tsx`.
- `api/` — Vercel serverless functions that proxy to a GitHub repo (default `CarnegieLearningWeb/PathAnalysis`) to list/fetch/upload data files. `server.ts` (root) + `start-api-server.js` run the same thing as a local Express server for dev.

## Environment variables

See README's Environment Variables section. Notably: code reads `VITE_ACCESS_KEY_ID`/`VITE_SECRET_ACCESS_KEY`, while the local `.env` template historically used `VITE_AWS_ACCESS_KEY_ID`/`VITE_AWS_SECRET_ACCESS_KEY` — check actual var names in `src/lib/dataFetchingHooks.ts` if data fetching auth isn't working locally, don't assume the `.env` file's naming is current.

`.env` is gitignored — never commit it, and don't paste its contents into commits, PRs, or issues.

## Conventions

- Follow existing patterns in `GraphvizParent.tsx`/`GraphvizProcessing.ts` for graph state — each rendered graph carries its own settings (min-visits threshold, color mode) rather than a single global setting.
- Don't add new dependencies for something `radix-ui`/`components/ui` or an existing lib already covers.
