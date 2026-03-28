# Trianglify

JavaScript library for generating colorful triangle mesh patterns as SVG/Canvas.

## Build & Test

- `pnpm install` — install dependencies
- `pnpm run build` — build dist/ bundles via Rollup
- `pnpm run test` — run Jest tests (requires build first)
- `pnpm run lint` — run Standard linter
- `pnpm run ci` — lint + build + test (full CI pipeline)

## Architecture

- `src/trianglify.js` — main entry point, point generation, triangulation, coloring
- `src/pattern.js` — Pattern class with SVG/Canvas rendering methods
- `src/worker.js` — Web Worker entry point (built as IIFE)
- `src/workerClient.js` — TrianglifyWorker client class
- `src/utils/` — color functions, geometry, RNG, colorbrewer palette, scaling

## Key Dependencies

- `chroma-js` — color manipulation (scale, mix, darken)
- `delaunator` — Delaunay triangulation
- `canvas` — optional peer dep for Node.js canvas rendering

## Testing

Tests import from built `dist/` files (not source). Always run `pnpm run build` before `pnpm run test`.
- Browser tests: `src/trianglify.browser.test.js` (jsdom environment, uses UMD bundle)
- Node tests: `src/trianglify.node.test.js` (node environment, uses CJS bundle)
- Coverage tests: `src/trianglify.coverage.test.js`
- Worker tests: `src/worker.test.js`

## Output Bundles

- `dist/trianglify.cjs` — CJS for Node/bundlers (chroma-js external)
- `dist/trianglify.mjs` — ESM for Node/bundlers (chroma-js external)
- `dist/trianglify.bundle.js` — UMD minified for browsers (chroma-js bundled)
- `dist/trianglify.bundle.debug.js` — UMD unminified for debugging
- `dist/trianglify.worker.js` — IIFE minified for Web Workers
- `dist/trianglify.d.ts` — TypeScript type definitions
