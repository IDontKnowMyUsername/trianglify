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
    const pattern = generate(shape)

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
