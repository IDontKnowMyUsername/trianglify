/*
 * Trianglify.js
 * by @qrohlf
 *
 * Licensed under the GPLv3
 */

import Delaunator from 'delaunator'
// TODO - evaluate smaller alternatives
// (chroma bloats bundle by 40k, minified)
import chroma from 'chroma-js'

import colorbrewer from './utils/colorbrewer'
import Pattern from './pattern'
import TrianglifyWorker from './workerClient'
import mulberry32 from './utils/mulberry32'
import poissonDisc from './utils/poissonDisc'
import bestCandidate from './utils/bestCandidate'
import spiralPoints from './utils/spiral'
import spherePoints from './utils/sphere'
import * as geom from './utils/geom'
import * as colorFunctions from './utils/colorFunctions'
import { generateRegularPolygon, getSidesForShape } from './utils/shapes'
import { generateTiling } from './utils/tilings'
import type { TrianglifyOptions, Polygon, Point, CSSColor, Shape } from './types'
export type { TrianglifyOptions, RenderOpts, ColorFunctionParams, ColorFunction, CSSColor, Polygon, PatternData, SVGTreeNode, SVGOptions, CanvasOptions, Shape } from './types'

const defaultOptions: TrianglifyOptions = {
  width: 600,
  height: 400,
  cellSize: 75,
  variance: 0.75,
  seed: null,
  xColors: 'random',
  yColors: 'match',
  palette: colorbrewer,
  colorSpace: 'lab',
  colorFunction: colorFunctions.interpolateLinear(0.5),
  fill: true,
  strokeWidth: 0,
  strokeColor: null,
  points: null,
  pointGeneration: 'grid',
  shape: 'triangle',
  spiralDirection: 'ccw',
  spiralRatio: 'golden'
}

// This function does the "core" render-independent work:
//
// 1. Parse and munge options
// 2. Setup cell geometry
// 3. Generate random points within cell geometry
// 4. Use the Delaunator library to run the triangulation
// 5. Do color interpolation to establish the fundamental coloring of the shapes
function trianglify (_opts: Partial<TrianglifyOptions> = {}): Pattern {
  Object.keys(_opts).forEach(k => {
    if (!(k in defaultOptions)) {
      throw TypeError(`Unrecognized option: ${k}`)
    }
  })
  const opts: TrianglifyOptions = { ...defaultOptions, ..._opts }

  if (!(opts.height > 0)) {
    throw TypeError(`invalid height: ${opts.height}`)
  }
  if (!(opts.width > 0)) {
    throw TypeError(`invalid width: ${opts.width}`)
  }
  if (typeof opts.cellSize !== 'number' || !isFinite(opts.cellSize) || opts.cellSize < 1) {
    throw TypeError(`invalid cellSize: ${opts.cellSize}`)
  }
  if (typeof opts.variance !== 'number' || !isFinite(opts.variance) || opts.variance < 0) {
    throw TypeError(`invalid variance: ${opts.variance}`)
  }
  const validPointGenerations = ['grid', 'poisson', 'bestCandidate', 'spiral', 'sphere']
  if (!validPointGenerations.includes(opts.pointGeneration)) {
    throw TypeError(`invalid pointGeneration: ${opts.pointGeneration}`)
  }
  const validShapes: Shape[] = ['triangle', 'pentagon', 'pentagon-cairo', 'pentagon-convex', 'pentagon-nonconvex', 'hexagon', 'heptagon', 'octagon', 'circle']
  if (!validShapes.includes(opts.shape)) {
    throw TypeError(`invalid shape: ${opts.shape}`)
  }
  const validSpiralDirections = ['cw', 'ccw']
  if (!validSpiralDirections.includes(opts.spiralDirection)) {
    throw TypeError(`invalid spiralDirection: ${opts.spiralDirection}`)
  }
  if (opts.spiralRatio !== 'golden' && (typeof opts.spiralRatio !== 'number' || !isFinite(opts.spiralRatio) || opts.spiralRatio <= 0)) {
    throw TypeError(`invalid spiralRatio: ${opts.spiralRatio}`)
  }

  // standard randomizer, used for point gen and layout
  const rand = mulberry32(opts.seed)

  const randomFromPalette = (): string[] => {
    if (Array.isArray(opts.palette)) {
      return opts.palette[Math.floor(rand() * opts.palette.length)]!
    }
    const palettes = Object.values(opts.palette)
    return palettes[Math.floor(rand() * palettes.length)]!
  }

  // The first step here is to set up our color scales for the X and Y axis.
  // First, munge the shortcut options like 'random' or 'match' into real color
  // arrays. Then, set up a Chroma scale in the appropriate color space.
  const processColorOpts = (colorOpt: string | string[] | false): string[] => {
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

  const xScale = chroma.scale(xColors).mode(opts.colorSpace)
  const yScale = chroma.scale(yColors).mode(opts.colorSpace)

  // Our next step is to generate a pseudo-random grid of {x, y} points,
  // (or to simply utilize the points that were passed to us)
  // copy user-supplied points so shape generation never mutates the caller's array
  let points: Point[] = opts.points ? opts.points.slice() : getPoints(opts, rand)

  // For hexagons with grid layout, offset alternating rows for honeycomb tiling
  if (opts.shape === 'hexagon' && opts.pointGeneration === 'grid' && !opts.points) {
    const colCount = Math.floor(opts.width / opts.cellSize) + 4
    points = points.map((p, i) => {
      const row = Math.floor(i / colCount)
      return row % 2 === 1 ? [p[0] + opts.cellSize / 2, p[1]] : p
    })
  }

  // use a different (salted) randomizer for the color function so that
  // swapping out color functions doesn't change the pattern geometry itself
  const salt = 42
  const cRand = mulberry32(opts.seed ? String(opts.seed) + salt : null)
  const polys: Polygon[] = []
  const { width, height, shape } = opts
  const norm = (num: number) => Math.max(0, Math.min(1, num))

  const colorPoly = (centroid: { x: number; y: number }, vertexIndices: number[], vertices: Point[]): CSSColor => {
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

    const cssValue = rawColor.css()
    return { css: () => cssValue }
  }

  // Pentagon tiling shapes generate complete tiling geometry and
  // bypass the normal point-generation + gap-filling pipeline
  const tilingShapes: Shape[] = ['pentagon-cairo', 'pentagon-convex', 'pentagon-nonconvex']
  if (tilingShapes.includes(shape)) {
    const tiling = generateTiling(shape, width, height, opts.cellSize)
    points = tiling.points
    for (const vertexIndices of tiling.polys) {
      const vertices = vertexIndices.map(i => points[i]!)
      const centroid = geom.getCentroid(vertices)
      const color = colorPoly(centroid, vertexIndices, vertices)
      polys.push({ vertexIndices, centroid, color })
    }
    return new Pattern(points, polys, opts)
  }

  const sides = getSidesForShape(shape)

  if (shape === 'triangle') {
    // Delaunay triangulation pipeline (original behavior)
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

      const centroid = geom.getCentroid(vertices)
      const color = colorPoly(centroid, vertexIndices, vertices)

      polys.push({ vertexIndices, centroid, color })
    }
  } else if (shape === 'circle' || sides !== null) {
    // For a regular N-gon, the apothem (center to edge midpoint) is
    // circumradius * cos(PI/N). For flat edges to meet at the midpoint
    // between grid centers: apothem = cellSize/2, giving
    // circumradius = cellSize / (2 * cos(PI/N)).
    // For circles, approximate as a high-sided polygon for gap computation
    // but render as true circles.
    const approxSides = shape === 'circle' ? 24 : sides!
    const circumradius = opts.cellSize / (2 * Math.cos(Math.PI / approxSides))
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
        // Render as a true circle; vertices are only used for gap computation
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
    const gapIndices = Delaunator.from(allVerts).triangles
    for (let i = 0; i < gapIndices.length; i += 3) {
      const a = gapIndices[i]!
      const b = gapIndices[i + 1]!
      const c = gapIndices[i + 2]!

      // Skip interior triangles (all vertices belong to the same shape)
      if (vertexOwner[a] === vertexOwner[b] && vertexOwner[b] === vertexOwner[c]) {
        continue
      }

      const vi = [vertexBase + a, vertexBase + b, vertexBase + c]
      const vertices: Point[] = [allVerts[a]!, allVerts[b]!, allVerts[c]!]
      const centroid = geom.getCentroid(vertices)
      const color = colorPoly(centroid, vi, vertices)
      polys.push({ vertexIndices: vi, centroid, color })
    }
  }

  return new Pattern(points, polys, opts)
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
      return getGridPoints(width, height, cellSize, variance, random)
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
  const colCount = Math.floor(width / cellSize) + 4
  const rowCount = Math.floor(height / cellSize) + 4

  // determine bleed values to ensure that the grid is centered within the
  // artboard
  const bleedX = ((colCount * cellSize) - width) / 2
  const bleedY = ((rowCount * cellSize) - height) / 2

  // apply variance to cellSize to get cellJitter in pixels
  const cellJitter = cellSize * variance
  const getJitter = () => (random() - 0.5) * cellJitter

  const pointCount = colCount * rowCount

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

export default Object.assign(trianglify, {
  utils: {
    mix: chroma.mix,
    colorbrewer
  },
  colorFunctions,
  Pattern,
  TrianglifyWorker,
  defaultOptions
})
