# Color pipeline plan: wide-gamut output and the chroma migration

Status: **implemented** (2026-07-27, same day as the plan — landed in the
unreleased v5.0.0 rather than a v6, since the v5 API was never published).
Decisions taken during implementation, where they differ from or resolve
open points below:

- culori is **bundled** (from the tree-shakeable `culori/fn` entry), not an
  external dependency: culori's `./fn` subpath ships only ESM, which
  `require()` cannot load on older node 20.x. Net effect: zero runtime
  dependencies, and the minified browser bundle *shrank* from 76.5 KB to
  62.3 KB.
- culori ships no TypeScript types; a minimal ambient declaration
  (`src/utils/culori-fn.d.ts`) covers exactly the imported surface, and the
  public API exposes trianglify's own `PatternColor` type — the published
  `.d.ts` has no culori type dependency.
- Gamut handling is **CSS Color 4 gamut mapping** via culori's `toGamut`
  (chroma reduction in oklch, hue and lightness preserved) for `'rgb'` and
  `'display-p3'`; `'oklch'` output is left unclamped for the display to
  map. (Initially shipped as channel clamping; upgraded to mapping by
  docs/gamut-mapping-and-dedup-fallback-plan.md.)
- `toCanvas()` requests a `display-p3` context **automatically** for
  `'display-p3'` patterns (no separate opt-in), and throws in Node for any
  non-`'rgb'` output.
- Quantization defaults on (`colorQuantization: 'auto'`: 256 steps for
  `'rgb'`, 1024 for wide-gamut), per-axis as planned, with `false` as the
  exact-evaluation escape hatch.

The original plan follows.

## Problem statement

Three intertwined issues live in the color pipeline:

1. **The output is silently capped at 8-bit sRGB.** `colorPoly`
   (src/trianglify.ts) serializes every polygon color with `rawColor.css()`
   — no argument — which chroma renders as integer-rounded `rgb(r g b)`.
   The `colorSpace` option only chooses the *interpolation* space; whatever
   precision or gamut the interpolation produces is destroyed at this one
   call. Wide-gamut (display-p3) monitors and HDR pipelines can never
   receive more than clamped 8-bit sRGB from the current code.

2. **chroma-js cannot express wide gamut at all.** Verified against the
   installed chroma 3.2:
   - the `Color` constructor clips channels to sRGB `[0, 255]`, so a
     lab-space mix that lands outside sRGB gamut is clamped *before* any
     output formatting — P3-only colors are unrepresentable internally,
     not merely printed imprecisely;
   - `css('oklch')` / `css('lab')` emit decimal precision but are computed
     from the already-clipped sRGB values;
   - `css('display-p3')` is unsupported and falls through to a generic
     branch that emits a garbage string (`dis(…)`).
   Fixing output formatting on our side cannot help while the backend's
   color model is sRGB-referenced.

3. **chroma is the bundle's largest dependency and its hottest code path.**
   The long-standing TODO in src/trianglify.ts notes chroma adds ~40 KB
   minified (of a ~76 KB browser bundle). Profiling shows ~90% of default
   triangle-pattern generation time is inside chroma (scale evaluation,
   `mix`, rgb↔lab conversions, `css()`), plus the GC churn from its
   per-call allocations. Chroma's built-in scale cache never hits here
   (each centroid yields a unique float `t`) and only grows.

## Goals

- Wide-gamut output: display-p3 at minimum, with a path to rec2020/HDR as
  browser support matures.
- Output precision no worse than the target format (no hidden 8-bit
  quantization when emitting oklch/p3).
- Smaller browser bundle than today.
- Faster default-path generation, with any speed/fidelity tradeoff
  explicit and tunable rather than hardwired.

## Non-goals

- Changing pattern *geometry* for a given seed. All of this is strictly
  downstream of point generation and triangulation.
- HDR canvas support ahead of the platform: HDR canvas APIs are still
  experimental; the plan leaves room but does not gate on them.
- Preserving exact v5 color output across the migration. This is a
  major-version change (see Compatibility).

## Design

### 1. Decouple the color backend behind an internal seam

Today chroma types leak into the public API: `ColorFunctionParams` hands
user color functions the chroma `xScale`/`yScale` objects, and
`trianglify.utils.mix` re-exports `chroma.mix`. Introduce an internal
interface covering exactly what the pipeline needs:

- `makeScale(colors: string[], space: InterpolationSpace): (t: number) => InternalColor`
- `mix(a: InternalColor, b: InternalColor, ratio: number, space: InterpolationSpace): InternalColor`
- `darken(c: InternalColor, amount: number): InternalColor` (for `shadows`)
- `serialize(c: InternalColor, output: OutputFormat): string`

Everything downstream (colorPoly, built-in color functions, Pattern) uses
the seam. The public color-function contract changes accordingly — scales
become plain `(t) => color` functions with documented semantics instead of
chroma instances. That is the breaking part and what makes this v6 work.

### 2. Swap the backend to culori (preferred) or a minimal internal module

culori is the leading candidate:

- native display-p3 / rec2020 / oklab / oklch support with proper gamut
  mapping (`clampChroma`, CSS Color 4 `formatCss`);
- function-per-operation design, tree-shakeable — expected bundle cost
  well under chroma's ~40 KB for the subset we use;
- unclipped internal representation (plain `{ mode, channels }` objects),
  which removes the sRGB ceiling at the model level.

Fallback option if culori's API churn or size disappoints: implement the
small subset internally (sRGB↔oklab↔oklch conversions, linear
interpolation, one gamut-mapping routine). More maintenance, smallest
possible bundle; decide after a spike measuring both.

Palette definitions (colorbrewer) stay as sRGB hex strings — they are
inputs, and sRGB inputs interpolated in oklab can legitimately produce
out-of-sRGB intermediates that P3 output can now preserve.

### 3. New `colorOutput` option

```
colorOutput: 'rgb' (default) | 'oklch' | 'display-p3'
```

- `'rgb'` — current behavior: 8-bit `rgb(r g b)`, gamut-mapped to sRGB.
  Remains the default so existing consumers see no format change.
- `'oklch'` — decimal-precision `oklch(…)` strings, gamut-mapped to the
  target the caller declares (see open questions).
- `'display-p3'` — `color(display-p3 r g b)` strings, gamut-mapped to P3.

The option lives in TrianglifyOptions and flows into PatternData's
render opts so serialized patterns round-trip. `validatePatternData`
already accepts any string for `poly.color`, so serialization is
compatible as-is.

### 4. Renderer support matrix

| Renderer | sRGB | display-p3 / oklch | Notes |
|---|---|---|---|
| SVG (browser) | works | works | CSS Color 4 strings are valid fill/stroke values in modern browsers |
| SVG (string/Node) | works | works | we only emit strings; consumer's rasterizer determines support |
| Canvas (browser) | works | needs `getContext('2d', { colorSpace: 'display-p3' })` | toCanvas must pass the context option when colorOutput is wide-gamut; feature-detect and document fallback |
| Canvas (node-canvas) | works | **unsupported** | node-canvas parses neither `oklch()` nor `color(display-p3 …)`; toCanvas should throw a clear error for wide-gamut output in Node rather than render black |

The node-canvas row is a hard constraint to surface in docs and in a
runtime check — a wide-gamut pattern must fail loudly in Node canvas
rendering, not silently mis-render.

### 5. Performance: per-axis scale memoization

Measured on the current pipeline: default generation is ~90% color work;
a quantize-and-memoize prototype recovered 1.7×–8× depending on cache
warmth. The wide-gamut requirement rules out hardwiring the quantization
to 1/256 (that was only defensible because the current output floor is
8-bit). Plan:

- memoize `xScale` and `yScale` **per axis** at N steps each (fixed cache
  of 2N entries — hit rate does not collapse as N grows, unlike caching
  (x, y) pairs), and keep the per-polygon `mix` exact;
- N defaults derived from the output format (256 for `'rgb'`, 1024+ for
  wide-gamut/decimal formats), overridable via an option
  (e.g. `colorQuantization: number | false`), `false` = exact;
- only applies to color functions that don't consume the seeded `random`
  stream (memoizing `sparkle`/`shadows` would change their RNG draw
  sequence); built-ins declare this, custom functions default to exact.

Positional error is bounded by 1/N per axis; note that multi-stop
palettes steepen the local gradient slope (worst case ~(stops−1)× the
single-span slope), which is why N stays tunable.

### 6. Compatibility and migration

- Major version (v6): the color-function API changes shape (no chroma
  scales), `utils.mix` is replaced, and exact color output shifts even in
  sRGB mode (different interpolation implementations round differently).
- Geometry, seeds, PatternData structure, and renderer APIs are unchanged.
- MIGRATING.md gets a v5 → v6 section; the v5 → v6 color delta should be
  quantified (max channel delta over the test corpus) and documented.
- The `@types/chroma-js` runtime dependency goes away with chroma.

## Phased execution

1. **Spike (timeboxed):** wire culori behind the seam for
   `interpolateLinear` only; measure bundle delta, perf delta, and sRGB
   output delta vs chroma. Go/no-go on culori vs internal module.
2. **Seam + backend swap:** land the internal color interface, port all
   built-in color functions and `utils.mix`, remove chroma. All existing
   tests pass with updated color fixtures.
3. **`colorOutput` option:** serialization formats, gamut mapping,
   PatternData round-trip, node-canvas guard, browser canvas colorSpace
   plumbing. New tests: string-format assertions per output mode, P3
   round-trip through toData/fromData, Node error path.
4. **Memoization:** per-axis scale cache with format-derived defaults and
   the `colorQuantization` escape hatch. Perf benchmarks recorded in the
   test suite or a scripts/bench harness so regressions are visible.
5. **Docs:** Readme color section, MIGRATING.md, example gallery entry
   rendering the same seed in sRGB vs display-p3.

## Open questions

- Should `colorOutput: 'oklch'` gamut-map to sRGB (safe everywhere) or P3
  (better on wide-gamut displays, clipped elsewhere)? Possibly a separate
  `gamut` option; needs a decision before phase 3.
- Does `toCanvas` auto-detect P3 support and fall back to sRGB with a
  console warning, or require explicit opt-in? Leaning explicit, to keep
  output deterministic.
- Whether to expose the internal scale/mix seam publicly for custom color
  functions that want wide-gamut math, or keep it private until the API
  settles.
