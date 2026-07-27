import type { Point, TilingShape } from '../types'

export interface TilingResult {
  points: Point[]
  polys: number[][]
}

// A tiling reduced to translation form: the prototiles (all pentagons
// around one lattice point, rotations/mirrors already applied), the
// lattice vectors that translate them across the plane, and the
// latticeBounds padding margin. generateTiling stamps this out;
// countTilingVertices sizes it without stamping.
interface TilingLayout {
  prototiles: Point[][]
  ux: number
  uy: number
  vx: number
  vy: number
  pad: number
}

// padding margin in lattice pitches applied outside the canvas on every
// side, so edge polygons fully cover the artboard
const bleed = 2

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
    const qx = Math.round(p[0] * factor)
    const qy = Math.round(p[1] * factor)
    // search the 3×3 bucket neighborhood: two float representations of
    // the same lattice vertex can round into adjacent buckets, which
    // would split one vertex into two indices
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const idx = vertMap.get(`${qx + dx},${qy + dy}`)
        if (idx !== undefined) {
          const [ex, ey] = points[idx]!
          if (Math.abs(ex - p[0]) < EPSILON && Math.abs(ey - p[1]) < EPSILON) {
            return idx
          }
        }
      }
    }
    const idx = points.length
    points.push(p)
    vertMap.set(`${qx},${qy}`, idx)
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

/**
 * Tight (i,j) index bounds for a lattice {u, v} covering the canvas
 * plus a padding margin: invert the lattice transform at the padded
 * canvas corners, then widen by one index on each side.
 */
function latticeBounds(
  ux: number, uy: number, vx: number, vy: number,
  width: number, height: number, pad: number
): { i0: number; i1: number; j0: number; j1: number } {
  const det = ux * vy - vx * uy
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
  return {
    i0: Math.floor(iMin) - 1,
    i1: Math.ceil(iMax) + 1,
    j0: Math.floor(jMin) - 1,
    j1: Math.ceil(jMax) + 1
  }
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

function cairoLayout(cellSize: number): TilingLayout {
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

  return {
    prototiles: rotations.map(rot => basePent.map(rot)),
    ux, uy, vx, vy,
    pad: bleed * L
  }
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

function convexLayout(cellSize: number): TilingLayout {
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

  return {
    prototiles: rotations.map(rot => basePent.map(rot)),
    ux, uy, vx, vy,
    pad: bleed * cellSize
  }
}

// ─── Irregular Non-Convex Pentagon Tiling ────────────────────────
//
// Non-convex pentagon tiling forming 12-fold star rosettes.
// 12 petals × 30° = 360° at each rosette center.
//
// Angles: B=30°, C=60°, D=120°, E=240°, A=90° (all ×30°, sum 540°).
// Edge dirs: B→C=15°, C→D=E→A=135°, D→E=195°, A→B=225°.
// E is the reflex vertex creating the indent that interlocks
// adjacent petals. Shoulders CD and EA are parallel (both 135°)
// but asymmetric: EA/CD = 1/2 exactly.
//
// This tiles the plane exactly: with AB/BC = 3√3/8 the edge lengths
// come out to CD = DE = BC/4, EA = BC/8, and each C-tip (120° of
// material) nests in a neighbor's reflex E (240°). Construction: at
// each rosette center (B vertex), place 12 pentagons alternating
// normal/mirror on the lattice u = C − rot(E, 120°), v = rot(u, 60°).

function nonconvexLayout(cellSize: number): TilingLayout {
  // 12 petals → 30° each. Half-angle = 15°.
  const halfAngle = Math.PI / 12
  const cosH = Math.cos(halfAngle)
  const sinH = Math.sin(halfAngle)
  const cos3H = Math.cos(3 * halfAngle)
  const sin3H = Math.sin(3 * halfAngle)

  // Arm lengths — exact tiling ratios; rBC scaled so the rosette
  // lattice pitch |u| = √39/4 · rBC equals cellSize
  const rBC = 4 * cellSize / Math.sqrt(39)   // B→C arm (long)
  const rAB = rBC * 3 * Math.sqrt(3) / 8     // A→B arm (short), BC/AB = 8√3/9

  // Shoulder ratio EA/CD — exactly 1/2 for the gap-free tiling
  const shoulderRatio = 0.5

  // Edge directions (exact: all angles are multiples of 30°)
  const dirShoulder = 3 * Math.PI / 4   // 135° (C→D and E→A)
  const dirIndent = 13 * Math.PI / 12   // 195° (D→E)

  const C0x = rBC * cosH, C0y = rBC * sinH    // C at 15°
  const A0x = rAB * cos3H, A0y = rAB * sin3H  // A at 45°

  const cosSh = Math.cos(dirShoulder), sinSh = Math.sin(dirShoulder)
  const cosIn = Math.cos(dirIndent), sinIn = Math.sin(dirIndent)

  // Solve shoulder sum (cdLen + eaLen) and indent length from closure
  const dx = A0x - C0x, dy = A0y - C0y
  const detM = cosSh * sinIn - cosIn * sinSh
  const shoulderSum = (dx * sinIn - dy * cosIn) / detM
  const deLen = (cosSh * dy - sinSh * dx) / detM

  const cdLen = shoulderSum / (1 + shoulderRatio)

  const D0x = C0x + cdLen * cosSh, D0y = C0y + cdLen * sinSh
  const E0x = D0x + deLen * cosIn, E0y = D0y + deLen * sinIn

  // Normal pentagon (B at origin)
  const basePent: Point[] = [
    [0, 0], [C0x, C0y], [D0x, D0y], [E0x, E0y], [A0x, A0y]
  ]

  // Mirrored pentagon: reflect across x-axis, reverse vertex order
  const mirrorPent: Point[] = [
    [0, 0], [A0x, -A0y], [E0x, -E0y], [D0x, -D0y], [C0x, -C0y]
  ]

  // Lattice of rosette centers: u = C − rot(E, 120°), v = rot(u, 60°).
  // Anchoring on E (not A) places each C-tip inside a neighbor's
  // reflex E — the vertex figure 120° + 240° = 360° that closes the
  // tiling exactly.
  const cos120 = Math.cos(2 * Math.PI / 3), sin120 = Math.sin(2 * Math.PI / 3)
  const ux = C0x - (E0x * cos120 - E0y * sin120)
  const uy = C0y - (E0x * sin120 + E0y * cos120)
  const c60 = Math.cos(Math.PI / 3), s60 = Math.sin(Math.PI / 3)
  const vx = ux * c60 - uy * s60, vy = ux * s60 + uy * c60

  // 12 petals around each rosette center, alternating normal/mirror
  const prototiles: Point[][] = []
  for (let k = 0; k < 12; k++) {
    const pent = k % 2 === 0 ? basePent : mirrorPent
    const step = Math.PI / 6  // 30°
    const angle = k * step
    const ca = Math.cos(angle), sa = Math.sin(angle)
    prototiles.push(pent.map(([px, py]) => {
      return [px * ca - py * sa, px * sa + py * ca] as Point
    }))
  }

  const latticeLen = Math.sqrt(ux * ux + uy * uy)
  return { prototiles, ux, uy, vx, vy, pad: bleed * latticeLen }
}

// ─── Dispatcher ──────────────────────────────────────────────────

// Exhaustive over TilingShape with no default: adding a tiling shape
// without handling it here is a compile error (noImplicitReturns).
function getLayout(shape: TilingShape, cellSize: number): TilingLayout {
  switch (shape) {
    case 'pentagon-cairo': return cairoLayout(cellSize)
    case 'pentagon-convex': return convexLayout(cellSize)
    case 'pentagon-nonconvex': return nonconvexLayout(cellSize)
  }
}

export function generateTiling(shape: TilingShape, width: number, height: number, cellSize: number): TilingResult {
  const { prototiles, ux, uy, vx, vy, pad } = getLayout(shape, cellSize)
  const { i0, i1, j0, j1 } = latticeBounds(ux, uy, vx, vy, width, height, pad)

  const rawPolys: Point[][] = []
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const cx = i * ux + j * vx
      const cy = i * uy + j * vy
      for (const tile of prototiles) {
        rawPolys.push(tile.map(([px, py]) => [px + cx, py + cy] as Point))
      }
    }
  }
  return deduplicateVertices(rawPolys)
}

// Raw vertex count generateTiling would allocate before vertex dedup — lets
// the allocation guard in validateOptions size a tiling without generating
// it. Reuses the exact layout and latticeBounds math above, so the count
// always matches what generateTiling would emit.
export function countTilingVertices(shape: TilingShape, width: number, height: number, cellSize: number): number {
  const { prototiles, ux, uy, vx, vy, pad } = getLayout(shape, cellSize)
  const { i0, i1, j0, j1 } = latticeBounds(ux, uy, vx, vy, width, height, pad)
  return (i1 - i0 + 1) * (j1 - j0 + 1) * prototiles.length * 5
}
