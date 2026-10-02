# Path Analysis Tool

A visualization tool for analyzing student learning paths in educational software. React + TypeScript + Vite.

[Live URL](https://path-analysis.vercel.app/)

It takes a MATHia-style event export and draws the routes students actually took through a problem as a directed graph: which step followed which, how many students or attempts went each way, and how each step went for them.

---

## Quick start

```bash
git clone https://github.com/CarnegieLearningWeb/PathAnalysis.git
cd PathAnalysis
bun install
bun run dev
```

Open the dev server, drag a CSV/TSV onto the upload area, and you have graphs. Everything below is detail you can read when you need it.

Use **bun**, not npm or yarn — the deploy builds with bun, and mixing package managers desynchronizes the lockfile. You need [Node.js](https://nodejs.org/en/download/) and [bun](https://bun.sh/) installed.

| Command | What it does |
|---|---|
| `bun run dev` | Vite dev server only. Enough for uploading your own files. |
| `bun run dev:full` | Vite **and** the local API server. Needed only for loading data files from GitHub. |
| `bun run api` | The local API server alone. |
| `bun run build` | Typecheck (`tsc`) then build to `dist/`. |

There is no test runner in this repo. To check data-processing behavior, import the exported functions from `src/components/GraphvizProcessing.ts` in a scratch `.ts` file and run it with `bun run` — see [Verifying behavior](#verifying-behavior).

---

## Your data file

CSV or TSV. The parser reads these columns:

| Column | Required | Notes |
|---|---|---|
| `Anon Student Id` | yes | Identifies the student. |
| `Problem Name` | yes | Part of a path's identity (see below). |
| `Time` | yes | Epoch milliseconds, epoch seconds, or a parseable date string. Ordering within a path decides its transitions, so this matters more than it looks. |
| `Step Name` | yes | Becomes a node. |
| `Outcome` | yes | `OK` is normalized to `CORRECT` on load. |
| `CF (Workspace Progress Status)` | for status filters | e.g. `GRADUATED`, `PROMOTED`. |
| `Session Id` | recommended | Splits a student's repeat attempts apart. Without it, all attempts at a problem concatenate into one path. |
| `CF (Is Autofilled)` | optional | Rows marked true are dropped before anything else. |
| `Selection`, `Action` | optional | Used to recognize a blank `Step Name` as the Done button. |

```csv
Anon Student Id,Problem Name,Session Id,Time,Step Name,Action,Outcome,CF (Is Autofilled),CF (Workspace Progress Status)
student123,Problem 1,sess-a,1668756353943,PercentChange,Attempt,OK,False,GRADUATED
student123,Problem 1,sess-a,1668756356403,NumeratorQuantity2,Attempt,ERROR,False,GRADUATED
```

A file may contain many problems. The tool handles that, and the graph caption tells you when it is showing more than one.

---

## How to read the graphs

### What a path is

A **path** is one student's run at one problem in one session: the key is `(Anon Student Id, Problem Name, Session Id)`. Rows in that bucket are sorted by `Time`, and each consecutive pair becomes a transition.

If `Session Id` is missing, blank, or the placeholder `no_session_tracking`, that row falls back to `(student, problem)` — so a student's separate attempts merge into one path, and a transition gets invented where one attempt ends and the next begins. This is per-row, so a file with partial session data degrades row by row rather than all at once.

### The two count modes

The **Count** control changes what nearly every number on screen means:

- **Unique students** — each student is counted at most once per edge. Self-loops are excluded, since a repeat in place isn't a distinct student.
- **Total visits** — every traversal counts, including repeats. Self-loops become visible.

Panels, tooltips, edge labels, thickness, and the min-visits threshold all follow this control.

### Counts that look contradictory but aren't

These trip up everyone the first time, so they are worth stating plainly.

**Shares out of one step can total more than 100%.** An edge's share is *students who used this edge in any path* over *students who reached this step in any path*. A student who reaches a step in several paths — a different problem, a different session, or a revisit within one path — is counted on every route they took and once in the denominator. On a 50-student sample file, one step's outgoing shares total about 430%. Each share is individually true; they simply aren't slices of a pie. Tooltips say so.

**The sequence picker counts attempts; the panel caption counts people.** "Taken 47×" means 47 matching paths. "28 students followed this sequence" means 28 distinct students. One student with three matching sessions contributes 3 and 1 respectively.

**Edges are hidden below a threshold.** Each graph has its own minimum, default 8% of its busiest edge, adjustable in the graph's gear menu. The slider's maximum is the highest threshold that still keeps the graph in one connected piece, not the busiest edge's count.

### Colors

Edges take the color of their dominant outcome, on the colorblind-safe Okabe-Ito palette:

| Outcome | Color |
|---|---|
| `CORRECT` (and `OK`) | bluish green `#009E73` |
| `ERROR` | vermilion `#D55E00` |
| `INITIAL_HINT`, `HINT_LEVEL_CHANGE` | sky blue `#56B4E9` |
| `JIT`, `FREEBIE_JIT` | orange `#E69F00` |

In **Error Mode**, a dashed red overlay runs alongside each edge, sized by its error count; an edge that is entirely errors is drawn dashed itself.

In **Color Nodes by Outcome**, each node becomes a two-row box — the step name over a 100%-bar of that step's own outcome mix — and the edges go neutral.

### The panels

- **Selected Sequence** — one chosen path drawn as a straight line, every edge labelled. Optionally restricted to students who followed it exactly.
- **All Students, All Paths** — the whole network. Only each node's **busiest outgoing edge** is labelled; labelling every edge at this density is unreadable.
- **By status** — one graph per checked `CF (Workspace Progress Status)` value.

### Export

The export panel re-renders graphs off-screen rather than screenshotting what's on it, so a download can carry a masthead and a coloring mode you aren't currently viewing. PNG, SVG, or raw DOT; several graphs at once arrive as a zip.

---

## Environment variables

Create a `.env` in the project root. None of it is needed to upload your own file.

- `VITE_ACCESS_KEY_ID`, `VITE_SECRET_ACCESS_KEY` — AWS credentials used client-side by `src/lib/dataFetchingHooks.ts`. `VITE_*` values are inlined **at build time**, so they must be set wherever the production build runs, not only locally.
- `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` — used by `api/` (and `start-api-server.js` locally) to list/fetch/upload data files from a GitHub repo. Owner/repo default to `CarnegieLearningWeb/PathAnalysis`; the token is required for uploads.
- `PORT` — port for the local API server (default 3000).

---

## Deploying

Pushing to `main` triggers `.github/workflows/deployVercel.yml`, which uses the official Vercel CLI: `vercel pull` to fetch the project's production environment, `vercel build --prod`, then `vercel deploy --prebuilt --prod`. `vercel.json` routes `/api/*` to the serverless functions in `api/`.

Two sets of configuration have to be right, in two different places:

**GitHub repository secrets** — the workflow reads these. `.vercel/` is gitignored, so CI has no project link without the org and project ids.

| Secret | Why |
|---|---|
| `VERCEL_TOKEN` | authenticates the CLI |
| `VERCEL_ORG_ID` | which Vercel team |
| `VERCEL_PROJECT_ID` | which project |

Check with `gh secret list --repo CarnegieLearningWeb/PathAnalysis` (needs admin), or Settings → Secrets and variables → Actions.

**Vercel project environment variables** — `vercel pull` fetches these at build time, and `VITE_*` values are inlined into the bundle then, so a missing one fails silently in the browser rather than at build. Check with `vercel env ls production` after `vercel login`, or the Vercel dashboard → Settings → Environment Variables. You want `VITE_ACCESS_KEY_ID` and `VITE_SECRET_ACCESS_KEY`, plus `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` if the data-file browser is in use.

An `amplify.yml` for AWS Amplify also exists (`bun install && bun run build`, serving `dist/`). Which branch it watches lives in the Amplify console, not here, and it has no `api/` handling — so the data-file feature would not work under it. Confirm which of the two is actually live before relying on either.

---

## Code layout

- `src/components/GraphvizProcessing.ts` — all data processing: parsing, path construction, edge/node counting, and DOT generation. The big one.
- `src/components/GraphvizParent.tsx` — graph orchestration, rendering, interaction, and the click tooltips.
- `src/components/` — UI. `App.tsx` holds the control panel; `src/components/ui/` is the shadcn/Radix primitive layer — compose from it rather than adding UI dependencies.
- `src/lib/` — data fetching, the CSV web worker, types, routes.
- `api/` — Vercel serverless functions proxying to GitHub. `server.ts` + `start-api-server.js` run the same thing locally.

### The processing pipeline

`loadAndSortData` (drop autofilled rows, resolve step names, sort) → `createSequences` (build the step and outcome arrays together, so they can't drift apart) → `countEdges` (tally per-edge students, visits, outcomes, errors) → `generateDotString` (emit DOT) → `d3-graphviz` renders it.

Two things to know before changing any of it:

- **Step and outcome arrays are read positionally.** `processStudentPaths` pairs `steps[i] → steps[i+1]` with `outcomes[i+1]`. They are built in one function so a row dropped from one is dropped from the other. Don't reintroduce separate builders.
- **Unique-student counts and visit counts are different units.** Mixing them produces plausible wrong numbers rather than obvious ones. If you compare, subtract, or divide two counts, check they're the same unit in *both* modes.

### Verifying behavior

No test runner, so measure directly:

```ts
// scratch.ts
import { loadAndSortData, createSequences, countEdges }
    from './src/components/GraphvizProcessing.ts';

const rows = loadAndSortData(await Bun.file('subsetSixAndMore.csv').text());
const { stepSequences, outcomeSequences } = createSequences(rows, /* selfLoops */ false);
console.log(countEdges(stepSequences, outcomeSequences).edgeCounts);
```

```bash
bun run scratch.ts
```

`subsetSixAndMore.csv` in the repo root is a usable fixture. Prefer this over reasoning about the pipeline by reading it — the counting has several interacting modes, and measured numbers settle questions that inspection does not.
