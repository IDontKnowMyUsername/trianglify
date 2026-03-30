# Trianglify Performance Optimization Plan

## Table of Contents

- [Overview](#overview)
- [Part A: Rendering Pipeline Optimizations](#part-a-rendering-pipeline-optimizations)
  - [A1: Cache CSS color strings at polygon construction](#a1-cache-css-color-strings-at-polygon-construction)
  - [A2: Hoist loop invariants in triangle construction](#a2-hoist-loop-invariants-in-triangle-construction)
  - [A3: Set canvas lineJoin once](#a3-set-canvas-linejoin-once)
  - [A4: Pre-resolve vertex coordinates in canvas drawPoly](#a4-pre-resolve-vertex-coordinates-in-canvas-drawpoly)
  - [A5: Eliminate wrapper object allocations in drawPoly](#a5-eliminate-wrapper-object-allocations-in-drawpoly)
  - [A6: Numeric SVG point rounding](#a6-numeric-svg-point-rounding)
  - [A7: Use for-loops in hot rendering paths](#a7-use-for-loops-in-hot-rendering-paths)
  - [A8: Inline the norm clamp](#a8-inline-the-norm-clamp)
- [Part B: Point Generation -- Poisson-Disc Sampling](#part-b-point-generation----poisson-disc-sampling)
  - [B1: Background and Motivation](#b1-background-and-motivation)
  - [B2: Current Approach and Its Limitations](#b2-current-approach-and-its-limitations)
  - [B3: Bridson's Algorithm for Poisson-Disc Sampling](#b3-bridsons-algorithm-for-poisson-disc-sampling)
  - [B4: Design for Trianglify Integration](#b4-design-for-trianglify-integration)
  - [B5: API Surface Changes](#b5-api-surface-changes)
  - [B6: Implementation Steps](#b6-implementation-steps)
- [Implementation Order](#implementation-order)
- [Testing Strategy](#testing-strategy)

---

## Overview

This document covers two categories of performance optimization for the
Trianglify library:

**Part A** targets the rendering pipeline -- eliminating redundant work in
color conversion, canvas state management, object allocation, and loop
structure. These are low-risk, backward-compatible changes that improve
runtime without altering visual output.

**Part B** addresses GitHub issue #150: replacing the jittered-grid point
generation algorithm with Bridson's Poisson-disc sampling. This produces
higher-quality visual output (more uniform triangle sizes, no grid-aligned
artifacts) while running in linear time. This is inspired by Mike Bostock's
analysis at https://bost.ocks.org/mike/algorithms/.

---

## Part A: Rendering Pipeline Optimizations

### Context: Why .css() Is Expensive

Every polygon carries a chroma-js `Color` object. The `.css()` method on that
object calls `rgb2css()` internally, which involves: argument unpacking via
`unpack()`, a `last()` call to detect the output mode, `Math.round()` on each
RGB channel, and string template construction. This is not a simple property
lookup -- it does real computation every time.

For a default 600x400 pattern with `cellSize=75`, there are roughly 100-200
polygons. Each polygon's `.css()` is called:

| Rendering path             | Calls per polygon |
|----------------------------|-------------------|
| `toData()`                 | 1                 |
| `toSVG()` with fill        | 1                 |
| `toSVG()` with fill+stroke  | 2                 |
| `toCanvas()` default (fill, strokeWidth=0) | 2 (two-pass) |
| `toCanvas()` with fill+stroke              | 3-4           |

A single pattern rendered to both SVG and Canvas accumulates 4-7 `.css()` calls
per polygon -- up to 1,400 calls for a 200-polygon pattern, all producing the
same string.

---

### A1: Cache CSS color strings at polygon construction

**Impact: HIGH | Complexity: LOW**

**Problem.** `poly.color.css()` is called repeatedly across `toData()`,
`toSVG()`, and `toCanvas()`. Each call recomputes the same CSS string.

**Solution.** Eagerly call `.css()` once when constructing each polygon in
`trianglify()`, and store the result in a closure that the `CSSColor` interface
returns directly.

**File:** `src/trianglify.ts`, lines 138-155

After the color function returns a chroma `Color`:

```typescript
const rawColor = opts.colorFunction({ /* ... */ })
const cssStr = rawColor.css()
const color: CSSColor = { css: () => cssStr }

polys.push({ vertexIndices, centroid, color })
```

Every subsequent `.css()` call becomes a no-op closure returning the cached
string.

**Compatibility analysis.** The `Polygon` interface types `color` as `CSSColor`
(`{ css: () => string }`), not as `chroma.Color`. However, the README at
line 123 documents it as a "Chroma.js color object". In practice, only `.css()`
is used by the rendering code and all internal consumers. `Pattern.fromData()`
already uses this exact pattern (line 88 of `pattern.ts`):

```typescript
color: { css: () => poly.color }
```

This confirms the approach is proven within the codebase.

**Risk.** Any user code that casts `poly.color` to a full chroma `Color` and
calls methods like `.hex()` or `.darken()` would break. This is not a supported
use case per the TypeScript types, but the README documentation is ambiguous.
Consider adding a deprecation note to the README clarifying that `poly.color`
conforms to the `CSSColor` interface.

---

### A2: Hoist loop invariants in triangle construction

**Impact: MEDIUM | Complexity: LOW**

**Problem.** Inside the `for` loop in `trianglify()` (lines 132-133):

```typescript
const { width, height } = opts          // re-destructured every iteration
const norm = (num: number) => ...       // new closure allocated every iteration
```

For ~200 triangles, this creates ~200 unnecessary closures and redundant
destructuring operations.

**Solution.** Move both declarations before the loop, after line 114:

```typescript
const { width, height } = opts
const norm = (num: number): number => Math.max(0, Math.min(1, num))
const polys: Polygon[] = []

for (let i = 0; i < geomIndices.length; i += 3) {
  // ... use width, height, norm directly
```

**File:** `src/trianglify.ts`

**Risk:** None. Neither `width`, `height`, nor `norm` depend on loop state.

---

### A3: Set canvas lineJoin once

**Impact: MEDIUM | Complexity: LOW**

**Problem.** In `pattern.ts` line 185, inside `drawPoly()`:

```typescript
ctx.lineJoin = 'round'
```

This is set identically for every polygon. Canvas context state assignments
are not free -- the browser validates and stores the value each call.

**Solution.** Set `ctx.lineJoin = 'round'` once before the rendering loops,
after acquiring the 2D context, outside `drawPoly`.

**File:** `src/pattern.ts`, around line 182

**Risk:** None. The value never varies between polygons.

---

### A4: Pre-resolve vertex coordinates in canvas drawPoly

**Impact: MEDIUM | Complexity: LOW**

**Problem.** In `drawPoly()` (lines 187-189), each vertex coordinate is accessed
through double array indirection:

```typescript
ctx.moveTo(points[vertexIndices[0]!]![0], points[vertexIndices[0]!]![1])
```

The same `points[vertexIndices[n]!]` lookup is performed twice per vertex
(once for x, once for y).

**Solution.** Cache point references in local variables:

```typescript
const p0 = points[vertexIndices[0]!]!
const p1 = points[vertexIndices[1]!]!
const p2 = points[vertexIndices[2]!]!
ctx.beginPath()
ctx.moveTo(p0[0], p0[1])
ctx.lineTo(p1[0], p1[1])
ctx.lineTo(p2[0], p2[1])
```

**File:** `src/pattern.ts`, inside `drawPoly` closure in `toCanvas`

**Risk:** None. Purely local optimization.

---

### A5: Eliminate wrapper object allocations in drawPoly

**Impact: LOW-MEDIUM | Complexity: LOW**

**Problem.** `drawPoly` receives colors via wrapper objects like
`{ color: poly.color }` and `{ color: polyStrokeColor, width: strokeWidth }`.
These short-lived objects are allocated per polygon per pass (lines 205,
210-214), creating 1-3 throwaway objects per polygon.

**Solution.** Refactor `drawPoly` to accept primitive string arguments instead
of wrapper objects. Combined with A1 (cached CSS), callers pass strings
directly:

```typescript
const drawPoly = (
  poly: Polygon,
  fillColor: string | null,
  strokeColor: string | null,
  lineWidth: number
) => {
  // ... path construction ...
  if (fillColor) { ctx.fillStyle = fillColor; ctx.fill() }
  if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.lineWidth = lineWidth; ctx.stroke() }
}
```

**File:** `src/pattern.ts`, `toCanvas` method

**Risk:** Low. `drawPoly` is a private closure, not part of any public API.

---

### A6: Numeric SVG point rounding

**Impact: LOW | Complexity: LOW**

**Problem.** Line 103 of `pattern.ts`:

```typescript
points.map(p => p.map(x => +x.toFixed(svgOpts.coordinateDecimals)))
```

`toFixed()` returns a string; the unary `+` converts it back to a number.
This creates intermediate string allocations for every coordinate of every
point (400+ strings for 200 points).

**Solution.** Use numeric rounding that avoids string conversion:

```typescript
const factor = Math.pow(10, svgOpts.coordinateDecimals)
const roundedPoints = points.map(p => [
  Math.round(p[0] * factor) / factor,
  Math.round(p[1] * factor) / factor
] as Point)
```

**File:** `src/pattern.ts`, `_toSVG` method

**Risk:** Negligible floating-point differences for edge cases. Immaterial for
SVG coordinate rendering.

---

### A7: Use for-loops in hot rendering paths

**Impact: LOW | Complexity: LOW**

**Problem.** `pattern.ts` uses `polys.forEach()` and `polys.map()` in rendering
methods. These create per-element closure invocations. For hot paths with
100-200+ polygons, plain `for` loops are marginally faster and allow the JIT
to optimize better.

**Solution.** Replace in:
- `toData()` line 72: `this.polys.map(...)` with a for-loop
- `_toSVG()` line 105: `polys.map(...)` with a for-loop
- `toCanvas()` lines 205 and 209: `polys.forEach(...)` with for-loops

**Files:** `src/pattern.ts`

**Risk:** None. Behavioral equivalent.

---

### A8: Inline the norm clamp

**Impact: LOW | Complexity: LOW**

**Problem.** After hoisting (A2), the `norm` function is still a closure call
per use (2 calls per triangle). The function body is
`Math.max(0, Math.min(1, num))`.

**Solution.** Either trust the JIT to inline it (likely after hoisting), or
replace with direct expressions:

```typescript
const xPercent = centroid.x / width
const yPercent = centroid.y / height
const xp = xPercent < 0 ? 0 : xPercent > 1 ? 1 : xPercent
const yp = yPercent < 0 ? 0 : yPercent > 1 ? 1 : yPercent
```

**Recommendation:** Hoisting via A2 is sufficient. Inlining provides marginal
gain at the cost of readability. Consider this optional.

**File:** `src/trianglify.ts`

**Risk:** None.

---

## Part B: Point Generation -- Poisson-Disc Sampling

### B1: Background and Motivation

GitHub issue #150 proposes upgrading the cell generation algorithm using ideas
from Mike Bostock's "Visualizing Algorithms" essay. The essay compares three
sampling strategies for distributing points across a 2D plane:

1. **Uniform random sampling** -- points placed completely at random. Produces
   severe clustering and gaps. Triangle sizes vary wildly.

2. **Mitchell's best-candidate algorithm** -- for each new sample, generate N
   random candidates and keep the one farthest from all existing samples. A
   tunable quality/speed tradeoff via the candidate count. Runs in O(n^2) time
   without spatial indexing.

3. **Bridson's Poisson-disc sampling** -- produces a "blue noise" distribution
   where all points maintain a minimum distance from each other, yet positions
   are not grid-aligned. Runs in O(n) time. Produces the most visually uniform
   result: triangles are approximately the same size with no axis-aligned
   artifacts. Bostock describes the result as "a beautiful Roman mosaic."

The key insight for Trianglify: the current jittered-grid approach is a
compromise between options 1 and a regular grid. At low variance, grid
artifacts are visible. At high variance, triangles become uneven (some very
large, some very small), and gaps can appear at edges. Poisson-disc sampling
eliminates both problems simultaneously.

### B2: Current Approach and Its Limitations

The current `getPoints()` function in `src/trianglify.ts` (lines 161-193):

1. Computes a regular grid with `cellSize` spacing
2. Adds each point at the grid center offset by random jitter
3. Jitter magnitude = `cellSize * variance`, where variance is [0, 1]
4. Pads by 2 cells on each side to ensure full coverage

**Limitations:**
- At `variance: 0`, the output is a perfectly regular grid -- triangulation
  produces a uniform grid of right triangles with visible axis alignment.
- At `variance: 0.75` (default), some grid structure is still perceptible,
  especially in larger patterns.
- At `variance: 1.0+`, points can migrate far from their grid cell, creating
  very large and very small triangles side by side, and gaps at edges.
- The `cellSize` parameter maps directly to grid spacing, so the relationship
  between cellSize and visual density is clear, but the grid basis is
  inherently constraining.

**What works well:** The grid approach is simple, fast, deterministic with a
seed, and guarantees reasonable coverage with padding. Any replacement must
preserve these properties.

### B3: Bridson's Algorithm for Poisson-Disc Sampling

Bridson's algorithm produces a set of points where every pair of points is at
least distance `r` apart, and no point can be added without violating this
constraint (a "maximal" Poisson-disc distribution). The algorithm runs in O(n)
time.

**Algorithm outline:**

1. Create a background grid with cell size `r / sqrt(2)` (guarantees each cell
   contains at most one sample).
2. Pick an initial sample at random. Add it to an "active list."
3. While the active list is non-empty:
   a. Pick a random sample from the active list.
   b. Generate up to `k` candidate points uniformly distributed in the annular
      region between distance `r` and `2r` from the active sample.
   c. For each candidate, check the background grid to see if any existing
      sample is closer than `r`. If no conflict, accept the candidate: add it
      to the output, the grid, and the active list.
   d. If all `k` candidates fail, remove the active sample from the active
      list (it is "surrounded").
4. Return the accepted samples.

**Properties relevant to Trianglify:**
- **Minimum distance guarantee:** Produces uniform triangle sizes after
  Delaunay triangulation. No tiny or huge triangles.
- **No grid artifacts:** Points are not axis-aligned, eliminating the visual
  regularity of the jittered grid.
- **Linear time:** O(n) where n is the number of output points, compared to
  the current grid approach which is also O(n). No performance regression.
- **Tunable density:** The `r` parameter (minimum distance) controls point
  density, directly analogous to the current `cellSize`.
- **Deterministic with seeding:** Uses only the provided random function, so
  it is fully deterministic when seeded.

### B4: Design for Trianglify Integration

**Mapping existing options to Poisson-disc parameters:**

| Trianglify option | Current meaning                      | Poisson-disc mapping                   |
|-------------------|--------------------------------------|----------------------------------------|
| `cellSize`        | Grid cell spacing in pixels          | Minimum distance `r` between points    |
| `variance`        | Jitter magnitude as fraction of cell | **Not directly applicable** (see below)|
| `width`, `height` | Artboard dimensions                  | Sampling domain (with bleed padding)   |
| `seed`            | RNG seed                             | Passed to mulberry32 as before         |
| `points`          | User-provided points (bypass gen)    | Unchanged -- still bypasses generation |

**The variance question.** Poisson-disc sampling does not have a "variance"
knob in the same way. The distribution is inherently random but constrained.
However, we can offer a useful reinterpretation:

- `variance: 0` could fall back to the existing grid algorithm (backward
  compatibility for users who want regular grids).
- `variance: 1` (and the default `0.75`) would use Poisson-disc sampling.
- Values between 0 and 1 could interpolate: generate grid points, then
  perturb each toward a Poisson-disc distribution by the variance factor.

However, this interpolation approach adds complexity for questionable benefit.
A simpler design:

**Recommended approach:**
- Add a new option `pointDistribution: 'grid' | 'poisson'`, defaulting to
  `'grid'` for backward compatibility (or `'poisson'` if a breaking change
  is acceptable in a major version).
- When `'grid'`, use the current `getPoints()` algorithm unchanged.
- When `'poisson'`, use Bridson's algorithm with `r = cellSize`. The
  `variance` option is ignored (or could control `k`, the number of
  candidates per iteration, though the default `k = 30` works well).
- The `points` option continues to bypass generation entirely.

**Bleed/padding strategy for Poisson-disc:** The current grid pads by 2 cells
on each side. For Poisson-disc, sample in a domain expanded by `2 * cellSize`
on each side:

```
domain = [-2*cellSize, width + 2*cellSize] x [-2*cellSize, height + 2*cellSize]
```

Then pass all generated points to Delaunator. Points outside the visible area
ensure triangles at edges are fully covered.

### B5: API Surface Changes

**New option:**

```typescript
interface TrianglifyOptions {
  // ... existing options ...
  /**
   * Point distribution algorithm. 'grid' uses the classic jittered grid.
   * 'poisson' uses Bridson's Poisson-disc sampling for more uniform triangles
   * without grid artifacts.
   * Default: 'grid'
   */
  pointDistribution: 'grid' | 'poisson'
}
```

**Default options change:**

```typescript
const defaultOptions: TrianglifyOptions = {
  // ... existing defaults ...
  pointDistribution: 'grid',  // backward compatible default
}
```

**Validation:** Add to the option validation block:

```typescript
if (opts.pointDistribution && !['grid', 'poisson'].includes(opts.pointDistribution)) {
  throw TypeError(`invalid pointDistribution: ${opts.pointDistribution}`)
}
```

**Worker serialization:** `pointDistribution` is a plain string, so it
serializes naturally via `postMessage`. No special handling needed.

### B6: Implementation Steps

**Step 1: Create `src/utils/poissonDisc.ts`**

A new module implementing Bridson's algorithm:

```typescript
import type { Point } from '../types'

export default function poissonDisc(
  width: number,
  height: number,
  minDist: number,
  random: () => number,
  // k = number of candidates per active sample; 30 is the standard default
  k?: number
): Point[]
```

The function:
1. Computes the expanded domain with bleed padding (2 * minDist on each side).
2. Creates the spatial grid (cell size = minDist / sqrt(2)).
3. Picks a random initial point within the domain.
4. Runs the Bridson active-list loop.
5. Returns the array of `[x, y]` points.

**Step 2: Wire into `trianglify()`**

In `src/trianglify.ts`, modify the point generation dispatch:

```typescript
import poissonDisc from './utils/poissonDisc'

// ... inside trianglify() ...
let points: Point[]
if (opts.points) {
  points = opts.points
} else if (opts.pointDistribution === 'poisson') {
  points = poissonDisc(opts.width, opts.height, opts.cellSize, rand)
} else {
  points = getPoints(opts, rand)
}
```

**Step 3: Update types**

Add `pointDistribution` to `TrianglifyOptions` in `src/types.ts`.

**Step 4: Update defaults and validation**

In `src/trianglify.ts`, add to `defaultOptions` and the validation block.

**Step 5: Tests**

- Add a test that `pointDistribution: 'poisson'` produces a valid pattern.
- Add a snapshot test with a seed to ensure deterministic output.
- Add a test verifying minimum distance constraint (all point pairs >= cellSize).
- Add a test that default behavior (`pointDistribution: 'grid'`) is unchanged.

**Step 6: Update documentation**

- Add `pointDistribution` to the README options table.
- Reference issue #150 in the changelog.

---

## Implementation Order

Priority order balancing impact, risk, and dependency:

| Order | Item | Impact | Complexity | Files Changed |
|-------|------|--------|------------|---------------|
| 1 | A1: Cache .css() | HIGH | LOW | `src/trianglify.ts` |
| 2 | A2: Hoist loop invariants | MEDIUM | LOW | `src/trianglify.ts` |
| 3 | A3: Canvas lineJoin once | MEDIUM | LOW | `src/pattern.ts` |
| 4 | A4: Pre-resolve vertex coords | MEDIUM | LOW | `src/pattern.ts` |
| 5 | A5: Eliminate drawPoly wrappers | LOW-MED | LOW | `src/pattern.ts` |
| 6 | A6: Numeric SVG rounding | LOW | LOW | `src/pattern.ts` |
| 7 | A7: for-loops in hot paths | LOW | LOW | `src/pattern.ts` |
| 8 | A8: Inline norm (optional) | LOW | LOW | `src/trianglify.ts` |
| 9 | B: Poisson-disc sampling | HIGH (quality) | MEDIUM | `src/utils/poissonDisc.ts` (new), `src/trianglify.ts`, `src/types.ts` |

Items 1-8 can be landed as a single commit or broken into two (one for
`trianglify.ts`, one for `pattern.ts`). Item 9 should be a separate commit
as it adds a new feature and a new file.

---

## Testing Strategy

- All tests import from `dist/` bundles. After any change: `pnpm run build && pnpm test`.
- Snapshot tests in `trianglify.browser.test.ts` and `trianglify.node.test.ts`
  verify SVG output. The rendering optimizations (A1-A8) must produce
  **identical** SVG output; update snapshots only if A6 (numeric rounding)
  causes sub-pixel differences.
- Worker round-trip tests (`worker.test.ts`) verify `toData()`/`fromData()`
  serialization -- these should pass unchanged.
- Canvas tests use `jest-canvas-mock`, which validates API calls but not pixel
  output. The mock will catch any incorrect Canvas API usage introduced by
  A3/A4/A5.
- For Part B, add new tests in a new or existing test file verifying Poisson-disc
  output properties (point count > 0, minimum distance constraint, determinism
  with seed).
