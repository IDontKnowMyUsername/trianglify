# Trianglify

TypeScript library for generating colorful triangle mesh patterns as SVG/Canvas.

## Build & Test

- `pnpm install` — install dependencies
- `pnpm run build` — emit declarations via tsc, then build dist/ bundles via Rollup
- `pnpm run test` — run Jest tests (requires build first)
- `pnpm run test:coverage` — run Jest tests with coverage collection and threshold enforcement
- `pnpm run typecheck` — run TypeScript type checking (no emit)
- `pnpm run lint` — run ESLint with typescript-eslint
- `pnpm run ci` — typecheck + lint + build + test with coverage (full CI pipeline)

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
- `tsconfig.worker.json` — extends main, adds WebWorker lib (keeps DOM for the shared render code in pattern.ts)
- `tsconfig.test.json` — extends main, CommonJS module for test files (ts-jest)

## Testing

Tests import from built `dist/` files (not source). Always run `pnpm run build` before `pnpm run test`.
Tests use `require()` to load CJS/UMD dist bundles, compiled via ts-jest.
- Browser tests: `src/trianglify.browser.test.ts` (jsdom environment, uses UMD bundle)
- Node tests: `src/trianglify.node.test.ts` (node environment, uses CJS bundle)
- Coverage tests: `src/trianglify.coverage.test.ts`
- Tiling tests: `src/tilings.test.ts` (exact geometry and gap-free certification)
- Serialization tests: `src/serialization.test.ts` (Pattern toData/fromData, color function descriptors)
- Worker bundle tests: `src/worker.bundle.test.ts` (executes dist/trianglify.worker.js against a mock scope)
- Worker client tests: `src/workerClient.test.ts` (TrianglifyWorker with a mock Worker)
- Bundle artifact tests: `src/bundles.test.ts` (minified UMD parity, ESM entries via child-process import)

## Output Bundles

- `dist/trianglify.cjs` — CJS for Node/bundlers (chroma-js external)
- `dist/trianglify.mjs` — ESM for Node (chroma-js external, node:module banner for lazy canvas require)
- `dist/trianglify.browser.mjs` — ESM for browser bundlers via the "browser" exports condition (chroma-js external, no node:module banner)
- `dist/trianglify.bundle.js` — UMD minified for browsers (chroma-js bundled)
- `dist/trianglify.bundle.debug.js` — UMD unminified for debugging
- `dist/trianglify.worker.js` — IIFE minified for Web Workers
- `dist/trianglify.d.ts` — TypeScript type definitions (auto-generated from source, bundled via rollup-plugin-dts)
