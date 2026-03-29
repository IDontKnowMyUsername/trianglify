import getScalingRatio from './utils/getScalingRatio'
import type { Point, CSSColor, Polygon, TrianglifyOptions, RenderOpts, PatternData, SVGTreeNode, SVGOptions, CanvasOptions } from './types'

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
  Object.entries(attrs).forEach(
    ([k, v]) => v !== undefined && elem.setAttribute(k, String(v))
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

export default class Pattern {
  points: Point[]
  polys: Polygon[]
  opts: TrianglifyOptions | RenderOpts

  constructor (points: Point[], polys: Polygon[], opts: TrianglifyOptions | RenderOpts) {
    this.points = points
    this.polys = polys
    this.opts = opts
  }

  // Serialize the pattern to a plain object suitable for postMessage/JSON.
  // Chroma color objects are converted to CSS strings.
  toData = (): PatternData => {
    const { width, height, fill, strokeWidth, strokeColor } = this.opts
    return {
      points: this.points,
      polys: this.polys.map(poly => ({
        vertexIndices: poly.vertexIndices,
        centroid: poly.centroid,
        color: poly.color.css()
      })),
      opts: { width, height, fill, strokeWidth, strokeColor }
    }
  }

  // Reconstruct a Pattern from serialized data (as produced by toData).
  // The returned pattern supports toCanvas() and toSVG() rendering.
  static fromData (data: PatternData): Pattern {
    const polys: Polygon[] = data.polys.map(poly => ({
      vertexIndices: poly.vertexIndices,
      centroid: poly.centroid,
      color: { css: () => poly.color }
    }))
    return new Pattern(data.points, polys, data.opts)
  }

  private _toSVG = <T>(serializer: Serializer<T>, destSVG: T | null, _svgOpts: SVGOptions = {}): T => {
    const s = serializer
    const defaultSVGOptions = { includeNamespace: true, coordinateDecimals: 1 }
    const svgOpts = { ...defaultSVGOptions, ..._svgOpts }
    const { points, polys, opts } = this
    const { width, height, fill, strokeWidth, strokeColor } = opts

    // only round points if the coordinateDecimals option is non-negative
    // set coordinateDecimals to -1 to disable point rounding
    const roundedPoints = (svgOpts.coordinateDecimals < 0)
      ? points
      : points.map(p => p.map(x => +x.toFixed(svgOpts.coordinateDecimals)))

    const paths = polys.map((poly) => {
      const xys = poly.vertexIndices.map(i => `${roundedPoints[i]![0]},${roundedPoints[i]![1]}`)
      const d = `M${xys.join('L')}Z`
      const hasStroke = strokeWidth > 0
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
    const { width, height, fill, strokeWidth, strokeColor } = opts

    const canvas = destCanvas || _createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not acquire 2D rendering context from canvas')

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

    const drawPoly = (poly: Polygon, polyFill: { color: CSSColor } | null | false, stroke: { color: CSSColor; width: number } | false) => {
      const vertexIndices = poly.vertexIndices
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(points[vertexIndices[0]!]![0], points[vertexIndices[0]!]![1])
      ctx.lineTo(points[vertexIndices[1]!]![0], points[vertexIndices[1]!]![1])
      ctx.lineTo(points[vertexIndices[2]!]![0], points[vertexIndices[2]!]![1])
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
