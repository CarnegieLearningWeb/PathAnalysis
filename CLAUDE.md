# CLAUDE.md

Path Analysis Tool — React + TypeScript + Vite app that visualizes student learning paths as directed graphs (`graphviz-react`). User-facing details: `README.md`.

Only non-obvious things live here. Read the code for the rest.

## Gotchas

- **Use bun, not npm.** Deploy runs `bun install && bun run build`. `package-lock.json` is a stray from someone running `npm install` — ignore it, `bun.lock` is authoritative. (`dev:full` still shells out to `npm run` internally; harmless, but don't copy the pattern.) Keep `bun.lock` in sync when changing `package.json`: CI sets `CI`, bun reads that as `--frozen-lockfile`, and a declared dependency missing from the lockfile fails the build instead of resolving it.
- **`bun run lint` is broken** — no eslint config file exists at the flat-config path ESLint 8 wants. Pre-existing. Don't chase it unless asked.
- **No test runner.** No vitest/jest. `bun run build` (tsc + vite build) is the only automated check, and for anything that counts students, visits, attempts or steps it is not enough — see Verifying data behavior.
- **Env var names disagree with `.env`.** Code reads `VITE_ACCESS_KEY_ID`/`VITE_SECRET_ACCESS_KEY`; the old `.env` template used `VITE_AWS_*`. Trust `src/lib/dataFetchingHooks.ts`, not the template. `VITE_*` is inlined at **build** time, so production values must exist in the Vercel project, not just locally. `.env` is gitignored — never commit it or paste its contents anywhere.
- **Two deploy paths exist**: `amplify.yml` (AWS Amplify) and `.github/workflows/deployVercel.yml` (Vercel CLI, on push to `main`). Changing build steps may need both. Amplify's config has no `api/` handling.

## Commands

`bun run dev` (Vite only) · `bun run dev:full` (Vite + local Express API — needed for the GitHub-backed data file feature) · `bun run api` (API alone) · `bun run build`

## Where things are

- `src/components/GraphvizParent.tsx` — graph orchestration, rendering, interaction, click tooltips; `GraphvizProcessing.ts` — data → dot shaping. Start here for anything graph-related. The pipeline is `loadAndSortData` → `createSequences` → `countEdges` → `generateDotString`.
- `src/lib/` — `dataFetchingHooks.ts` (React Query + AWS), `dataProcessingUtils.ts`, `GradPromUtils.ts`, `fileWorker.ts` (CSV parsing in a worker), `types.ts`, `routes.tsx`.
- `api/` — Vercel serverless functions proxying to a GitHub repo (default `CarnegieLearningWeb/PathAnalysis`) for data files. `server.ts` + `start-api-server.js` run the same handlers as an Express server locally.

## Invariants to preserve

Each encodes a defect that was expensive to find and silent when reintroduced — breaking one yields plausible wrong numbers, not an error.

- **Step and outcome arrays are positional.** `processStudentPaths` pairs `steps[i] → steps[i+1]` with `outcomes[i+1]`. `createSequences` builds both in one pass so a dropped row leaves both. Don't split them into separate builders again.
- **Student counts and visit counts are different units.** `uniqueStudentMode` switches which one every display reads. Before comparing, subtracting or dividing two counts, check they share a unit in *both* modes — errors carry separate student and visit tallies for exactly this reason.
- **Collapse before comparing step arrays.** Sequences keep or drop consecutive repeats depending on the self-loop toggle, so compare `collapseConsecutive(a)` against `collapseConsecutive(b)`, never raw. Where outcomes travel alongside, use `collapseStepsAndOutcomes` so they stay aligned.
- **A path is `(student, problem, session)`**, composed by `pathKey` into the second-level key with a `\u0000` separator; missing or placeholder sessions fall back to `(student, problem)` per row. Never display that key — it is not a problem name.
- **Outgoing shares from a node don't partition its students** and routinely total over 100%. Don't call them probabilities.
- **`Time` is usually epoch millis as a string.** `new Date(str)` gives `NaN` for it — use `parseTimestamp`. Row order within a path determines its transitions, so a bad sort invents edges rather than merely reordering a view.

## Verifying data behavior

Measure; don't infer. Write a scratch `.ts`, import the exported functions from `GraphvizProcessing.ts`, run it with `bun run`. `subsetSixAndMore.csv` (repo root) is a fixture: ~22k rows, 50 students, 281 problems, 170 sessions.

The counting has several interacting modes, and reasoning about it from the code reliably produces confident wrong answers. If you are about to explain why two numbers disagree, run the functions and quote measured values instead.

## Conventions

- Graph settings are **per-graph**, not global — each rendered graph owns its min-visits threshold and color mode. Follow that when adding settings.
- `src/components/ui/` is the shadcn/Radix layer. Compose from it; don't add UI deps for something it or an installed lib already covers.
