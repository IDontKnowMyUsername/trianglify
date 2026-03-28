# Trianglify

TypeScript library for generating colorful triangle mesh patterns as SVG/Canvas.

## Build & Test

- `pnpm install` — install dependencies
- `pnpm run build` — emit declarations via tsc, then build dist/ bundles via Rollup
- `pnpm run test` — run Jest tests (requires build first)
- `pnpm run typecheck` — run TypeScript type checking (no emit)
- `pnpm run lint` — run ESLint with typescript-eslint
- `pnpm run ci` — typecheck + lint + build + test (full CI pipeline)

## Architecture

- `src/trianglify.ts` — main entry point, point generation, triangulation, coloring
- `src/pattern.ts` — Pattern class with SVG/Canvas rendering methods
- `src/worker.ts` — Web Worker entry point (built as IIFE)
- `src/workerClient.ts` — TrianglifyWorker client class
- `src/types.ts` — shared TypeScript interfaces and types
- `src/utils/` — color functions, geometry, RNG, colorbrewer palette, scaling

## Key Dependencies

- `chroma-js` — color manipulation (scale, mix, darken)
- `delaunator` — Delaunay triangulation
- `canvas` — optional peer dep for Node.js canvas rendering

## TypeScript Config

- `tsconfig.json` — main config for type checking (noEmit)
- `tsconfig.build.json` — extends main, emits declaration files to dist/types/
- `tsconfig.worker.json` — extends main, uses WebWorker lib instead of DOM
- `tsconfig.test.json` — extends main, CommonJS module for test files (ts-jest)

## Testing

Tests import from built `dist/` files (not source). Always run `pnpm run build` before `pnpm run test`.
Tests use `require()` to load CJS/UMD dist bundles, compiled via ts-jest.
- Browser tests: `src/trianglify.browser.test.ts` (jsdom environment, uses UMD bundle)
- Node tests: `src/trianglify.node.test.ts` (node environment, uses CJS bundle)
- Coverage tests: `src/trianglify.coverage.test.ts`
- Worker tests: `src/worker.test.ts`

## Output Bundles

- `dist/trianglify.cjs` — CJS for Node/bundlers (chroma-js external)
- `dist/trianglify.mjs` — ESM for Node/bundlers (chroma-js external)
- `dist/trianglify.bundle.js` — UMD minified for browsers (chroma-js bundled)
- `dist/trianglify.bundle.debug.js` — UMD unminified for debugging
- `dist/trianglify.worker.js` — IIFE minified for Web Workers
- `dist/trianglify.d.ts` — TypeScript type definitions (auto-generated from source, bundled via rollup-plugin-dts)
