import type { Point } from '../types'

export interface TilingResult {
  points: Point[]
  polys: number[][]
}

/**
 * Merge coincident vertices via spatial hashing so adjacent
 * pentagons share edge vertices cleanly (no hairline gaps).
 * Also removes duplicate polygons (same vertex set).
 */
function deduplicateVertices(rawPolys: Point[][]): TilingResult {
  const EPSILON = 1e-4
  const factor = 1 / EPSILON
  const vertMap = new Map<string, number>()
  const points: Point[] = []

  const getIndex = (p: Point): number => {
    const key = `${Math.round(p[0] * factor)},${Math.round(p[1] * factor)}`
    let idx = vertMap.get(key)
    if (idx === undefined) {
      idx = points.length
      points.push(p)
      vertMap.set(key, idx)
    }
    return idx
  }

  const indexedPolys = rawPolys.map(verts => verts.map(getIndex))

  // Remove duplicate polygons (same set of vertex indices)
  const seen = new Set<string>()
  const polys: number[][] = []
  for (const poly of indexedPolys) {
    const key = [...poly].sort((a, b) => a - b).join(',')
    if (!seen.has(key)) {
      seen.add(key)
      polys.push(poly)
    }
  }

  return { points, polys }
}

// ─── Cairo Tiling ────────────────────────────────────────────────
//
// Equilateral Cairo pentagonal tiling: all 5 edges equal length.
// Pentagon angles: 114.3°, 90°, 131.4°, 90°, 114.3°.
// Derived from sinC = 3/4 where C = 131.4° is the widest angle.
//
// Construction: at each type-A 4-fold center (v1 vertex), place 4
// pentagons rotated 0°, 90°, 180°, 270°. The lattice connects
// same-type centers (skipping the alternating type-B centers at v3).

function generateCairoTiling(width: number, height: number, cellSize: number): TilingResult {
  const s7 = Math.sqrt(7)

  // Lattice constant L (distance between same-type 4-fold centers)
  // L = a * sqrt(4 + sqrt(7))
  // Solve for a given cellSize = L:
  const L = cellSize
  const a = L / Math.sqrt(4 + s7)

  // Base pentagon (v1 at origin = 4-fold center):
  //   v0=(-a, 0), v1=(0,0), v2=(0,a),
  //   v3=(-3a/4, a(4+√7)/4), v4=(a(-3-√7)/4, a(1+√7)/4)
  const basePent: Point[] = [
    [-a, 0],
    [0, 0],
    [0, a],
    [-3 * a / 4, a * (4 + s7) / 4],
    [a * (-3 - s7) / 4, a * (1 + s7) / 4]
  ]

  // 4 rotations about the origin (90° CW each)
  const rotations: ((p: Point) => Point)[] = [
    ([x, y]) => [x, y],
    ([x, y]) => [y, -x],
    ([x, y]) => [-x, -y],
    ([x, y]) => [-y, x],
  ]

  // Lattice vectors: connect same-type 4-fold centers (A→A)
  const ux = a * (1 + s7) / 4, uy = a * (7 + s7) / 4
  const vx = a * (7 + s7) / 4, vy = -a * (1 + s7) / 4

  // Compute tight (i,j) bounds
  const bleed = 2
  const det = ux * vy - vx * uy
  const pad = bleed * L
  const canvasCorners: Point[] = [
    [-pad, -pad], [width + pad, -pad],
    [width + pad, height + pad], [-pad, height + pad]
  ]
  let iMin = Infinity, iMax = -Infinity, jMin = Infinity, jMax = -Infinity
  for (const [px, py] of canvasCorners) {
    const fi = (vy * px - vx * py) / det
    const fj = (-uy * px + ux * py) / det
    iMin = Math.min(iMin, fi); iMax = Math.max(iMax, fi)
    jMin = Math.min(jMin, fj); jMax = Math.max(jMax, fj)
  }
  const i0 = Math.floor(iMin) - 1
  const i1 = Math.ceil(iMax) + 1
  const j0 = Math.floor(jMin) - 1
  const j1 = Math.ceil(jMax) + 1

  const rawPolys: Point[][] = []

  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      // 4-fold center position
      const cx = i * ux + j * vx
      const cy = i * uy + j * vy

      // Generate all 4 rotations of the base pentagon
      for (const rot of rotations) {
        rawPolys.push(basePent.map(p => {
          const [rx, ry] = rot(p)
          return [rx + cx, ry + cy] as Point
        }))
      }
    }
  }

  return deduplicateVertices(rawPolys)
}

// ─── Irregular Convex Pentagon Tiling ────────────────────────────
//
// Each regular hexagon in a hex grid is bisected by a line
// connecting midpoints of two opposite edges, producing 2 congruent
// convex pentagons. Since hexagons tile, the pentagons tile too.

function generateConvexTiling(width: number, height: number, cellSize: number): TilingResult {
  const r = cellSize / 2
  const s3 = Math.sqrt(3)
  const rawPolys: Point[][] = []
  const bleed = 2

  // Hex vertex offsets (flat-top orientation)
  const hv: Point[] = []
  for (let k = 0; k < 6; k++) {
    const angle = k * Math.PI / 3
    hv.push([r * Math.cos(angle), r * Math.sin(angle)])
  }

  // Bisection line: midpoint(v0,v1) to midpoint(v3,v4)
  const m01: Point = [(hv[0]![0] + hv[1]![0]) / 2, (hv[0]![1] + hv[1]![1]) / 2]
  const m34: Point = [(hv[3]![0] + hv[4]![0]) / 2, (hv[3]![1] + hv[4]![1]) / 2]

  const pentA: Point[] = [m01, hv[1]!, hv[2]!, hv[3]!, m34]
  const pentB: Point[] = [hv[0]!, m01, m34, hv[4]!, hv[5]!]

  // Flat-top hex grid: col spacing = 3r/2, row spacing = r√3
  const cStep = 1.5 * r
  const rStep = r * s3

  const cols = Math.ceil(width / cStep) + 2 * bleed
  const rows = Math.ceil(height / rStep) + 2 * bleed

  for (let row = -bleed; row < rows; row++) {
    for (let col = -bleed; col < cols; col++) {
      const hx = col * cStep
      const hy = row * rStep + (col % 2 !== 0 ? rStep / 2 : 0)

      rawPolys.push(pentA.map(([dx, dy]) => [hx + dx, hy + dy]))
      rawPolys.push(pentB.map(([dx, dy]) => [hx + dx, hy + dy]))
    }
  }

  return deduplicateVertices(rawPolys)
}

// ─── Irregular Non-Convex Pentagon Tiling ────────────────────────
//
// Step/L-shaped pentagons with one reflex angle. Each square cell
// of side s is split into 2 congruent non-convex pentagons by a
// staircase cut through the center.

function generateNonconvexTiling(width: number, height: number, cellSize: number): TilingResult {
  const s = cellSize
  const rawPolys: Point[][] = []
  const bleed = 2

  const cols = Math.ceil(width / s) + 2 * bleed
  const rows = Math.ceil(height / s) + 2 * bleed

  for (let row = -bleed; row < rows; row++) {
    for (let col = -bleed; col < cols; col++) {
      const tx = col * s
      const ty = row * s

      rawPolys.push([
        [tx, ty], [tx + s, ty], [tx + s, ty + s / 2],
        [tx + s / 2, ty + s / 2], [tx + s / 2, ty + s]
      ])
      rawPolys.push([
        [tx + s, ty + s], [tx, ty + s], [tx, ty + s / 2],
        [tx + s / 2, ty + s / 2], [tx + s / 2, ty]
      ])
    }
  }

  return deduplicateVertices(rawPolys)
}

// ─── Dispatcher ──────────────────────────────────────────────────

export function generateTiling(shape: string, width: number, height: number, cellSize: number): TilingResult {
  switch (shape) {
    case 'pentagon-cairo': return generateCairoTiling(width, height, cellSize)
    case 'pentagon-convex': return generateConvexTiling(width, height, cellSize)
    case 'pentagon-nonconvex': return generateNonconvexTiling(width, height, cellSize)
    default: throw new Error(`Unknown tiling shape: ${shape}`)
  }
}
