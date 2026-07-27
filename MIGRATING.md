# Migrating from Trianglify v4 to v5

v5 is a ground-up modernization: TypeScript source, ESM-first packaging, Web
Worker support, new shapes and point-generation algorithms, and strict option
validation. Most v4 code keeps working unchanged — the checklist below covers
everything that can break.

## 1. Packaging: ESM-first with an exports map

The package now declares `"type": "module"` and serves different builds via
the `exports` map:

| How you load it | What you get |
|---|---|
| `import trianglify from 'trianglify'` (bundlers) | `dist/trianglify.browser.mjs` (ESM) |
| `import trianglify from 'trianglify'` (Node ESM) | `dist/trianglify.mjs` (ESM) |
| `require('trianglify')` | `dist/trianglify.cjs` (CommonJS) |
| `<script src=…>` | `dist/trianglify.bundle.js` (UMD, unchanged) |
| `'trianglify/worker'` | `dist/trianglify.worker.js` (Web Worker script) |

What to change:

- **Deep imports break.** Anything reaching into the package other than the
  root and `trianglify/worker` (e.g. `require('trianglify/dist/trianglify.min.js')`)
  must switch to the root import or a documented dist file.
- **Node >= 18 is required.**
- TypeScript definitions are now bundled (`trianglify.d.ts` / `.d.cts`) — if
  you had a local declaration or a `@types` stub for trianglify, delete it.
- `canvas` is an optional peer dependency: install it only if you call
  `toCanvas()` in Node. Browser/SVG-only usage needs nothing extra.

## 2. Strict option validation

v4 silently ignored unknown or malformed options. v5 throws a `TypeError`
for:

- **Unknown option keys** — e.g. `trianglify({ cell_size: 75 })` (the v3
  snake_case spelling) now throws `Unrecognized option: cell_size`. Check any
  code that spreads config objects into the options argument.
- **`xColors: false` / `yColors: false`** — the v4 way to disable a gradient
  axis is gone; use `yColors: 'match'` (the default) or explicit color arrays.
- **Malformed values** — non-numeric dimensions, `cellSize < 1`, negative
  `variance`/`strokeWidth`, empty or non-string color arrays, empty palettes,
  palette entries that aren't non-empty arrays of CSS color strings, and
  malformed `points` arrays all throw with a descriptive message.

If you were relying on v4's silent fallbacks, wrap the call in a
`try`/`catch` while you clean up call sites — the error messages name the
offending option.

## 3. chroma-js is gone: colors are `{ css() }` objects and plain color objects

In v4, `pattern.polys[n].color` was a chroma-js `Color` with its full API
(`.hex()`, `.darken()`, …). In v5 it is a minimal `{ css: () => string }`
wrapper (this is what makes patterns serializable and worker-transferable).

```js
// v4
pattern.polys[0].color.hex()

// v5 — get the CSS string, re-wrap in a color library if you need color math
pattern.polys[0].color.css()                          // 'rgb(129 204 177)'
```

The color engine is now [culori](https://culorijs.org/) (bundled — no
runtime dependency), which unlocks wide-gamut output via the new
`colorOutput` option (`'rgb'` | `'oklch'` | `'display-p3'`) and the
`oklab`/`oklch` interpolation spaces.

Custom `colorFunction`s: the `xScale`/`yScale` params are now plain
`(t) => color` functions instead of chroma scale objects, and the function
must return a culori-style color object — which is what the scales and
`trianglify.utils.mix` produce, so functions composed from those work
unchanged — or a finished CSS color string. Chroma method chaining
(`.darken()` etc.) on scale results no longer works; `trianglify.utils.mix`
and `trianglify.utils.css` cover the common cases.

## 4. Seeded output differs from v4

The RNG was replaced (seedrandom → mulberry32, with separate salted streams
for geometry, palette selection, and color noise). A given `seed` produces a
*different* pattern than it did in v4 — the properties that changed are
documented in the changelog. If you cache rendered output keyed by seed,
regenerate the cache; if you snapshot-test generated SVG, update snapshots.

The upside: in v5, changing color-only options (`xColors`, `colorFunction`,
…) never changes the geometry for a given seed.

## 5. Serialization replaces poking at internals

`pattern.toData()` / `trianglify.Pattern.fromData(data)` are the supported
way to persist or transfer patterns (JSON-safe, `postMessage`-safe).
`fromData` validates its input and throws `TypeError: invalid pattern data:
…` on malformed data — code that fed it hand-built objects needs those
objects to be structurally valid (in particular, every `vertexIndices` entry
must index into `points`, and vertexless polys must carry a `radius`).

## 6. New in v5 (no action needed)

- `shape` option: regular polygons (`pentagon` … `octagon`), `circle`, and
  three exact pentagonal tilings (`pentagon-cairo`, `pentagon-convex`,
  `pentagon-nonconvex`).
- `pointGeneration` option: `grid` (default), `poisson`, `bestCandidate`,
  `spiral`, `sphere` — all emit the same point count at a given `cellSize`,
  so they're drop-in interchangeable.
- Web Worker support: `new trianglify.TrianglifyWorker(...)` +
  `worker.generate(opts, { signal })` with `AbortSignal` cancellation.
- `strokeColor`, `spiralDirection`, `spiralRatio` options.

See the [Readme](./Readme.md) for full documentation of the current API.
