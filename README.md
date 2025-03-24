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
   - Filter by student progress status (GRADUATED, PROMOTED, NOT_COMPLETED)
   - Toggle self-loops (transitions back to the same step)
   - Adjust minimum student threshold for edge visibility
   - View top 5 most common student paths

3. **Interactive Elements**
   - Hover over edges to see detailed statistics
   - Click nodes to see student counts and error rates
   - Export graph as high-quality PNG
   - Responsive design that works on different screen sizes

## How to Run Locally

1. Make sure you have `Node.js` installed. You can download it from https://nodejs.org/en/download/
2. This uses `bun` to run, build, and deploy. You will need to have the `bun` command installed. You can install it by running ```npm install -g @bun/cli```. Docs: https://bun.sh/
3. Run ```bun install``` to download the necessary dependencies.
4. You will need a local .env file with secret variables. Reach out to Ethan for these.
5. Run ```bun run dev``` to start the development server.

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
   - Use the filter dropdown to view paths for specific student progress statuses
   - Toggle self-loops on/off to include/exclude transitions back to the same step
   - Adjust the minimum student threshold to show only paths followed by a certain number of students
   - The threshold can be set as a percentage of total students or as an absolute number

4. **Analyze Patterns**
   - View the top 5 most common student paths
   - Click on nodes to see detailed statistics about student progression
   - Export the graph as a PNG for sharing or documentation

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

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
