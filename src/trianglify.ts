/*
 * Trianglify.js
 * by @qrohlf
 *
 * Licensed under the GPLv3
 */

import Delaunator from 'delaunator'

import colorbrewer from './utils/colorbrewer'
import Pattern from './pattern'
import TrianglifyWorker from './workerClient'
import mulberry32 from './utils/mulberry32'
import poissonDisc from './utils/poissonDisc'
import bestCandidate from './utils/bestCandidate'
import spiralPoints from './utils/spiral'
import spherePoints from './utils/sphere'
import { getCentroid, getGridDensity, getHexGridDensity } from './utils/geom'
import * as colorFunctions from './utils/colorFunctions'
import { generateRegularPolygon, getSidesForShape, validShapes } from './utils/shapes'
import { generateTiling, countTilingVertices } from './utils/tilings'
import { createWorkerHandler } from './workerHost'
import { makeScale, mix, serializeColor, validColorOutputs } from './utils/colorBackend'
import type { RegularPolygonShape } from './utils/shapes'
import type { TrianglifyOptions, Polygon, Point, CSSColor, Centroid, Shape, TilingShape, WorkerResponse, PatternColor } from './types'
export type { TrianglifyOptions, RenderOpts, ColorFunctionParams, ColorFunction, ColorFunctionDescriptor, CSSColor, PatternColor, ColorSpace, ColorOutput, Polygon, PatternData, SVGTreeNode, SVGOptions, CanvasOptions, Shape, TilingShape, Point, Centroid, WorkerRequest, WorkerResponse } from './types'

/** The frozen defaults for every option — see {@link TrianglifyOptions} for what each one does. */
const defaultOptions: TrianglifyOptions = Object.freeze({
  width: 600,
  height: 400,
  cellSize: 75,
  variance: 0.75,
  seed: null,
  xColors: 'random',
  yColors: 'match',
  palette: colorbrewer,
  colorSpace: 'lab',
  colorOutput: 'rgb',
  colorQuantization: 'auto',
  colorFunction: colorFunctions.interpolateLinear(0.5),
  fill: true,
  strokeWidth: 0,
  strokeColor: null,
  points: null,
  pointGeneration: 'grid',
  shape: 'triangle',
  spiralDirection: 'ccw',
  spiralRatio: 'golden'
})

// Pentagon tiling shapes generate their complete geometry directly and
// bypass the point-generation pipeline entirely
const tilingShapes: readonly TilingShape[] = ['pentagon-cairo', 'pentagon-convex', 'pentagon-nonconvex']

const isTilingShape = (shape: Shape): shape is TilingShape =>
  (tilingShapes as readonly Shape[]).includes(shape)

// The validators below are Record<union, true> maps rather than arrays:
// the type forces compile-time completeness, so adding a member to a union
// type without updating its validator is a type error here (validShapes
// lives in utils/shapes.ts, shared with Pattern.fromData)
const validColorSpaces: Record<TrianglifyOptions['colorSpace'], true> = { rgb: true, hsv: true, hsl: true, hsi: true, lab: true, hcl: true, oklab: true, oklch: true }

// quantized scale caches are dense arrays of steps + 1 entries; the cap
// keeps a typo'd step count from allocating an absurd cache
const MAX_QUANTIZATION_STEPS = 2 ** 20

const validPointGenerations: Record<TrianglifyOptions['pointGeneration'], true> = { grid: true, poisson: true, bestCandidate: true, spiral: true, sphere: true }

const validSpiralDirections: Record<TrianglifyOptions['spiralDirection'], true> = { cw: true, ccw: true }

// circles are approximated as high-sided polygons for gap computation but
// rendered as true circles (see buildShapePolys)
const CIRCLE_APPROX_SIDES = 24

// guard against runaway allocations: a huge artboard with a tiny cellSize
// would allocate point grids, shape vertices, or tiling geometry far beyond
// anything renderable
const MAX_POINTS = 1_000_000

// Number of points generation would allocate at these options — counted per
// shape, because shapes emit far more than their grid centers: N-gons append
// `sides` vertices per center, circles append 24 gap-computation vertices
// per center, hexagon grids pack rows at honeycomb spacing, and tilings
// allocate raw pentagon vertices before dedup. Guarding on the center count
// alone would pass configurations that then crash or hang in generation.
const estimatePointCount = (opts: TrianglifyOptions): number => {
  const { width, height, cellSize, shape } = opts
  if (isTilingShape(shape)) {
    return countTilingVertices(shape, width, height, cellSize)
  }
  const { pointCount } = shape === 'hexagon' && opts.pointGeneration === 'grid'
    ? getHexGridDensity(width, height, cellSize)
    : getGridDensity(width, height, cellSize)
  if (shape === 'triangle') {
    return pointCount
  }
  const sides = shape === 'circle' ? CIRCLE_APPROX_SIDES : getSidesForShape(shape)
  return pointCount * (1 + sides)
}

const validateOptions = (_opts: Partial<TrianglifyOptions>): TrianglifyOptions => {
  Object.keys(_opts).forEach(k => {
    if (!Object.hasOwn(defaultOptions, k)) {
      throw TypeError(`Unrecognized option: ${k}`)
    }
  })
  const opts: TrianglifyOptions = { ...defaultOptions, ..._opts }

  if (typeof opts.height !== 'number' || !isFinite(opts.height) || opts.height <= 0) {
    throw TypeError(`invalid height: ${opts.height}`)
  }
  if (typeof opts.width !== 'number' || !isFinite(opts.width) || opts.width <= 0) {
    throw TypeError(`invalid width: ${opts.width}`)
  }
  if (typeof opts.cellSize !== 'number' || !isFinite(opts.cellSize) || opts.cellSize < 1) {
    throw TypeError(`invalid cellSize: ${opts.cellSize}`)
  }
  if (typeof opts.variance !== 'number' || !isFinite(opts.variance) || opts.variance < 0) {
    throw TypeError(`invalid variance: ${opts.variance}`)
  }
  if (opts.seed !== null && typeof opts.seed !== 'string' && typeof opts.seed !== 'number') {
    throw TypeError(`invalid seed: ${String(opts.seed)}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the types say palette is never null, but validateOptions defends against untyped callers
  if (typeof opts.palette !== 'object' || opts.palette === null) {
    throw TypeError('invalid palette: expected a name→colors map or an array of color arrays')
  }
  const paletteEntries = Array.isArray(opts.palette) ? opts.palette : Object.values(opts.palette)
  if (paletteEntries.length === 0) {
    throw TypeError('invalid palette: expected at least one color array')
  }
  for (const colors of paletteEntries) {
    if (!Array.isArray(colors) || colors.length === 0) {
      throw TypeError(`invalid palette entry: ${JSON.stringify(colors)} (expected a non-empty array of CSS color strings)`)
    }
    for (const color of colors) {
      if (typeof color !== 'string') {
        throw TypeError(`invalid palette color: ${JSON.stringify(color)} (expected a CSS color string)`)
      }
    }
  }
  // string values ('random', 'match', palette names) are resolved against
  // the palette later, in processColorOpts
  const validateColors = (value: string | string[], name: string): void => {
    if (typeof value === 'string') return
    if (!Array.isArray(value) || value.length === 0) {
      throw TypeError(`invalid ${name}: expected a non-empty color array, a palette name, or 'random'`)
    }
    for (const color of value) {
      if (typeof color !== 'string') {
        throw TypeError(`invalid ${name} entry: ${JSON.stringify(color)} (expected a CSS color string)`)
      }
    }
  }
  validateColors(opts.xColors, 'xColors')
  validateColors(opts.yColors, 'yColors')
  if (!Object.hasOwn(validColorSpaces, opts.colorSpace)) {
    throw TypeError(`invalid colorSpace: ${opts.colorSpace}`)
  }
  if (!Object.hasOwn(validColorOutputs, opts.colorOutput)) {
    throw TypeError(`invalid colorOutput: ${opts.colorOutput} (expected 'rgb', 'oklch', or 'display-p3')`)
  }
  if (opts.colorQuantization !== 'auto' && opts.colorQuantization !== false &&
      (typeof opts.colorQuantization !== 'number' || !Number.isInteger(opts.colorQuantization) || opts.colorQuantization < 2 || opts.colorQuantization > MAX_QUANTIZATION_STEPS)) {
    throw TypeError(`invalid colorQuantization: ${String(opts.colorQuantization)} (expected 'auto', false, or an integer between 2 and ${MAX_QUANTIZATION_STEPS})`)
  }
  if (typeof opts.colorFunction !== 'function') {
    throw TypeError(`invalid colorFunction: expected a function, got ${typeof opts.colorFunction}`)
  }
  if (typeof opts.fill !== 'boolean') {
    throw TypeError(`invalid fill: ${String(opts.fill)}`)
  }
  if (typeof opts.strokeWidth !== 'number' || !isFinite(opts.strokeWidth) || opts.strokeWidth < 0) {
    throw TypeError(`invalid strokeWidth: ${opts.strokeWidth}`)
  }
  if (opts.strokeColor !== null && typeof opts.strokeColor !== 'string') {
    throw TypeError(`invalid strokeColor: ${String(opts.strokeColor)}`)
  }
  if (!Object.hasOwn(validPointGenerations, opts.pointGeneration)) {
    throw TypeError(`invalid pointGeneration: ${opts.pointGeneration}`)
  }
  if (!Object.hasOwn(validShapes, opts.shape)) {
    throw TypeError(`invalid shape: ${opts.shape}`)
  }
  if (!Object.hasOwn(validSpiralDirections, opts.spiralDirection)) {
    throw TypeError(`invalid spiralDirection: ${opts.spiralDirection}`)
  }
  if (opts.spiralRatio !== 'golden' && (typeof opts.spiralRatio !== 'number' || !isFinite(opts.spiralRatio) || opts.spiralRatio <= 0)) {
    throw TypeError(`invalid spiralRatio: ${opts.spiralRatio}`)
  }
  if (opts.points !== null) {
    if (!Array.isArray(opts.points)) {
      throw TypeError('invalid points: expected an array of [x, y] pairs')
    }
    for (const p of opts.points) {
      if (!Array.isArray(p) || typeof p[0] !== 'number' || !isFinite(p[0]) || typeof p[1] !== 'number' || !isFinite(p[1])) {
        throw TypeError(`invalid points entry: ${JSON.stringify(p)} (expected [x, y] with finite coordinates)`)
      }
    }
    // tiling shapes generate their own geometry — reject custom points
    // instead of silently ignoring them
    if (isTilingShape(opts.shape)) {
      throw TypeError(`custom points are not supported for tiling shape: ${opts.shape}`)
    }
  }
  // allocation guard, checked after shape/pointGeneration validation because
  // the estimate depends on them; custom points bypass it deliberately (the
  // caller already owns that allocation)
  if (opts.points == null && estimatePointCount(opts) > MAX_POINTS) {
    throw TypeError(`invalid cellSize: ${opts.cellSize} would allocate more than ${MAX_POINTS.toLocaleString('en-US')} points at ${opts.width}x${opts.height} with shape: ${opts.shape} — increase cellSize`)
  }
  return opts
}

type ColorPolyFn = (centroid: Centroid, vertexIndices: number[], vertices: Point[]) => CSSColor

// Tiling pipeline: geometry comes fully formed from generateTiling
const buildTilingPolys = (points: Point[], polyIndices: number[][], colorPoly: ColorPolyFn): Polygon[] => {
  const polys: Polygon[] = []
  for (const vertexIndices of polyIndices) {
    const vertices = vertexIndices.map(i => points[i]!)
    const centroid = getCentroid(vertices)
    polys.push({ vertexIndices, centroid, color: colorPoly(centroid, vertexIndices, vertices) })
  }
  return polys
}

// Delaunay triangulation pipeline (original trianglify behavior)
const buildTrianglePolys = (points: Point[], colorPoly: ColorPolyFn): Polygon[] => {
  const polys: Polygon[] = []
  const geomIndices = Delaunator.from(points).triangles

  for (let i = 0; i < geomIndices.length; i += 3) {
    const vertexIndices = [
      geomIndices[i]!,
      geomIndices[i + 1]!,
      geomIndices[i + 2]!
    ]

    const vertices: [Point, Point, Point] = [
      points[vertexIndices[0]!]!,
      points[vertexIndices[1]!]!,
      points[vertexIndices[2]!]!
    ]

    const centroid = getCentroid(vertices)
    const color = colorPoly(centroid, vertexIndices, vertices)

    polys.push({ vertexIndices, centroid, color })
  }
  return polys
}

// Regular N-gon / circle pipeline: primary shapes plus Delaunay gap fill.
// Appends the generated shape vertices to `points` in place — the same
// array the returned pattern and the color functions see.
const buildShapePolys = (points: Point[], shape: RegularPolygonShape | 'circle', cellSize: number, colorPoly: ColorPolyFn): Polygon[] => {
  // For a regular N-gon, the apothem (center to edge midpoint) is
  // circumradius * cos(PI/N). For flat edges to meet at the midpoint
  // between grid centers: apothem = cellSize/2, giving
  // circumradius = cellSize / (2 * cos(PI/N)).
  // For circles, approximate as a high-sided polygon for gap computation
  // but render as true circles.
  const approxSides = shape === 'circle' ? CIRCLE_APPROX_SIDES : getSidesForShape(shape)
  const polys: Polygon[] = []
  const circumradius = cellSize / (2 * Math.cos(Math.PI / approxSides))
  const centerCount = points.length

  // Phase 1: Generate all polygon vertices and track which center owns each
  const allVerts: Point[] = []
  const vertexOwner: number[] = []

  for (let i = 0; i < centerCount; i++) {
    const center = points[i]!
    const verts = generateRegularPolygon(center, approxSides, circumradius)
    for (let v = 0; v < verts.length; v++) {
      vertexOwner.push(i)
      allVerts.push(verts[v]!)
    }
  }

  // Append all polygon vertices to the shared points array
  const vertexBase = points.length
  for (let v = 0; v < allVerts.length; v++) {
    points.push(allVerts[v]!)
  }

  // Phase 2: Create primary shape polys
  for (let i = 0; i < centerCount; i++) {
    const center = points[i]!
    const start = i * approxSides
    const centroid = { x: center[0], y: center[1] }

    if (shape === 'circle') {
      // Render as a true circle; vertices are only used for gap computation.
      // Note: the color function receives empty vertexIndices/vertices here
      const color = colorPoly(centroid, [], [])
      polys.push({ vertexIndices: [], centroid, color, radius: circumradius })
    } else {
      const vertexIndices = Array.from({ length: approxSides }, (_, v) => vertexBase + start + v)
      const verts = allVerts.slice(start, start + approxSides)
      const color = colorPoly(centroid, vertexIndices, verts)
      polys.push({ vertexIndices, centroid, color, radius: circumradius })
    }
  }

  // Phase 3: Delaunay-triangulate all polygon vertices to find gap-filling
  // triangles. Interior triangles (all 3 vertices from the same shape) are
  // skipped; the remaining triangles fill the gaps between primary shapes.
  //
  // Ownership is tested by vertex *position*, not index: when shapes tile
  // exactly (e.g. the hexagon honeycomb at variance 0), adjacent shapes
  // carry coincident copies of shared corners and Delaunator references
  // just one copy — index ownership alone would misclassify shape
  // interiors as gaps. A triangle whose three corner positions share any
  // owner lies inside that (convex) shape, so skipping it is always safe.
  // Each vertex's owner list is resolved once here rather than per triangle
  // corner (a vertex is a corner of ~6 Delaunay triangles). Storing the
  // shared array reference is what makes the single pass sound: owners
  // appended by later vertices at the same position mutate the same array.
  const posKey = (p: Point): string => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`
  const posOwners = new Map<string, number[]>()
  const ownersByVertex: number[][] = new Array<number[]>(allVerts.length)
  for (let v = 0; v < allVerts.length; v++) {
    const key = posKey(allVerts[v]!)
    let owners = posOwners.get(key)
    if (owners) {
      owners.push(vertexOwner[v]!)
    } else {
      owners = [vertexOwner[v]!]
      posOwners.set(key, owners)
    }
    ownersByVertex[v] = owners
  }
  const shareOwner = (a: number, b: number, c: number): boolean => {
    const ownersA = ownersByVertex[a]!
    const ownersB = ownersByVertex[b]!
    const ownersC = ownersByVertex[c]!
    return ownersA.some(o => ownersB.includes(o) && ownersC.includes(o))
  }

  const gapIndices = Delaunator.from(allVerts).triangles
  for (let i = 0; i < gapIndices.length; i += 3) {
    const a = gapIndices[i]!
    const b = gapIndices[i + 1]!
    const c = gapIndices[i + 2]!

    if (shareOwner(a, b, c)) {
      continue
    }

    const vi = [vertexBase + a, vertexBase + b, vertexBase + c]
    const vertices: Point[] = [allVerts[a]!, allVerts[b]!, allVerts[c]!]
    const centroid = getCentroid(vertices)
    const color = colorPoly(centroid, vi, vertices)
    polys.push({ vertexIndices: vi, centroid, color })
  }
  return polys
}

/**
 * Generate a Trianglify pattern.
 *
 * Does the render-independent work: validates options, generates the
 * pseudo-random point layout, builds the shape geometry (Delaunay
 * triangulation, regular polygons, or pentagonal tilings), and colors each
 * polygon. The returned {@link Pattern} renders via `toSVG()`,
 * `toSVGTree()`, or `toCanvas()`.
 *
 * @param _opts - options overriding {@link defaultOptions}; unrecognized or
 *   malformed options throw a TypeError
 */
function trianglify (_opts: Partial<TrianglifyOptions> = {}): Pattern {
  const opts = validateOptions(_opts)

  // standard randomizer, used for point gen and layout
  const rand = mulberry32(opts.seed)

  // palette selection gets its own salted randomizer so that color options
  // never consume draws from the geometry stream — xColors: 'random' must
  // not change the point layout for a given seed
  const paletteRand = mulberry32(opts.seed != null ? String(opts.seed) + 'palette' : null)

  const randomFromPalette = (): string[] => {
    if (Array.isArray(opts.palette)) {
      return opts.palette[Math.floor(paletteRand() * opts.palette.length)]!
    }
    const palettes = Object.values(opts.palette)
    return palettes[Math.floor(paletteRand() * palettes.length)]!
  }

  // The first step here is to set up our color scales for the X and Y axis.
  // First, munge the shortcut options like 'random' or 'match' into real color
  // arrays. Then, set up a Chroma scale in the appropriate color space.
  const processColorOpts = (colorOpt: string | string[]): string[] => {
    if (Array.isArray(colorOpt)) {
      return colorOpt
    }
    if (colorOpt === 'random') {
      return randomFromPalette()
    }
    if (!Array.isArray(opts.palette) && typeof colorOpt === 'string' && opts.palette[colorOpt]) {
      return opts.palette[colorOpt]
    }
    throw TypeError(`Unrecognized color option: ${colorOpt}`)
  }

  const xColors = processColorOpts(opts.xColors)
  const yColors = opts.yColors === 'match'
    ? xColors
    : processColorOpts(opts.yColors)

  // Quantized scales snap t to a grid of `steps` and cache the result —
  // the cache stays effective at any step count because it is per axis,
  // and the color function is still invoked per polygon, so seeded RNG
  // draw sequences are unaffected. 'auto' keys the step count to the
  // output format's precision (see docs/color-pipeline-plan.md).
  const quantSteps = opts.colorQuantization === 'auto'
    ? (opts.colorOutput === 'rgb' ? 256 : 1024)
    : opts.colorQuantization
  const memoizeScale = (scale: (t: number) => PatternColor, steps: number): ((t: number) => PatternColor) => {
    const cache = new Array<PatternColor | undefined>(steps + 1)
    return (t: number) => {
      const clamped = t < 0 ? 0 : t > 1 ? 1 : t
      const idx = Math.round(clamped * steps)
      return (cache[idx] ??= scale(idx / steps))
    }
  }
  const applyQuantization = (scale: (t: number) => PatternColor): ((t: number) => PatternColor) =>
    quantSteps === false ? scale : memoizeScale(scale, quantSteps)

  const xScale = applyQuantization(makeScale(xColors, opts.colorSpace))
  const yScale = applyQuantization(makeScale(yColors, opts.colorSpace))

  // Our next step is to generate a pseudo-random grid of {x, y} points,
  // (or to simply utilize the points that were passed to us)
  // copy user-supplied points so shape generation never mutates the caller's array
  let points: Point[] = isTilingShape(opts.shape)
    ? []
    : opts.points ? opts.points.slice() : getPoints(opts, rand)

  // use a different (salted) randomizer for the color function so that
  // swapping out color functions doesn't change the pattern geometry itself
  const salt = 42
  const cRand = mulberry32(opts.seed != null ? String(opts.seed) + String(salt) : null)
  const { width, height, shape } = opts
  const norm = (num: number) => Math.max(0, Math.min(1, num))

  const colorPoly: ColorPolyFn = (centroid, vertexIndices, vertices) => {
    const xPercent = norm(centroid.x / width)
    const yPercent = norm(centroid.y / height)

    const rawColor = opts.colorFunction({
      centroid,
      xPercent,
      yPercent,
      vertexIndices,
      vertices,
      xScale,
      yScale,
      points,
      opts,
      random: cRand
    })

    // a string return is a finished CSS color and passes through untouched
    const cssValue = typeof rawColor === 'string' ? rawColor : serializeColor(rawColor, opts.colorOutput)
    return { css: () => cssValue }
  }

  if (isTilingShape(shape)) {
    const tiling = generateTiling(shape, width, height, opts.cellSize)
    points = tiling.points
    return new Pattern(points, buildTilingPolys(points, tiling.polys, colorPoly), opts)
  }

  if (shape === 'triangle') {
    return new Pattern(points, buildTrianglePolys(points, colorPoly), opts)
  }

  return new Pattern(points, buildShapePolys(points, shape, opts.cellSize, colorPoly), opts)
}

const getPoints = (opts: TrianglifyOptions, random: () => number): Point[] => {
  const { width, height, cellSize, variance, pointGeneration } = opts

  switch (pointGeneration) {
    case 'poisson':
      return poissonDisc(width, height, cellSize, variance, random)
    case 'bestCandidate':
      return bestCandidate(width, height, cellSize, variance, random)
    case 'spiral':
      return spiralPoints(width, height, cellSize, variance, random, opts.spiralDirection, opts.spiralRatio)
    case 'sphere':
      return spherePoints(width, height, cellSize, variance, random)
    case 'grid':
    default:
      // hexagons need honeycomb row spacing, not the square grid
      return opts.shape === 'hexagon'
        ? getHexGridPoints(width, height, cellSize, variance, random)
        : getGridPoints(width, height, cellSize, variance, random)
  }
}

const getGridPoints = (
  width: number,
  height: number,
  cellSize: number,
  variance: number,
  random: () => number
): Point[] => {
  // pad by 2 cells outside the visible area on each side to ensure we fully
  // cover the 'artboard'
  const { colCount, rowCount, pointCount } = getGridDensity(width, height, cellSize)

  // determine bleed values to ensure that the grid is centered within the
  // artboard
  const bleedX = ((colCount * cellSize) - width) / 2
  const bleedY = ((rowCount * cellSize) - height) / 2

  // apply variance to cellSize to get cellJitter in pixels
  const cellJitter = cellSize * variance
  const getJitter = () => (random() - 0.5) * cellJitter

  const halfCell = cellSize / 2

  const points: Point[] = Array.from({ length: pointCount }, (_, i) => {
    const col = i % colCount
    const row = Math.floor(i / colCount)

    return [
      -bleedX + col * cellSize + halfCell + getJitter(),
      -bleedY + row * cellSize + halfCell + getJitter()
    ]
  })

  return points
}

// Honeycomb lattice for hexagon grids. generateRegularPolygon places a
// vertex at the top (pointy-top), so hexagons are cellSize wide across the
// flats with circumradius R = cellSize/√3. A gap-free honeycomb then needs
// columns cellSize apart, rows 1.5·R = (√3/2)·cellSize apart, and odd rows
// shifted right by cellSize/2.
const getHexGridPoints = (
  width: number,
  height: number,
  cellSize: number,
  variance: number,
  random: () => number
): Point[] => {
  const { colCount, rowCount, rowSpacing } = getHexGridDensity(width, height, cellSize)

  const bleedX = ((colCount * cellSize) - width) / 2
  const bleedY = ((rowCount * rowSpacing) - height) / 2

  const cellJitter = cellSize * variance
  const getJitter = () => (random() - 0.5) * cellJitter

  const halfCell = cellSize / 2

  return Array.from({ length: colCount * rowCount }, (_, i): Point => {
    const col = i % colCount
    const row = Math.floor(i / colCount)
    const rowOffset = row % 2 === 1 ? halfCell : 0

    return [
      -bleedX + col * cellSize + halfCell + rowOffset + getJitter(),
      -bleedY + row * rowSpacing + rowSpacing / 2 + getJitter()
    ]
  })
}

export default Object.assign(trianglify, {
  utils: {
    /**
     * Mix two colors (CSS strings or {@link PatternColor} objects) in the
     * given interpolation space. Returns a {@link PatternColor} — serialize
     * it with {@link css}.
     */
    mix,
    /** Serialize a color to a CSS string in the given {@link ColorOutput} format (default `'rgb'`). */
    css: serializeColor,
    colorbrewer
  },
  colorFunctions,
  Pattern,
  TrianglifyWorker,
  /**
   * Build a worker-side message handler implementing the
   * {@link TrianglifyWorker} protocol — for hand-rolled worker scripts
   * (e.g. bundlers that compile workers from your own source files):
   * `self.onmessage = e => handler(e.data)` with
   * `const handler = trianglify.createWorkerHandler(r => self.postMessage(r))`.
   */
  createWorkerHandler: (post: (response: WorkerResponse) => void) => createWorkerHandler(trianglify, post),
  defaultOptions
})
