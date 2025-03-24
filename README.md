# Path Analysis Tool

React + TypeScript + Vite + SWC (with Rust compiler)

[Live URL](https://path-analysis.vercel.app/)

## How to Run Locally
1. Make sure you have `Node.js` installed. You can download it from https://nodejs.org/en/download/
1. This uses `bun` to run, build, and deploy. You will need to have the `bun` command installed. You can install it by running ```npm install -g @bun/cli```. Docs: https://bun.sh/
2. Run ```bun install``` to download the necessary dependencies.
3. You will need a local .env file with secret variables. Reach out to Ethan for these.
4. Run ```bun run dev``` to start the development server.

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
