/**
 * @jest-environment node
 */
export {}

// Tests for the pentagonal tiling system (src/utils/tilings.ts),
// exercised through the public API via the pentagon-* shapes.
//
// All three tilings cover the plane exactly (pentagon-nonconvex is
// solved in closed form — see docs/nonconvex-rosette-analysis.md), so
// alongside per-pentagon topology and geometry checks, a coverage test
// certifies gap-free, overlap-free tiling by point sampling.
const trianglify = require('../dist/trianglify.cjs')
const Pattern = trianglify.Pattern

const TILING_SHAPES = ['pentagon-cairo', 'pentagon-convex', 'pentagon-nonconvex']

const WIDTH = 120
const HEIGHT = 120
const CELL_SIZE = 60

const generate = (shape: string, opts: any = {}) =>
  trianglify({ width: WIDTH, height: HEIGHT, cellSize: CELL_SIZE, seed: 'tiling-test', shape, ...opts })

const polyVertices = (pattern: any, poly: any): number[][] =>
  poly.vertexIndices.map((i: number) => pattern.points[i])

const edgeLengths = (verts: number[][]): number[] =>
  verts.map((v, k) => {
    const w = verts[(k + 1) % verts.length]!
    return Math.hypot(w[0]! - v[0]!, w[1]! - v[1]!)
  })

// Shoelace area of a polygon
const polyArea = (verts: number[][]): number => {
  let sum = 0
  for (let k = 0; k < verts.length; k++) {
    const v = verts[k]!
    const w = verts[(k + 1) % verts.length]!
    sum += v[0]! * w[1]! - w[0]! * v[1]!
  }
  return Math.abs(sum) / 2
}

// Even-odd ray-casting point-in-polygon test
const pointInPoly = (x: number, y: number, verts: number[][]): boolean => {
  let inside = false
  for (let k = 0, m = verts.length - 1; k < verts.length; m = k++) {
    const xi = verts[k]![0]!
    const yi = verts[k]![1]!
    const xm = verts[m]![0]!
    const ym = verts[m]![1]!
    if ((yi > y) !== (ym > y) && x < ((xm - xi) * (y - yi)) / (ym - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// Number of reflex vertices, computed winding-agnostically as the
// minority cross-product sign among consecutive edge pairs
const reflexCount = (verts: number[][]): number => {
  const n = verts.length
  let pos = 0
  let neg = 0
  for (let k = 0; k < n; k++) {
    const p = verts[(k + n - 1) % n]!
    const c = verts[k]!
    const q = verts[(k + 1) % n]!
    const z = (c[0]! - p[0]!) * (q[1]! - c[1]!) - (c[1]! - p[1]!) * (q[0]! - c[0]!)
    if (z > 0) {
      pos++
    } else {
      neg++
    }
  }
  return Math.min(pos, neg)
}

for (const shape of TILING_SHAPES) {
  describe(`${shape} tiling`, () => {
    // generate inside the test lifecycle so a throw fails these tests with
    // a real error instead of a suite-level collection error
    let pattern: any
    beforeAll(() => { pattern = generate(shape) })

    test('generates a Pattern of pentagons', () => {
      expect(pattern).toBeInstanceOf(Pattern)
      expect(pattern.polys.length).toBeGreaterThan(0)
      for (const poly of pattern.polys) {
        expect(Object.keys(poly).sort()).toEqual(['centroid', 'color', 'vertexIndices'])
        expect(poly.vertexIndices).toHaveLength(5)
      }
    })

    test('all vertex indices are valid and coordinates are finite', () => {
      for (const point of pattern.points) {
        expect(Number.isFinite(point[0])).toBe(true)
        expect(Number.isFinite(point[1])).toBe(true)
      }
      for (const poly of pattern.polys) {
        for (const i of poly.vertexIndices) {
          expect(Number.isInteger(i)).toBe(true)
          expect(i).toBeGreaterThanOrEqual(0)
          expect(i).toBeLessThan(pattern.points.length)
        }
      }
    })

    test('adjacent pentagons share deduplicated vertices', () => {
      // If vertex dedup failed, every pentagon would carry 5 private
      // vertices and points.length would equal 5 * polys.length
      expect(pattern.points.length).toBeLessThan(5 * pattern.polys.length)
    })

    test('no duplicate pentagons', () => {
      const keys = new Set(
        pattern.polys.map((poly: any) => [...poly.vertexIndices].sort((a: number, b: number) => a - b).join(','))
      )
      expect(keys.size).toBe(pattern.polys.length)
    })

    test('centroid is the vertex average', () => {
      for (const poly of pattern.polys) {
        const verts = polyVertices(pattern, poly)
        const cx = verts.reduce((sum, v) => sum + v[0]!, 0) / verts.length
        const cy = verts.reduce((sum, v) => sum + v[1]!, 0) / verts.length
        expect(poly.centroid.x).toBeCloseTo(cx, 6)
        expect(poly.centroid.y).toBeCloseTo(cy, 6)
      }
    })

    test('polys are colored with css() color objects', () => {
      const css = pattern.polys[0].color.css()
      expect(typeof css).toBe('string')
      expect(css.length).toBeGreaterThan(0)
    })

    test('is deterministic for a fixed seed', () => {
      const a = generate(shape).toSVGTree().toString()
      const b = generate(shape).toSVGTree().toString()
      expect(a).toBe(b)
      expect(a).toContain('<path')
    })

    test('smaller cellSize produces more pentagons', () => {
      const fine = generate(shape, { cellSize: 40 })
      const coarse = generate(shape, { cellSize: 80 })
      expect(fine.polys.length).toBeGreaterThan(coarse.polys.length)
    })

    test('covers the canvas with no gaps or overlaps', () => {
      // Every sample point in the visible canvas must fall inside exactly
      // one pentagon: 0 means a gap, 2+ means an overlap. The fractional
      // offsets keep samples away from pentagon edges and vertices.
      const polyVerts = pattern.polys.map((poly: any) => polyVertices(pattern, poly))
      const N = 13
      const uncovered: string[] = []
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x = (i + 0.271828) * (WIDTH / N)
          const y = (j + 0.577215) * (HEIGHT / N)
          let count = 0
          for (const verts of polyVerts) {
            if (pointInPoly(x, y, verts)) count++
          }
          if (count !== 1) uncovered.push(`(${x.toFixed(1)}, ${y.toFixed(1)}) covered ${count}x`)
        }
      }
      expect(uncovered).toEqual([])
    })
  })
}

describe('vertex dedup adjacent-bucket fallback', () => {
  // deduplicateVertices (src/utils/tilings.ts) merges coincident vertices
  // through a bucket map quantized at EPSILON = 1e-4. Normally both float
  // representations of a duplicated lattice vertex round into the same
  // bucket (the home-bucket fast path); the 3x3 adjacent-bucket fallback
  // exists for the rare case where a bucket boundary falls between two
  // representations that differ by a few ulps. These parameter sets were
  // found by an offline search so that at least one duplicated vertex
  // straddles a bucket boundary — they keep the fallback (the correctness
  // guard against splitting one vertex into two indices) exercised.
  //
  // How they were constructed (docs/gamut-mapping-and-dedup-fallback-plan.md,
  // Part 2 — note the plan's random parameter sweep is hopeless in practice:
  // representations differ by only a few ulps, so a random pattern straddles
  // with probability ~ulps/EPSILON ≈ 1e-8 per pair; ~24k sampled parameter
  // sets over three canvases found nothing). Instead the cases were solved
  // for directly: replicate the layout+stamping arithmetic offline, list
  // duplicate pairs whose representations differ in bits, exploit that
  // coordinates scale ~linearly with cellSize to aim a bucket boundary into
  // a pair's interval, then micro-scan cellSize in ulp steps (each step
  // moves a coordinate by ~1 of its ulps, so the few-ulp window cannot be
  // stepped over) until the straddle appears. Every case was then verified
  // against the built bundle by watching the fallback's block-execution
  // count with V8 precise coverage (node:inspector,
  // Profiler.takePreciseCoverage) in an isolated process.
  //
  // Several independent cases are pinned because Math.cos/Math.sin last-ulp
  // results are V8-version-dependent: an engine libm change could shift a
  // case off the boundary. That would not fail this test (the invariants
  // hold either way) but would silently drop fallback coverage — multiple
  // cases make losing all of them at once unlikely. If a V8 upgrade ever
  // zeroes the fallback's coverage, re-run the solver to mint new cases.
  const CASES: [string, number, number, number, number][] = [
    // [shape, width, height, cellSize, expected points.length]
    ['pentagon-cairo', 240, 240, 46.99994957762656, 1633],
    ['pentagon-cairo', 240, 240, 46.99996126356695, 1633],
    ['pentagon-convex', 240, 240, 46.99998909551744, 2644],
    ['pentagon-convex', 240, 240, 46.99998959909718, 2644],
    ['pentagon-nonconvex', 240, 240, 46.99999881880728, 6321]
  ]

  const EPSILON = 1e-4

  test.each(CASES)('%s at cellSize %s dedups across bucket boundaries', (shape, width, height, cellSize, expectedPoints) => {
    const pattern = trianglify({ width, height, cellSize, seed: 'tiling-test', shape })
    // exact count pinned at search time: every duplicate merged. A fallback
    // regression (wrong offsets, inverted comparison) would split the
    // boundary-straddling vertex and raise the count.
    expect(pattern.points.length).toBe(expectedPoints)
    // and independently: no two returned vertices coincide within EPSILON
    // (grid-based O(n) nearest-neighbor check)
    const buckets = new Map<number, number[][]>()
    for (const [x, y] of pattern.points as [number, number][]) {
      const qx = Math.round(x / EPSILON)
      const qy = Math.round(y / EPSILON)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const [ex, ey] of buckets.get((qx + dx) * 0x100000000 + (qy + dy)) ?? []) {
            expect(Math.abs(ex! - x) < EPSILON && Math.abs(ey! - y) < EPSILON).toBe(false)
          }
        }
      }
      const key = qx * 0x100000000 + qy
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push([x, y])
    }
  })
})

describe('pentagon-cairo geometry', () => {
  test('pentagons are equilateral with edge length cellSize/sqrt(4+sqrt(7))', () => {
    const pattern = generate('pentagon-cairo')
    const a = CELL_SIZE / Math.sqrt(4 + Math.sqrt(7))
    for (const poly of pattern.polys) {
      for (const len of edgeLengths(polyVertices(pattern, poly))) {
        expect(Math.abs(len - a)).toBeLessThan(1e-2)
      }
    }
  })

  test('pentagons are convex', () => {
    const pattern = generate('pentagon-cairo')
    for (const poly of pattern.polys) {
      expect(reflexCount(polyVertices(pattern, poly))).toBe(0)
    }
  })

  test('substantial vertex sharing (interior vertices have valence 3-4)', () => {
    const pattern = generate('pentagon-cairo')
    expect(pattern.points.length).toBeLessThan(0.6 * 5 * pattern.polys.length)
  })
})

describe('pentagon-convex geometry', () => {
  test('pentagons have edge pattern [s/2, s/2, s/2, s, s] with s = 2*cellSize/sqrt(21)', () => {
    const pattern = generate('pentagon-convex')
    const s = 2 * CELL_SIZE / Math.sqrt(21)
    const expected = [s / 2, s / 2, s / 2, s, s]
    for (const poly of pattern.polys) {
      const lengths = edgeLengths(polyVertices(pattern, poly)).sort((a, b) => a - b)
      lengths.forEach((len, k) => {
        expect(Math.abs(len - expected[k]!)).toBeLessThan(1e-2)
      })
    }
  })

  test('pentagons are convex', () => {
    const pattern = generate('pentagon-convex')
    for (const poly of pattern.polys) {
      expect(reflexCount(polyVertices(pattern, poly))).toBe(0)
    }
  })

  test('substantial vertex sharing (6-fold rosette centers)', () => {
    const pattern = generate('pentagon-convex')
    expect(pattern.points.length).toBeLessThan(0.6 * 5 * pattern.polys.length)
  })
})

describe('pentagon-nonconvex geometry', () => {
  test('every pentagon has exactly one reflex vertex', () => {
    const pattern = generate('pentagon-nonconvex')
    for (const poly of pattern.polys) {
      expect(reflexCount(polyVertices(pattern, poly))).toBe(1)
    }
  })

  test('edge lengths match the exact solution', () => {
    // BC = 4·cellSize/√39; the exact closure gives
    // CD = DE = BC/4, EA = BC/8, AB = 3√3/8 · BC
    const pattern = generate('pentagon-nonconvex')
    const rBC = 4 * CELL_SIZE / Math.sqrt(39)
    const expected = [rBC / 8, rBC / 4, rBC / 4, rBC * 3 * Math.sqrt(3) / 8, rBC]
    for (const poly of pattern.polys) {
      const lengths = edgeLengths(polyVertices(pattern, poly)).sort((a, b) => a - b)
      lengths.forEach((len, k) => {
        expect(Math.abs(len - expected[k]!)).toBeLessThan(1e-2)
      })
    }
  })

  test('pentagon area is exactly √3/24 · cellSize²', () => {
    // 12 pentagons per rosette × √3/24 · cellSize² = √3/2 · cellSize²,
    // the area of the triangular lattice unit cell — the area form of
    // the gap-free closure proof
    const pattern = generate('pentagon-nonconvex')
    const expected = Math.sqrt(3) / 24 * CELL_SIZE * CELL_SIZE
    for (const poly of pattern.polys) {
      expect(Math.abs(polyArea(polyVertices(pattern, poly)) - expected)).toBeLessThan(0.05)
    }
  })
})
