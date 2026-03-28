import getScalingRatio from './utils/getScalingRatio'
import type { Point, TrianglifyOptions, PatternData, SVGTreeNode, SVGOptions, CanvasOptions } from './types'

const isBrowser = (typeof window !== 'undefined' && typeof document !== 'undefined')

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
  Object.keys(attrs).forEach(
    k => attrs[k] !== undefined && elem.setAttribute(k, String(attrs[k]))
  )
  children && children.forEach(c => elem.appendChild(c))
  return elem
}

// serialize attrs object to XML attributes. Assumes everything is already
// escaped (safe input).
const serializeAttrs = (attrs: SVGAttrs): string => (
  Object.entries(attrs)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}='${v}'`)
    .join(' ')
)

// minimal XML-tree builder for use in Node
const sNode: Serializer<SVGTreeNode> = (tagName, attrs = {}, children?) => ({
  tagName,
  attrs,
  children: children || null,
  toString: () => `<${tagName} ${serializeAttrs(attrs)}>${children ? children.join('') : ''}</${tagName}>`
})

// Color-like object with a css() method (used for both chroma Color and fromData reconstructed polys)
interface CSSColor {
  css: () => string
}

interface RenderPolygon {
  vertexIndices: number[]
  centroid: { x: number; y: number }
  color: CSSColor
}

export default class Pattern {
  points: Point[]
  polys: RenderPolygon[]
  opts: TrianglifyOptions | Record<string, unknown>

  constructor (points: Point[], polys: RenderPolygon[], opts: TrianglifyOptions | Record<string, unknown>) {
    this.points = points
    this.polys = polys
    this.opts = opts
  }

  // Serialize the pattern to a plain object suitable for postMessage/JSON.
  // Chroma color objects are converted to CSS strings.
  toData = (): PatternData => {
    const { colorFunction: _cf, palette: _p, points: _points, ...serializableOpts } = this.opts as TrianglifyOptions
    return {
      points: this.points,
      polys: this.polys.map(poly => ({
        vertexIndices: poly.vertexIndices,
        centroid: poly.centroid,
        color: poly.color.css()
      })),
      opts: serializableOpts
    }
  }

  // Reconstruct a Pattern from serialized data (as produced by toData).
  // The returned pattern supports toCanvas() and toSVG() rendering.
  static fromData (data: PatternData): Pattern {
    const polys: RenderPolygon[] = data.polys.map(poly => ({
      vertexIndices: poly.vertexIndices,
      centroid: poly.centroid,
      color: { css: () => poly.color }
    }))
    return new Pattern(data.points, polys, data.opts)
  }

  _toSVG = <T>(serializer: Serializer<T>, destSVG: T | null, _svgOpts: SVGOptions = {}): T => {
    const s = serializer
    const defaultSVGOptions = { includeNamespace: true, coordinateDecimals: 1 }
    const svgOpts = { ...defaultSVGOptions, ..._svgOpts }
    const { points, opts, polys } = this
    const { width, height } = opts as TrianglifyOptions

    // only round points if the coordinateDecimals option is non-negative
    // set coordinateDecimals to -1 to disable point rounding
    const roundedPoints = (svgOpts.coordinateDecimals < 0)
      ? points
      : points.map(p => p.map(x => +x.toFixed(svgOpts.coordinateDecimals)))

    const paths = polys.map((poly) => {
      const xys = poly.vertexIndices.map(i => `${roundedPoints[i][0]},${roundedPoints[i][1]}`)
      const d = `M${xys.join('L')}Z`
      const hasStroke = (opts as TrianglifyOptions).strokeWidth > 0
      // shape-rendering crispEdges resolves the antialiasing issues, at the
      // potential cost of some visual degradation. For the best performance
      // *and* best visual rendering, use Canvas.
      return s('path', {
        d,
        fill: (opts as TrianglifyOptions).fill ? poly.color.css() : undefined,
        stroke: hasStroke ? ((opts as TrianglifyOptions).strokeColor || poly.color.css()) : undefined,
        'stroke-width': hasStroke ? (opts as TrianglifyOptions).strokeWidth : undefined,
        'stroke-linejoin': hasStroke ? 'round' : undefined,
        'shape-rendering': (opts as TrianglifyOptions).fill ? 'crispEdges' : undefined
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

  toSVGTree = (svgOpts?: SVGOptions): SVGTreeNode => this._toSVG(sNode, null, svgOpts)

  toSVG: ((destSVG?: SVGElement | null, svgOpts?: SVGOptions) => SVGElement) |
    ((destSVG?: unknown, svgOpts?: SVGOptions) => SVGTreeNode) = isBrowser
      ? (destSVG?: SVGElement | null, svgOpts?: SVGOptions) => this._toSVG(sDOM, destSVG ?? null, svgOpts)
      : (_destSVG?: unknown, svgOpts?: SVGOptions) => this.toSVGTree(svgOpts)

  toCanvas = (destCanvas?: HTMLCanvasElement, _canvasOpts: CanvasOptions = {}): HTMLCanvasElement => {
    const defaultCanvasOptions = {
      scaling: isBrowser ? 'auto' as const : false as const,
      applyCssScaling: !!isBrowser
    }
    const canvasOpts = { ...defaultCanvasOptions, ..._canvasOpts }
    const { points, polys, opts } = this
    const { width, height } = opts as TrianglifyOptions

    const canvas = destCanvas || _createCanvas(width, height)
    const ctx = canvas.getContext('2d')!

    if (canvasOpts.scaling) {
      const drawRatio = canvasOpts.scaling === 'auto'
        ? getScalingRatio()
        : canvasOpts.scaling as number

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
    }

    const drawPoly = (poly: RenderPolygon, fill: { color: CSSColor } | null | false, stroke: { color: CSSColor; width: number } | false) => {
      const vertexIndices = poly.vertexIndices
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(points[vertexIndices[0]][0], points[vertexIndices[0]][1])
      ctx.lineTo(points[vertexIndices[1]][0], points[vertexIndices[1]][1])
      ctx.lineTo(points[vertexIndices[2]][0], points[vertexIndices[2]][1])
      ctx.closePath()
      if (fill) {
        ctx.fillStyle = fill.color.css()
        ctx.fill()
      }
      if (stroke) {
        ctx.strokeStyle = stroke.color.css()
        ctx.lineWidth = stroke.width
        ctx.stroke()
      }
    }

    const typedOpts = opts as TrianglifyOptions
    if (typedOpts.fill && typedOpts.strokeWidth < 1) {
      // draw background strokes at edge bounds to solve for white gaps due to
      // canvas antialiasing. See https://stackoverflow.com/q/19319963/381299
      polys.forEach(poly => drawPoly(poly, null, { color: poly.color, width: 2 }))
    }

    // draw visible fills and strokes
    polys.forEach(poly => {
      const strokeColor: CSSColor = typedOpts.strokeColor ? { css: () => typedOpts.strokeColor! } : poly.color
      drawPoly(
        poly,
        typedOpts.fill && { color: poly.color },
        (typedOpts.strokeWidth > 0) && { color: strokeColor, width: typedOpts.strokeWidth }
      )
    })

    return canvas
  }
}
