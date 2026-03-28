import type { Color, Scale } from 'chroma-js'

export type Point = [number, number]

export interface Centroid {
  x: number
  y: number
}

export interface TrianglifyOptions {
  width: number
  height: number
  cellSize: number
  variance: number
  seed: string | number | null
  xColors: string | string[] | false
  yColors: string | string[] | false
  palette: Record<string, string[]> | string[][]
  colorSpace: 'rgb' | 'hsv' | 'hsl' | 'hsi' | 'lab' | 'hcl'
  colorFunction: ColorFunction
  fill: boolean
  strokeWidth: number
  strokeColor: string | null
  points: Point[] | null
}

export interface ColorFunctionParams {
  centroid: Centroid
  xPercent: number
  yPercent: number
  vertexIndices: number[]
  vertices: Point[]
  xScale: Scale
  yScale: Scale
  points: Point[]
  opts: TrianglifyOptions
  random: () => number
}

export interface ColorFunction {
  (params: ColorFunctionParams): Color
  _descriptor?: { name: string; args: number[] }
}

export interface Polygon {
  vertexIndices: number[]
  centroid: Centroid
  color: Color
}

export interface RenderOpts {
  width: number
  height: number
  fill: boolean
  strokeWidth: number
  strokeColor: string | null
}

export interface PatternData {
  points: Point[]
  polys: { vertexIndices: number[]; centroid: Centroid; color: string }[]
  opts: RenderOpts
}

export interface SVGTreeNode {
  tagName: string
  attrs: Record<string, string | number | undefined>
  children: SVGTreeNode[] | null
  toString(): string
}

export interface SVGOptions {
  includeNamespace?: boolean
  coordinateDecimals?: number
}

export interface CanvasOptions {
  scaling?: 'auto' | false | number
  applyCssScaling?: boolean
}
