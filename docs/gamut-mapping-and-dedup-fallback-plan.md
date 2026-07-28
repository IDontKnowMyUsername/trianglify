# Plan: CSS gamut mapping for color output, and covering the dedup fallback

Status: **implemented** (2026-07-27, same day as the plan). Written
2026-07-27. These are the two refinements left open by the color pipeline
implementation (docs/color-pipeline-plan.md, "Implementation status") and by
the tiling dedup optimization: replace channel clamping with
chroma-preserving gamut mapping in `serializeColor`, and add a test that
actually exercises the 3×3 adjacent-bucket fallback in
`deduplicateVertices`.

Deviations found during implementation:

- **Part 1 needed a fast-path gamut probe.** `toGamut`'s in-gamut
  short-circuit is not cheap: it converts to oklch, runs the displayable
  check, and converts back — measured ~+39% on default-pattern generation
  when used unconditionally. `serializeColor` therefore converts once and
  only invokes the mapper when a channel is outside [0, 1]. Residual cost
  on a 7500-poly benchmark pattern containing 17 out-of-gamut polys:
  ~+6% generation (~1 ms), traced to V8 IC pollution of culori's shared
  converter internals once the mapping path runs, not to the mapping calls
  themselves; patterns with no out-of-gamut colors are unaffected, and
  isolated `css()` calls are unchanged.
- **Part 2's probability model was wrong by ~2 orders of magnitude.**
  Duplicate float representations of a lattice vertex differ by a few
  *ulps* (~2e-16·|x|), not ~1e-13·|x|: many are even bit-identical (cairo's
  prototile rotations are exact negations/swaps, so only inter-cell seam
  vertices differ). A sweep per the plan (5409 parameter sets over three
  canvas sizes, then another ~19k micro-jittered samples at |x| up to
  16000) found zero straddles. The pinned cases were instead **solved
  for**: replicate the layout+stamping arithmetic offline, enumerate
  bit-different duplicate pairs, scale cellSize to aim a bucket boundary
  into a pair's interval (coordinates scale ~linearly with cellSize), and
  micro-scan cellSize in ulp steps — each step moves a coordinate ~1 ulp,
  so the straddle window cannot be stepped over. Every case was verified
  against the built bundle with V8 precise coverage in an isolated
  process. This also made the pinned patterns small (240×240, ~10-50 ms)
  instead of needing large canvases.

The two items are independent — they can land in either order or together.

---

## Part 1: chroma-preserving gamut mapping (`toGamut`)

### Current behavior and why it's imperfect

`serializeColor` (src/utils/colorBackend.ts) clamps out-of-gamut colors
per channel: `'rgb'` output clamps r/g/b to [0, 1] before 8-bit rounding,
`'display-p3'` clamps the converted P3 channels, `'oklch'` is emitted
unclamped. Channel clamping matches what chroma-js did in earlier
releases, but it distorts out-of-gamut colors: clipping one channel shifts
hue and lightness together (a saturated lab-interpolated teal that
overshoots green clips toward a different hue entirely). Interpolating
sRGB palette stops in `lab`/`oklch` routinely produces small overshoots,
and wide-gamut workflows make bigger ones likely.

### Proposed change

Use culori's CSS Color 4 gamut mapping instead. Verified against the
installed culori 4.0.2 (`src/clamp.js`):

- `toGamut(dest = 'rgb', mode = 'oklch', delta = differenceEuclidean('oklch'), jnd = 0.02)`
  is exported from `culori/fn`. It returns a `color → color` mapper into
  `dest` that preserves hue and lightness and binary-searches **chroma**
  in oklch until the color fits the destination gamut (with a
  just-noticeable-difference stop). This is the algorithm browsers use to
  map CSS colors to displays.
- In-gamut colors pass through the search untouched (the displayable
  check short-circuits), so the common case stays cheap.
- Caveat found in the source: if the destination mode definition carries
  no `gamut` flag, `toGamut` silently degrades to a plain conversion
  (`clamp.js:199`). The tests below must therefore assert actual mapping
  behavior, not merely absence of errors.

Changes:

1. **`src/utils/culori-fn.d.ts`** — declare `toGamut`:
   `export function toGamut(dest?: string, mode?: string, delta?: unknown, jnd?: number): (color: CuloriColor | string) => CuloriColor`
2. **`src/utils/colorBackend.ts`** — build `const toGamutRgb = toGamut('rgb')`
   and `const toGamutP3 = toGamut('p3')` at module level; in
   `serializeColor`, replace the `clamp01` calls in the `'rgb'` and
   `'display-p3'` branches with the mapped color (keep the 8-bit rounding
   for `'rgb'` and the 5-decimal rounding for `'display-p3'`). Keep a
   plain channel clamp *after* mapping as a belt-and-braces guard against
   1-ulp overshoot from the binary search. `'oklch'` stays unclamped.
   `clamp01` remains for the alpha channel.
3. **Readme** — the `colorOutput` section currently says "gamut-clamped";
   update to "gamut-mapped (CSS Color 4 chroma reduction)".
4. **No new option.** The clamping behavior was an implementation detail
   of an unreleased v5; mapping simply replaces it. If someone later needs
   bit-exact legacy clipping, a `gamutMapping: 'css' | 'clip'` option is
   the natural extension — not needed now.

### Tests and acceptance

- Unit tests through the public API (`trianglify.utils.css`):
  - An in-gamut color serializes identically before/after (e.g.
    `css('#3498db')` unchanged).
  - A deliberately out-of-gamut color, e.g.
    `{ mode: 'oklch', l: 0.7, c: 0.35, h: 150 }`:
    - `'rgb'` result has all channels in [0, 255] **and** differs from
      what naive channel clipping produces (this is the assertion that
      catches the silent-degradation caveat);
    - hue is approximately preserved: convert the result back to oklch
      and assert `h` within a few degrees of 150;
    - `'display-p3'` channels are in [0, 1] and the p3 gamut volume is
      actually used (the mapped p3 color has higher chroma than the
      sRGB-mapped one).
- Pattern-level: regenerate snapshots only if any snapshot color actually
  changes (the default-palette snapshot seeds may be entirely in-gamut —
  check before assuming churn).
- Benchmark before/after with the existing scratch benchmark: expect no
  measurable regression on default patterns (in-gamut short-circuit);
  record the number in the commit message if non-zero.
- Bundle-size check: `toGamut` pulls in `differenceEuclidean` and the
  clamp machinery; the existing size-ceiling test (72 KB minified) has
  ~10 KB headroom, which should absorb it easily — verify, don't assume.

### Risks

- Colors change for out-of-gamut inputs (that is the point). Pre-release,
  so no compatibility burden; changelog gets one line.
- coverage: the new module-level converters are exercised by every
  serialization, and the out-of-gamut branch by the new unit tests —
  `colorBackend.ts` should stay at 100%.

---

## Part 2: a test that exercises the dedup adjacent-bucket fallback

### What is uncovered and why

`deduplicateVertices` (src/utils/tilings.ts) merges coincident tiling
vertices via a quantized bucket map (bucket size `EPSILON = 1e-4`). The
home-bucket fast path added in the perf work now handles every case the
test suite produces, leaving the 3×3 adjacent-bucket fallback (the loop
body at roughly tilings.ts:67-71) uncovered. The fallback is the
correctness guard for the case where two float representations of the
same lattice vertex round across a bucket boundary (their difference is
~1e-13·|x| but the boundary happens to fall inside that window). Today a
regression in that loop — wrong bucket offsets, an inverted comparison —
would produce no test signal at all.

### Why a natural-parameters test is possible

Whether a duplicate pair straddles a boundary is a deterministic property
of the tiling arithmetic at given `(shape, width, height, cellSize)`.
Rough probability per duplicated vertex is
`(1e-13·|x|) / 1e-4` ≈ 4e-6 at coordinate magnitudes around 4000, and a
large tiling has ~1e5 duplicated vertices — so a single large pattern has
order-tens-of-percent odds of containing at least one straddling pair,
and a search over cellSizes finds cases quickly.

### Test strategy (recommended)

1. **Offline parameter search** (scratch script, not checked in): loop
   candidate parameters — the three tiling shapes × a sweep of cellSizes
   (e.g. 20..80 in 0.1 steps) at a mid-size canvas — and for each, run
   the suite's single parametrized tiling test under coverage
   (`jest --coverage --coverageReporters=json` on a one-off test file, or
   `NODE_V8_COVERAGE` on a small script requiring the dist bundle) and
   inspect whether src/utils/tilings.ts's fallback lines were hit. Keep
   the smallest hits.
2. **Pin the found constants** in `src/tilings.test.ts` as a new test:
   generate the tiling at the pinned parameters and assert the standard
   invariants — exact expected vertex count (dedup happened) and no two
   returned points within `EPSILON` of each other (no vertex split). A
   comment must document that the parameters were searched specifically
   so that a duplicated vertex quantizes across a bucket boundary, and
   how to re-run the search.
3. **Pin 3–5 independent cases**, not one. The layout math uses
   `Math.cos`/`Math.sin`, whose last-ulp results are V8-version-dependent
   (IEEE 754 does not pin transcendentals). A V8 libm change could shift
   one case off the boundary — the test would still pass (the invariants
   hold either way) but silently stop covering the fallback. Multiple
   independent cases make simultaneous loss unlikely; the coverage
   per-file floor (90%) tolerates a temporary loss of the ~1.5% of lines
   involved without failing CI.

### Alternatives considered

- **Export `deduplicateVertices` for direct unit testing** with
  hand-crafted straddling inputs (e.g. x₁ = 5.00000e-5, x₂ = 4.99999e-5:
  1e-10 apart, buckets 1 and 0). Deterministic and precise — but the
  function would need to surface through the dist bundle (tests import
  dist only, and importing `src/` directly in a test corrupts the
  coverage remap per the CLAUDE.md invariants), which means widening the
  public API surface with an internal. Keep as fallback if the parameter
  search surprises.
- **`/* v8 ignore */` the fallback** — rejected: the loop is a
  correctness guard, not unreachable code; excluding it hides exactly the
  regression signal we want.

### Acceptance

- Coverage report shows src/utils/tilings.ts at 100% statements/lines
  with the fallback loop hit, using only public-API tests.
- The new test documents its own derivation and fails if dedup ever
  splits a boundary-straddling vertex into two indices.

---

## Sequencing

Either part first; both are small (Part 1 ≈ half a day including
benchmarks, Part 2 ≈ half a day dominated by the search run). Neither
touches geometry, seeds, or the serialization wire format.
