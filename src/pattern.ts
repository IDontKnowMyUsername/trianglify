import getScalingRatio from './utils/getScalingRatio'
import { isBrowser } from './utils/env'
import type { Point, CSSColor, Polygon, TrianglifyOptions, RenderOpts, PatternData, SVGTreeNode, SVGOptions, CanvasOptions } from './types'

type SVGAttrs = Record<string, string | number | undefined>

declare const require: (id: string) => { createCanvas: (w: number, h: number) => HTMLCanvasElement }

function _createCanvas (width: number, height: number): HTMLCanvasElement {
  if (isBrowser) {
    return Object.assign(document.createElement('canvas'), { width, height })
  }
  try {
    return require('canvas').createCanvas(width, height)
  } catch (e) {
    throw new Error(
      'toCanvas() requires either a browser environment or the "canvas" npm package. ' +
      'Install it with: npm install canvas',
      { cause: e }
    )
  }
}
const doc = isBrowser && document

type Serializer<T> = (tagName: string, attrs: SVGAttrs, children?: T[], existingRoot?: T | null) => T

// utility for building up SVG node trees with the DOM API
const sDOM: Serializer<SVGElement> = (tagName, attrs = {}, children?, existingRoot?) => {
  const elem = existingRoot || (doc as Document).createElementNS('http://www.w3.org/2000/svg', tagName)
  if (existingRoot) {
    // re-rendering into an existing root replaces its content rather than
    // appending a second copy of the pattern
    while (elem.firstChild) elem.removeChild(elem.firstChild)
  }
  Object.entries(attrs).forEach(
    ([k, v]) => v !== undefined && elem.setAttribute(k, String(v))
  )
  children && children.forEach(c => elem.appendChild(c))
  return elem
}

// escape XML attribute values — they can contain user-supplied strings
// like strokeColor
const escapeAttr = (v: string): string => (
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;')
)

// serialize attrs object to XML attributes
const serializeAttrs = (attrs: SVGAttrs): string => (
  Object.entries(attrs)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}='${escapeAttr(String(v))}'`)
    .join(' ')
)

// minimal XML-tree builder for use in Node
const sNode: Serializer<SVGTreeNode> = (tagName, attrs = {}, children?) => ({
  tagName,
  attrs,
  children: children || null,
  toString: () => `<${tagName} ${serializeAttrs(attrs)}>${children ? children.join('') : ''}</${tagName}>`
})

// Pattern.fromData accepts data across trust boundaries (postMessage, JSON
// from caches) — validate its shape so malformed input fails fast with a
// clear error instead of crashing mid-render
const fail = (msg: string): never => {
  throw TypeError(`invalid pattern data: ${msg}`)
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

const validatePatternData = (data: PatternData): void => {
  if (typeof data !== 'object' || data === null) fail('expected an object')
  const { points, polys, opts } = data

  if (!Array.isArray(points)) fail('points must be an array')
  for (const p of points) {
    if (!Array.isArray(p) || !isFiniteNumber(p[0]) || !isFiniteNumber(p[1])) {
      fail(`points entries must be [x, y] pairs of finite numbers, got ${JSON.stringify(p)}`)
    }
  }

  if (!Array.isArray(polys)) fail('polys must be an array')
  for (const poly of polys) {
    if (typeof poly !== 'object' || poly === null) fail(`polys entries must be objects, got ${JSON.stringify(poly)}`)
    if (!Array.isArray(poly.vertexIndices)) fail('poly.vertexIndices must be an array')
    for (const vi of poly.vertexIndices) {
      if (!Number.isInteger(vi) || vi < 0 || vi >= points.length) {
        fail(`poly.vertexIndices entry ${JSON.stringify(vi)} is not an index into points (length ${points.length})`)
      }
    }
    if (typeof poly.centroid !== 'object' || poly.centroid === null || !isFiniteNumber(poly.centroid.x) || !isFiniteNumber(poly.centroid.y)) {
      fail(`poly.centroid must be {x, y} with finite numbers, got ${JSON.stringify(poly.centroid)}`)
    }
    if (typeof poly.color !== 'string') {
      fail(`poly.color must be a CSS color string, got ${JSON.stringify(poly.color)}`)
    }
    if (poly.radius != null && (!isFiniteNumber(poly.radius) || poly.radius < 0)) {
      fail(`poly.radius must be a non-negative finite number, got ${JSON.stringify(poly.radius)}`)
    }
    if (poly.vertexIndices.length === 0 && poly.radius == null) {
      fail('a poly with no vertexIndices must have a radius (circle)')
    }
  }

  if (typeof opts !== 'object' || opts === null) fail('opts must be an object')
  if (!isFiniteNumber(opts.width) || opts.width <= 0) fail(`opts.width must be a positive finite number, got ${JSON.stringify(opts.width)}`)
  if (!isFiniteNumber(opts.height) || opts.height <= 0) fail(`opts.height must be a positive finite number, got ${JSON.stringify(opts.height)}`)
  if (typeof opts.fill !== 'boolean') fail(`opts.fill must be a boolean, got ${JSON.stringify(opts.fill)}`)
  if (!isFiniteNumber(opts.strokeWidth) || opts.strokeWidth < 0) fail(`opts.strokeWidth must be a non-negative finite number, got ${JSON.stringify(opts.strokeWidth)}`)
  if (opts.strokeColor !== null && typeof opts.strokeColor !== 'string') fail(`opts.strokeColor must be a string or null, got ${JSON.stringify(opts.strokeColor)}`)
}

/**
 * A generated Trianglify pattern: the point layout, the colored polygons
 * built on it, and the options used to generate them, together with
 * rendering methods for SVG ({@link toSVG}, {@link toSVGTree}) and canvas
 * ({@link toCanvas}), plus serialization via {@link toData} /
 * {@link Pattern.fromData}.
 */
export default class Pattern {
  /** The pseudo-random point layout the pattern geometry is built on. */
  points: Point[]
  /** The colored polygons that make up the pattern. */
  polys: Polygon[]
  /** The options the pattern was generated with (render options only for patterns restored via {@link Pattern.fromData}). */
  opts: TrianglifyOptions | RenderOpts

  constructor (points: Point[], polys: Polygon[], opts: TrianglifyOptions | RenderOpts) {
    this.points = points
    this.polys = polys
    this.opts = opts
  }

  /**
   * Serialize the pattern to a plain object that survives
   * `JSON.stringify`/`postMessage` (colors become CSS strings). Restore it
   * with {@link Pattern.fromData}. Useful for caching patterns and for
   * transferring them out of a Web Worker.
   */
  toData (): PatternData {
    const { width, height, fill, strokeWidth, strokeColor, shape } = this.opts
    return {
      points: this.points,
      polys: this.polys.map(poly => ({
        vertexIndices: poly.vertexIndices,
        centroid: poly.centroid,
        color: poly.color.css(),
        ...(poly.radius != null ? { radius: poly.radius } : {})
      })),
      opts: { width, height, fill, strokeWidth, strokeColor, shape }
    }
  }

  /**
   * Reconstruct a Pattern from serialized data (as produced by
   * {@link toData}). The returned pattern supports `toCanvas()` and
   * `toSVG()` rendering. Malformed data throws a TypeError — the data often
   * arrives from a postMessage boundary or a JSON cache, so it is validated
   * structurally rather than trusted.
   */
  static fromData (data: PatternData): Pattern {
    validatePatternData(data)
    const polys: Polygon[] = data.polys.map(poly => ({
      vertexIndices: poly.vertexIndices,
      centroid: poly.centroid,
      color: { css: () => poly.color },
      ...(poly.radius != null ? { radius: poly.radius } : {})
    }))
    return new Pattern(data.points, polys, data.opts)
  }

  private _toSVG<T> (serializer: Serializer<T>, destSVG: T | null, _svgOpts: SVGOptions = {}): T {
    const s = serializer
    const defaultSVGOptions = { includeNamespace: true, coordinateDecimals: 1 }
    const svgOpts = { ...defaultSVGOptions, ..._svgOpts }
    const { points, polys, opts } = this
    const { width, height, fill, strokeWidth, strokeColor } = opts

    // only round points if the coordinateDecimals option is non-negative
    // set coordinateDecimals to -1 to disable point rounding
    const roundedPoints = (svgOpts.coordinateDecimals < 0)
      ? points
      : (() => {
          const factor = 10 ** svgOpts.coordinateDecimals
          return points.map((p): Point => [Math.round(p[0] * factor) / factor, Math.round(p[1] * factor) / factor])
        })()

    const round = svgOpts.coordinateDecimals < 0
      ? (v: number) => v
      : (() => { const f = 10 ** svgOpts.coordinateDecimals; return (v: number) => Math.round(v * f) / f })()

    const paths = polys.map((poly) => {
      const hasStroke = strokeWidth > 0

      // Circle shapes: render as <circle> instead of <path>
      if (poly.radius != null && poly.vertexIndices.length === 0) {
        return s('circle', {
          cx: round(poly.centroid.x),
          cy: round(poly.centroid.y),
          r: round(poly.radius),
          fill: fill ? poly.color.css() : undefined,
          stroke: hasStroke ? (strokeColor || poly.color.css()) : undefined,
          'stroke-width': hasStroke ? strokeWidth : undefined
        })
      }

      // Polygon shapes (triangles, N-gons): render as <path>
      const xys = poly.vertexIndices.map(i => `${roundedPoints[i]![0]},${roundedPoints[i]![1]}`)
      const d = `M${xys.join('L')}Z`
      // shape-rendering crispEdges resolves the antialiasing issues, at the
      // potential cost of some visual degradation. For the best performance
      // *and* best visual rendering, use Canvas.
      return s('path', {
        d,
        fill: fill ? poly.color.css() : undefined,
        stroke: hasStroke ? (strokeColor || poly.color.css()) : undefined,
        'stroke-width': hasStroke ? strokeWidth : undefined,
        'stroke-linejoin': hasStroke ? 'round' : undefined,
        'shape-rendering': fill ? 'crispEdges' : undefined
      })
    })

    const svg = s(
      'svg',
      {
        xmlns: svgOpts.includeNamespace ? 'http://www.w3.org/2000/svg' : undefined,
        width,
        height
      },
      paths,
      destSVG
    )

    return svg
  }

  /**
   * Render the pattern to a lightweight SVG node tree whose `toString()`
   * produces a valid SVG string. Works in every environment; in Node this is
   * what {@link toSVG} returns.
   */
  toSVGTree (svgOpts?: SVGOptions): SVGTreeNode {
    return this._toSVG(sNode, null, svgOpts)
  }

  /**
   * Render the pattern to SVG. In browsers this returns an `SVGElement` —
   * rendered into `destSVG` when given, replacing its previous content; in
   * Node it ignores `destSVG` and returns a plain {@link SVGTreeNode}
   * (serialize it with `toString()`).
   */
  toSVG (destSVG: SVGElement, svgOpts?: SVGOptions): SVGElement
  toSVG (destSVG?: SVGElement | null, svgOpts?: SVGOptions): SVGElement | SVGTreeNode
  toSVG (destSVG?: SVGElement | null, svgOpts?: SVGOptions): SVGElement | SVGTreeNode {
    return isBrowser
      ? this._toSVG(sDOM, destSVG ?? null, svgOpts)
      : this.toSVGTree(svgOpts)
  }

  /**
   * Render the pattern to a canvas — into `destCanvas` when given, otherwise
   * into a newly created one. In browsers the canvas is scaled for high-DPI
   * displays by default (see {@link CanvasOptions}). In Node this requires
   * the optional `canvas` package and renders at exactly `width` × `height`.
   */
  toCanvas (destCanvas?: HTMLCanvasElement, _canvasOpts: CanvasOptions = {}): HTMLCanvasElement {
    const defaultCanvasOptions = {
      scaling: isBrowser ? 'auto' as const : false as const,
      applyCssScaling: !!isBrowser
    }
    const canvasOpts = { ...defaultCanvasOptions, ..._canvasOpts }
    const { points, polys, opts } = this
    const { width, height, fill, strokeWidth, strokeColor } = opts

    const canvas = destCanvas || _createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not acquire 2D rendering context from canvas')

    if (canvasOpts.scaling) {
      const drawRatio = canvasOpts.scaling === 'auto'
        ? getScalingRatio()
        : canvasOpts.scaling

      if (drawRatio !== 1) {
        // set the 'real' canvas size to the higher width/height
        canvas.width = width * drawRatio
        canvas.height = height * drawRatio

        if (canvasOpts.applyCssScaling) {
          // ...then scale it back down with CSS
          canvas.style.width = `${width}px`
          canvas.style.height = `${height}px`
        }
      } else {
        // this is a normal 1:1 device: don't apply scaling
        canvas.width = width
        canvas.height = height
        if (canvasOpts.applyCssScaling) {
          canvas.style.width = ''
          canvas.style.height = ''
        }
      }
      ctx.scale(drawRatio, drawRatio)
    } else {
      // no scaling: still normalize the canvas to the pattern's dimensions
      // so an unscaled destCanvas (the Node default) matches the browser
      // rendering behavior
      canvas.width = width
      canvas.height = height
    }

    ctx.lineJoin = 'round'

    const drawPoly = (poly: Polygon, polyFill: { color: CSSColor } | null | false, stroke: { color: CSSColor; width: number } | false) => {
      ctx.beginPath()

      if (poly.radius != null && poly.vertexIndices.length === 0) {
        // Circle shape
        ctx.arc(poly.centroid.x, poly.centroid.y, poly.radius, 0, 2 * Math.PI)
      } else {
        // Polygon shape (triangles, N-gons)
        const indices = poly.vertexIndices
        const [firstX, firstY] = points[indices[0]!]!
        ctx.moveTo(firstX, firstY)
        for (let i = 1; i < indices.length; i++) {
          const [x, y] = points[indices[i]!]!
          ctx.lineTo(x, y)
        }
      }

      ctx.closePath()
      if (polyFill) {
        ctx.fillStyle = polyFill.color.css()
        ctx.fill()
      }
      if (stroke) {
        ctx.strokeStyle = stroke.color.css()
        ctx.lineWidth = stroke.width
        ctx.stroke()
      }
    }

    if (fill && strokeWidth < 1) {
      // draw background strokes at edge bounds to solve for white gaps due to
      // canvas antialiasing. See https://stackoverflow.com/q/19319963/381299
      polys.forEach(poly => drawPoly(poly, null, { color: poly.color, width: 2 }))
    }

    // draw visible fills and strokes
    polys.forEach(poly => {
      const polyStrokeColor: CSSColor = strokeColor ? { css: () => strokeColor } : poly.color
      drawPoly(
        poly,
        fill && { color: poly.color },
        (strokeWidth > 0) && { color: polyStrokeColor, width: strokeWidth }
      )
    })

    return canvas
  }
}
