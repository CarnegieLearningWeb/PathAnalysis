# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

Path Analysis Tool — a React + TypeScript + Vite app that visualizes student learning paths through educational content as directed graphs (Graphviz via `graphviz-react`). See `README.md` for feature/user-facing details, the data format, and how the counting works.

## Package manager

Use **bun**, not npm. A stray `package-lock.json` exists from someone running plain `npm install` — prefer `bun.lock` and `bun install`/`bun run <script>`. Keep `bun.lock` in sync when you touch `package.json`: CI sets `CI`, bun treats that as `--frozen-lockfile`, and a declared dependency missing from the lockfile fails the build rather than resolving.

## Commands

- `bun run dev` — Vite dev server only.
- `bun run dev:full` — Vite + local Express API server (needed for the GitHub-backed data file feature).
- `bun run api` — local API server alone (`start-api-server.js`).
- `bun run build` — `tsc` typecheck then `vite build`.
- `bun run lint` — eslint (currently broken: no eslint config file at the flat-config path ESLint 8 expects; pre-existing).

## Testing

There is no test runner (no vitest/jest). To verify data-processing changes, write a scratch `.ts`, import the exported functions from `src/components/GraphvizProcessing.ts`, and run it with `bun run`. `subsetSixAndMore.csv` in the repo root is a usable fixture (~22k rows, 50 students, 281 problems, 170 sessions).

**Measure; do not infer.** The counting logic has several interacting modes, and reasoning about it from the code reliably produces confident wrong answers. If you are about to explain why two numbers disagree, run the functions and quote measured values instead.

## Architecture

- `src/components/GraphvizProcessing.ts` — all data processing and DOT generation. Pipeline: `loadAndSortData` → `createSequences` → `countEdges` → `generateDotString`.
- `src/components/GraphvizParent.tsx` — graph orchestration, rendering, interaction, click tooltips.
- `src/components/` — UI. `App.tsx` is the control panel; `GraphMenu.tsx` + `GraphMinVisitsSlider.tsx` are per-graph settings (one min-visits threshold per rendered graph); `FilterComponent.tsx`, `SequenceSelector.tsx`, `Upload.tsx`/`DropZone.tsx`. `src/components/ui/` is the shadcn/Radix primitive layer — compose from there rather than adding UI deps.
- `src/lib/` — `dataFetchingHooks.ts` (React Query + AWS), `dataProcessingUtils.ts`, `GradPromUtils.ts`, `fileWorker.ts` (CSV parsing off the main thread), `types.ts`, `routes.tsx`.
- `api/` — Vercel serverless functions proxying to a GitHub repo (default `CarnegieLearningWeb/PathAnalysis`). `server.ts` + `start-api-server.js` run the same thing locally.

## Invariants to preserve

These encode defects that were expensive to find. Breaking one produces plausible wrong numbers, not visible errors.

- **Step and outcome arrays are positional.** `processStudentPaths` pairs `steps[i] → steps[i+1]` with `outcomes[i+1]`. `createSequences` builds both in one pass so a dropped row leaves both. Never split them into separate builders again.
- **Student counts and visit counts are different units.** `uniqueStudentMode` switches which one every display reads. Before comparing, subtracting, or dividing two counts, check they share a unit in *both* modes — error counts in particular have separate student and visit tallies.
- **Comparing step arrays requires collapsing first.** Sequences keep or drop consecutive repeats depending on the self-loop toggle, so compare `collapseConsecutive(a)` with `collapseConsecutive(b)`, never raw. Where outcomes travel alongside, use `collapseStepsAndOutcomes` to keep them aligned.
- **A path is `(student, problem, session)`**, composed via `pathKey` into the second-level key with a `\u0000` separator. Missing/placeholder sessions fall back to `(student, problem)` per row. Don't display that key — it isn't a problem name.
- **Outgoing shares from a node do not partition its students** and can total well over 100%. Don't label them as probabilities.
- **`Time` is usually epoch millis as a string.** `new Date(str)` returns `NaN` for that; use `parseTimestamp`. Ordering within a path determines its transitions, so a bad sort invents edges rather than merely reordering a view.

## Deploying

Two paths exist and the docs historically named only one. `.github/workflows/deployVercel.yml` deploys to Vercel on push to `main`, and `vercel.json` routes `/api/*` to `api/`. `amplify.yml` also exists for AWS Amplify but has no `api/` handling. Confirm which is live before relying on either. `VITE_*` variables are inlined at build time, so they must be set in the build environment.

## Environment variables

See README's Environment Variables section. Code reads `VITE_ACCESS_KEY_ID`/`VITE_SECRET_ACCESS_KEY`, while the local `.env` template historically used `VITE_AWS_ACCESS_KEY_ID`/`VITE_AWS_SECRET_ACCESS_KEY` — check the actual names in `src/lib/dataFetchingHooks.ts` if auth fails locally.

`.env` is gitignored — never commit it or paste its contents into commits, PRs, or issues.

## Conventions

- Each rendered graph carries its own settings (min-visits threshold, color mode) rather than a single global setting. Follow that pattern.
- Don't add dependencies for something `radix-ui`/`components/ui` or an existing lib already covers.
