# Tech Stack

## Runtime & Language
- Node.js 20+
- TypeScript with strict mode
- ES modules (`type: module`)

## Build & Tooling
- npm workspaces monorepo
- esbuild for bundling
- Vitest for testing
- ESLint for linting
- Prettier for formatting

## UI Framework
- React + Ink for terminal UI

## Common Commands
```bash
npm install        # Install dependencies
npm run build      # Bundle CLI to dist/
npm run dev        # Development mode
npm run test       # Run tests with Vitest
npm run lint       # Run ESLint
npm run format     # Run Prettier
```

## TypeScript Configuration
- Target: ES2022
- Module resolution: NodeNext or Node16
- Strict mode enabled
- Each package extends `tsconfig.base.json`

## Key Dependencies
- `ink` and `react` for TUI components
- Provider-specific SDKs in `ollm-bridge` package
