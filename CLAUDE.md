# Trianglify

TypeScript library for generating colorful triangle mesh patterns as SVG/Canvas.

## Build & Test

- `pnpm install` — install dependencies
- `pnpm run build` — emit declarations via tsc, then build dist/ bundles via Rollup
- `pnpm run test` — run Jest tests (requires build first)
- `pnpm run test:coverage` — run Jest tests with coverage collection and threshold enforcement
- `pnpm run typecheck` — run TypeScript type checking (no emit)
- `pnpm run lint` — run ESLint with typescript-eslint
- `pnpm run lint:package` — validate packaging with publint + arethetypeswrong + a typetests compile against the published declarations (requires build first). attw runs with `--exclude-entrypoints ./worker`: that subpath would flag `cjs-resolves-to-esm` (`require('trianglify/worker')` resolves to an ESM-classified `.js` file), which is irrelevant because the worker bundle is a classic-worker script for `new Worker(...)`, never imported — excluding the entrypoint instead of globally ignoring the rule keeps `cjs-resolves-to-esm` enforced on the root entry. The `.d.cts` uses `resolution-mode` import attributes, which sets a TS >= 5.3 floor for CJS type consumers (documented in the Readme).
- `pnpm run ci` — typecheck + lint + build + package validation + test with coverage (full CI pipeline)

## Architecture

- `src/trianglify.ts` — main entry point, point generation, triangulation, coloring
- `src/pattern.ts` — Pattern class with SVG/Canvas rendering methods
- `src/worker.ts` — Web Worker entry point (built as IIFE); a thin scope-wiring shim only
- `src/workerHost.ts` — worker-side message protocol (createWorkerHandler), bundled into the main entry so coverage measures it
- `src/workerClient.ts` — TrianglifyWorker client class
- `src/types.ts` — shared TypeScript interfaces and types
- `src/utils/` — color backend (colorBackend.ts — the only module that touches culori: scales, mix, gamut mapping, serialization), color functions, geometry helpers, RNG, colorbrewer palette, DPI scaling, env detection, point generators (poissonDisc, bestCandidate, spiral, sphere), regular-polygon shapes, pentagonal tilings
- `scripts/` — build helpers: clean.mjs (pre-build), postbuild.mjs (d.cts + worker types), check-dist.mjs (stale-build guard before jest)

## Key Dependencies

The package has zero runtime dependencies: culori and delaunator live in devDependencies and are inlined into every dist output by Rollup (no `external` config), with license notices retained via the `/*!` banner.

- `culori` — color engine (scales, mix, gamut mapping), bundled from the tree-shakeable `culori/fn` entry because that subpath is ESM-only and `require()` cannot load it on older node 20.x
- `delaunator` — Delaunay triangulation (bundled, brings robust-predicates)
- `canvas` — optional peer dep for Node.js canvas rendering (the only declared install-time dependency)

## TypeScript Config

- `tsconfig.json` — main config for type checking (noEmit)
- `tsconfig.build.json` — extends main, emits declaration files to dist/types/
- `tsconfig.worker.json` — extends main, adds WebWorker lib (keeps DOM for the shared render code in pattern.ts)
- `tsconfig.test.json` — extends main, CommonJS module for test files (ts-jest)

## Testing

Tests import from built `dist/` files (not source). Always run `pnpm run build` before `pnpm run test`.
Tests use `require()` to load CJS/UMD dist bundles, compiled via ts-jest.
- Browser tests: `src/trianglify.browser.test.ts` (jsdom environment, uses the CJS bundle — every in-process suite loads the same bundle so the V8 coverage remap stays consistent)
- Node tests: `src/trianglify.node.test.ts` (node environment, uses CJS bundle)
- Coverage tests: `src/trianglify.coverage.test.ts`
- Tiling tests: `src/tilings.test.ts` (exact geometry and gap-free certification)
- Serialization tests: `src/serialization.test.ts` (Pattern toData/fromData, color function descriptors)
- Worker bundle tests: `src/worker.bundle.test.ts` (executes dist/trianglify.worker.js against a mock scope, plus the createWorkerHandler export via the CJS bundle so the protocol logic is coverage-measured)
- Worker client tests: `src/workerClient.test.ts` (TrianglifyWorker with a mock Worker)
- Bundle artifact tests: `src/bundles.test.ts` (minified UMD parity, ESM entries via child-process import)

## Output Bundles

All bundles inline their third-party dependencies (culori, delaunator) — nothing is external.

The legacy `"module"` field in package.json intentionally points at the browser build: its only consumers are pre-`exports`-map bundlers (webpack <= 4 era), which are overwhelmingly building for browsers — pointing it at `trianglify.mjs` would hard-break them on the unresolvable `node:module` banner, while the current value merely degrades optional node-canvas loading for the rare legacy node-target bundler (caught by the try/catch in pattern.ts).

- `dist/trianglify.cjs` — CJS for Node/bundlers
- `dist/trianglify.mjs` — ESM for Node (node:module banner for lazy canvas require)
- `dist/trianglify.browser.mjs` — ESM for browser bundlers via the "browser" exports condition (no node:module banner)
- `dist/trianglify.bundle.js` — UMD minified for browsers
- `dist/trianglify.bundle.debug.js` — UMD unminified for debugging
- `dist/trianglify.worker.js` — IIFE minified for Web Workers
- `dist/trianglify.d.ts` — TypeScript type definitions (auto-generated from source, bundled via rollup-plugin-dts)
- `dist/trianglify.d.cts` — CJS view of the type definitions (`export =` shape, generated by scripts/postbuild.mjs for the "require" exports condition)
- `dist/trianglify.worker.d.ts` — minimal declaration so TS can resolve the `trianglify/worker` specifier

Coverage uses the V8 provider and remaps CJS-bundle coverage back to `src/` via source maps. Two invariants keep the remap real (each was once broken and made the thresholds vacuous or corrupt): (1) `inlineSources: true` in tsconfig.json embeds the TS text in the dist maps — without it v8-to-istanbul degenerates to one statement per file; (2) only the CJS bundle is collected (`coveragePathIgnorePatterns` excludes `dist/trianglify.bundle*`) — merging remaps of multiple bundles of the same sources corrupts the merged report. Thresholds are scoped to `./src/` so vendored dependencies (delaunator, robust-predicates) don't dilute or inflate them, with a per-file floor (`./src/**/*.ts` glob) so no single file can regress badly while the aggregate stays green. `collectCoverageFrom` pins the denominator: every non-test `src/**/*.ts` file must appear in the report, so a file that falls out of the bundle (dead code) shows up at 0% instead of silently vanishing — the list must also include `dist/trianglify.cjs` because the filter runs against the loaded bundle path before the source-map remap. `src/types.ts` is excluded as type-only: it is erased at compile time, so no test can ever execute it, and its empty-coverage entry would sink the aggregate. `src/worker.ts` is the one runtime file excluded from the denominator: it executes only as the built IIFE (invisible to the remap), which is why it must stay a thin shim over `src/workerHost.ts`.
