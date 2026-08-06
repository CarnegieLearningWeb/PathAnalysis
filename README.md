# Path Analysis Tool

A visualization tool for analyzing student learning paths in educational software. Built with React + TypeScript + Vite + SWC (with Rust compiler).

[Live URL](https://path-analysis.vercel.app/)

## Overview

This tool visualizes student learning paths through educational content, showing:
- The sequence of steps students take
- How many students follow each path
- Success/failure rates at each step
- Common patterns in student progression

### Key Features

1. **Path Visualization**
   - Interactive directed graph showing student progression
   - Edge thickness indicates number of unique students following each path
   - Color coding for success (green) and failure (red) rates
   - Node ranking based on step sequence

2. **Filtering Options**
   - Filter by student progress status (GRADUATED, PROMOTED) via multi-select checkboxes — multiple statuses render side by side simultaneously
   - Toggle self-loops (transitions back to the same step)
   - Per-graph minimum student/visit threshold, adjustable independently for each rendered graph via its own settings menu
   - Select a specific student path to render as its own "Selected Sequence" graph, with progressive filtering to counts of only students who completed that full sequence
   - Optional "color nodes by selected sequence" toggle to recolor nodes by their position in the selected sequence

3. **Interactive Elements**
   - Hover over edges to see detailed statistics
   - Click nodes to see student counts and error rates
   - Export graph as high-quality PNG
   - Responsive design that works on different screen sizes

## How to Run Locally

1. Make sure you have `Node.js` installed. You can download it from https://nodejs.org/en/download/
2. This project uses `bun` to run, build, and deploy (see `amplify.yml`). Install it from https://bun.sh/.
3. Run ```bun install``` to download the necessary dependencies.
4. Copy `.env.example` (if present) or create a `.env` file — see [Environment Variables](#environment-variables) below.
5. Run ```bun run dev``` to start the Vite dev server only, or ```bun run dev:full``` to also run the local API server (needed for loading/uploading data files stored in GitHub — see below).

## Environment Variables

- `VITE_ACCESS_KEY_ID`, `VITE_SECRET_ACCESS_KEY` — AWS credentials used client-side by `src/lib/dataFetchingHooks.ts`.
- `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` — used by the API routes in `api/` (and `start-api-server.js` locally) to list/fetch/upload CSV data files from a GitHub repo. `GITHUB_OWNER`/`GITHUB_REPO` default to `CarnegieLearningWeb/PathAnalysis`; `GITHUB_TOKEN` is required for uploads.
- `PORT` — optional, port for the local Express API server (defaults to 3000).

The GitHub-backed API server is only needed for the "load a data file from GitHub" feature — local file upload via drag-and-drop works without it.

## File Format Requirements

The application accepts the following file formats:
- CSV (Comma Separated Values)
- TSV (Tab Separated Values)

### Required Fields
Your data file must include the following fields:
- `Time`: Can be either a string or number
- `Step Name`: String
- `Outcome`: String
- `CF (Workspace Progress Status)`: String
- `Problem Name`: String
- `Anon Student Id`: String

### Example Format
```csv
Time,Step Name,Outcome,CF (Workspace Progress Status),Problem Name,Anon Student Id
2024-01-01 10:00:00,Step 1,OK,GRADUATED,Problem 1,student123
2024-01-01 10:01:00,Step 2,ERROR,NOT_COMPLETED,Problem 1,student123
```

## Using the Tool

1. **Upload Data**
   - Click the upload button to select your data file
   - The file should be in CSV or TSV format with the required fields

2. **View the Graph**
   - The main graph shows all student paths
   - Edge thickness represents the number of unique students following each path
   - Colors indicate success (green) or failure (red) rates
   - Hover over edges to see detailed statistics

3. **Filter and Adjust**
   - Check one or more student progress status checkboxes to render a separate graph per status
   - Toggle self-loops on/off to include/exclude transitions back to the same step
   - Open a graph's settings menu to adjust its own minimum student/visit threshold independently of the other graphs
   - Click a path in the sequence list to render it as its own "Selected Sequence" graph, optionally restricting counts to only students who followed that exact path

4. **Analyze Patterns**
   - View the most common student paths and select one to inspect
   - Click on nodes to see detailed statistics about student progression
   - Export any graph as a PNG for sharing or documentation

## Technical Details

### Edge Counting
- Edges are counted based on unique students rather than total transitions
- If a student makes the same transition multiple times, it's counted only once
- Edge thickness is normalized relative to the most common path

### Node Ranking
- Nodes are ranked based on their position in the step sequence
- This helps visualize the natural progression through the content

### Color Coding
- Green: Successful transitions (OK outcome)
- Red: Failed transitions (ERROR outcome)
- Blue: Hint-related transitions (INITIAL_HINT, HINT_LEVEL_CHANGE)
- Yellow: Just-in-time feedback (JIT, FREEBIE_JIT)

