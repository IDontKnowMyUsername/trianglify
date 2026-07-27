/**
 * @jest-environment node
 */
export {}

// Seeded fuzz harness: random-but-reproducible option combinations, each
// checked against the structural invariants every pattern must satisfy.
// Catches crashes and geometry corruption across the option space that
// example-based tests miss. Failures reproduce exactly — the case index
// seeds the generator.
const trianglify = require('../dist/trianglify.cjs')
const { Pattern } = trianglify

// local mulberry32 so fuzz-case selection is reproducible and independent
// of the library's own RNG
const mulberry = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const SHAPES = ['triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'circle', 'pentagon-cairo', 'pentagon-convex', 'pentagon-nonconvex'] as const
const POINT_GENS = ['grid', 'poisson', 'bestCandidate', 'spiral', 'sphere'] as const
const COLOR_SPACES = ['rgb', 'hsv', 'hsl', 'hsi', 'lab', 'hcl', 'oklab', 'oklch'] as const
const COLOR_FNS = [null, 'interpolateLinear', 'sparkle', 'shadows', 'radial', 'angular'] as const

const pick = <T,>(rand: () => number, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!

const CASES = 40

describe('seeded option fuzzing', () => {
  for (let i = 0; i < CASES; i++) {
    const rand = mulberry(0xC0FFEE + i)
    const shape = pick(rand, SHAPES)
    const opts: Record<string, unknown> = {
      seed: `fuzz-${i}`,
      width: 60 + Math.floor(rand() * 240),
      height: 60 + Math.floor(rand() * 240),
      cellSize: 25 + Math.floor(rand() * 55),
      variance: Math.round(rand() * 150) / 100,
      shape,
      colorSpace: pick(rand, COLOR_SPACES),
      fill: rand() > 0.2,
      strokeWidth: rand() > 0.5 ? Math.round(rand() * 300) / 100 : 0
    }
    let pointGeneration: string | null = null
    if (!shape.startsWith('pentagon-')) {
      pointGeneration = pick(rand, POINT_GENS)
      opts.pointGeneration = pointGeneration
    }
    const colorFn = pick(rand, COLOR_FNS)
    if (colorFn) {
      opts.colorFunction = trianglify.colorFunctions[colorFn]()
    }

    test(`fuzz #${i}: shape=${shape} gen=${pointGeneration ?? 'tiling'} cf=${colorFn ?? 'default'}`, () => {
      const pattern = trianglify(opts)

      expect(pattern.polys.length).toBeGreaterThan(0)
      for (const [x, y] of pattern.points) {
        expect(Number.isFinite(x)).toBe(true)
        expect(Number.isFinite(y)).toBe(true)
      }
      for (const poly of pattern.polys) {
        for (const vi of poly.vertexIndices) {
          expect(Number.isInteger(vi)).toBe(true)
          expect(vi).toBeGreaterThanOrEqual(0)
          expect(vi).toBeLessThan(pattern.points.length)
        }
        expect(Number.isFinite(poly.centroid.x)).toBe(true)
        expect(Number.isFinite(poly.centroid.y)).toBe(true)
        expect(typeof poly.color.css()).toBe('string')
        if (poly.vertexIndices.length === 0) {
          expect(poly.radius).toBeGreaterThan(0)
        }
      }

      const svg = pattern.toSVGTree().toString()
      expect(svg.startsWith('<svg')).toBe(true)

      // toData → JSON → fromData must reproduce the rendering byte-for-byte
      const restored = Pattern.fromData(JSON.parse(JSON.stringify(pattern.toData())))
      expect(restored.toSVGTree().toString()).toBe(svg)
    })
  }
})
