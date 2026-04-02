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
// Type 5 convex monohedral tiling (6-fold rosette).
// Angles: A = B = D = E = 120°, C = 60° (sum 540°).
// Sides: c = d = s (long, at the 60° vertex), a = b = e = s/2 (short).
//
// Construction: at each 6-fold center (C vertex), place 6 pentagons
// rotated 0°, 60°, 120°, 180°, 240°, 300°. The triangular lattice
// connects rosette centers with spacing s√21/2.

function generateConvexTiling(width: number, height: number, cellSize: number): TilingResult {
  const s3 = Math.sqrt(3)

  // cellSize = s√21/2 → s = 2·cellSize/√21
  const s = 2 * cellSize / Math.sqrt(21)

  // Base pentagon (C at origin, edge d along +x):
  //   C=(0,0), D=(s,0), E=(5s/4, s√3/4), A=(s, s√3/2), B=(s/2, s√3/2)
  const basePent: Point[] = [
    [0, 0],
    [s, 0],
    [5 * s / 4, s * s3 / 4],
    [s, s * s3 / 2],
    [s / 2, s * s3 / 2]
  ]

  // 6 rotations about the origin (60° CCW each)
  const c60 = 0.5, s60 = s3 / 2
  const rotations: ((p: Point) => Point)[] = [
    ([x, y]) => [x, y],
    ([x, y]) => [x * c60 - y * s60, x * s60 + y * c60],
    ([x, y]) => [-x * c60 - y * s60, x * s60 - y * c60],
    ([x, y]) => [-x, -y],
    ([x, y]) => [-x * c60 + y * s60, -x * s60 - y * c60],
    ([x, y]) => [x * c60 + y * s60, -x * s60 + y * c60],
  ]

  // Triangular lattice vectors (connect rosette centers)
  const ux = 9 * s / 4, uy = s * s3 / 4
  const vx = 3 * s / 4, vy = 5 * s * s3 / 4

  // Compute tight (i,j) bounds
  const bleed = 2
  const det = ux * vy - vx * uy
  const pad = bleed * cellSize
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
      // Rosette center position
      const cx = i * ux + j * vx
      const cy = i * uy + j * vy

      // Generate all 6 rotations of the base pentagon
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

// ─── Irregular Non-Convex Pentagon Tiling ────────────────────────
//
// Non-convex pentagon tiling forming 12-fold star rosettes.
// Pentagon tip angle B ≈ 30°; 12 petals × 30° = 360°.
//
// Angles: B≈30°, C≈48°, D≈136°, E≈237°(reflex), A≈90° (sum 540°).
// E is the reflex vertex that creates the indent interlocking
// adjacent petals. Construction: at each rosette center (B vertex),
// place 12 pentagons alternating normal and mirror-reflected.

function generateNonconvexTiling(width: number, height: number, cellSize: number): TilingResult {
  // 12 petals → 30° each. Half-angle = 15°.
  const halfAngle = Math.PI / 12
  const cosH = Math.cos(halfAngle)
  const sinH = Math.sin(halfAngle)
  const cos3H = Math.cos(3 * halfAngle)
  const sin3H = Math.sin(3 * halfAngle)

  // Arm lengths and geometry
  const r = cellSize / 1.68
  const rBC = r * 1.047  // B→C arm
  const rAB = r * 0.647  // A→B arm

  // Indent depth: D→E edge length as fraction of r
  const deFrac = 0.2567
  const deLen = deFrac * r

  // Edge directions (tuned so adjacent rosettes mesh)
  const dirCD = 147.4 * Math.PI / 180
  const dirDE = -168.2 * Math.PI / 180
  const dirEA = 135.3 * Math.PI / 180

  const C0x = rBC * cosH, C0y = rBC * sinH    // C at 15°
  const A0x = rAB * cos3H, A0y = rAB * sin3H  // A at 45°

  const cdD = Math.cos(dirCD), sdD = Math.sin(dirCD)
  const cdE = Math.cos(dirDE), sdE = Math.sin(dirDE)
  const cdA = Math.cos(dirEA), sdA = Math.sin(dirEA)

  // Solve C→D and E→A lengths from polygon closure
  const closureX = A0x - C0x - deLen * cdE
  const closureY = A0y - C0y - deLen * sdE
  const detM = cdD * sdA - cdA * sdD
  const cdLen = (closureX * sdA - closureY * cdA) / detM

  const D0x = C0x + cdLen * cdD, D0y = C0y + cdLen * sdD
  const E0x = D0x + deLen * cdE, E0y = D0y + deLen * sdE

  // Normal pentagon (B at origin)
  const basePent: Point[] = [
    [0, 0], [C0x, C0y], [D0x, D0y], [E0x, E0y], [A0x, A0y]
  ]

  // Mirrored pentagon: reflect across x-axis, reverse vertex order
  const mirrorPent: Point[] = [
    [0, 0], [A0x, -A0y], [E0x, -E0y], [D0x, -D0y], [C0x, -C0y]
  ]

  // Lattice of rosette centers: u = C - rot(A, 120°), v = rot(u, 60°)
  const cos120 = Math.cos(2 * Math.PI / 3), sin120 = Math.sin(2 * Math.PI / 3)
  const ux = C0x - (A0x * cos120 - A0y * sin120)
  const uy = C0y - (A0x * sin120 + A0y * cos120)
  const c60 = Math.cos(Math.PI / 3), s60 = Math.sin(Math.PI / 3)
  const vx = ux * c60 - uy * s60, vy = ux * s60 + uy * c60

  // Compute tight (i,j) bounds
  const bleed = 2
  const latticeLen = Math.sqrt(ux * ux + uy * uy)
  const det = ux * vy - vx * uy
  const pad = bleed * latticeLen
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
      const cx = i * ux + j * vx
      const cy = i * uy + j * vy

      for (let k = 0; k < 12; k++) {
        const pent = k % 2 === 0 ? basePent : mirrorPent
        const step = Math.PI / 6  // 30°
        const angle = k * step
        const ca = Math.cos(angle), sa = Math.sin(angle)

        rawPolys.push(pent.map(([px, py]) => {
          return [px * ca - py * sa + cx, px * sa + py * ca + cy] as Point
        }))
      }
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
