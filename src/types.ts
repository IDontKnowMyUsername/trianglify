/** An `[x, y]` coordinate pair. */
export type Point = [number, number]

/**
 * A color value as passed between scales, color functions, and the
 * serializer: a culori-compatible plain object carrying a color-space tag
 * and numeric channels, e.g. `{ mode: 'oklch', l: 0.7, c: 0.1, h: 240 }`.
 * Treat colors returned by scales as immutable — they may be shared cache
 * entries (see `colorQuantization`).
 */
export interface PatternColor {
  mode: string
  alpha?: number
  [channel: string]: string | number | undefined
}

/**
 * Color spaces available for gradient interpolation. `'lab'` and `'hcl'`
 * interpolate CIELAB / CIELCh with a D65 whitepoint; `'oklab'`/`'oklch'`
 * are the perceptually-uniform CSS Color 4 spaces.
 */
export type ColorSpace = 'rgb' | 'hsv' | 'hsl' | 'hsi' | 'lab' | 'hcl' | 'oklab' | 'oklch'

/**
 * Output format for polygon color strings:
 * - `'rgb'` — 8-bit `rgb(r g b)`, gamut-clamped to sRGB (works everywhere)
 * - `'oklch'` — decimal-precision `oklch(…)` strings (browsers map to the display's gamut)
 * - `'display-p3'` — `color(display-p3 …)` strings, gamut-clamped to P3
 *
 * Wide-gamut formats render in SVG and browser canvas; node-canvas cannot
 * parse them, so `toCanvas()` throws in Node for non-`'rgb'` output.
 */
export type ColorOutput = 'rgb' | 'oklch' | 'display-p3'

/**
 * The three exact pentagonal tilings. These generate their complete plane
 * geometry directly from `cellSize`, bypassing the point-generation
 * pipeline:
 * - `'pentagon-cairo'` — the equilateral Cairo pentagonal tiling
 * - `'pentagon-convex'` — a type 5 convex pentagon tiling forming 6-fold rosettes
 * - `'pentagon-nonconvex'` — a non-convex pentagon tiling forming 12-fold star rosettes
 */
export type TilingShape = 'pentagon-cairo' | 'pentagon-convex' | 'pentagon-nonconvex'

/**
 * The geometry a pattern is built from:
 * - `'triangle'` — Delaunay triangulation of the generated points (the classic behavior)
 * - `'pentagon'`, `'hexagon'`, `'heptagon'`, `'octagon'` — one regular polygon
 *   per generated point, with gaps filled by triangles; hexagons on the
 *   default `'grid'` layout are arranged in an exact honeycomb
 * - `'circle'` — one circle per generated point, with gap-filling triangles
 * - the {@link TilingShape} values — exact pentagonal plane tilings
 */
export type Shape = 'triangle' | 'pentagon' | TilingShape | 'hexagon' | 'heptagon' | 'octagon' | 'circle'

/** The center point of a polygon, as `{x, y}`. */
export interface Centroid {
  x: number
  y: number
}

/** A minimal color value: call `css()` to get a CSS-formatted color string. */
export interface CSSColor {
  css: () => string
}

/**
 * Options accepted by the `trianglify()` function. All keys are optional in
 * the call — missing keys fall back to `trianglify.defaultOptions`.
 * Unrecognized or malformed options throw a TypeError.
 */
export interface TrianglifyOptions {
  /** Width in pixels of the pattern to generate. Default: `600`. */
  width: number
  /** Height in pixels of the pattern to generate. Default: `400`. */
  height: number
  /**
   * Size in pixels of the mesh used to generate the pattern geometry. Larger
   * values give coarser patterns, smaller values finer ones — very small
   * values may dramatically increase runtime. Default: `75`.
   */
  cellSize: number
  /**
   * Amount of randomness (0–1) applied to the point layout. Values above 1
   * are allowed but may leave gaps at the pattern edges. Default: `0.75`.
   */
  variance: number
  /**
   * Seed for the random number generator, to create repeatable patterns.
   * When `null`, the RNG is seeded randomly from the environment.
   * Default: `null`.
   */
  seed: string | number | null
  /**
   * Color gradient used on the x axis: an array of CSS color stops, the name
   * of a palette entry (e.g. `'YlGnBu'`), or `'random'` to pick a random
   * palette entry. Default: `'random'`.
   */
  xColors: string | string[]
  /**
   * Color gradient used on the y axis. `'match'` reuses the x-axis gradient;
   * otherwise accepts the same values as `xColors`. Default: `'match'`.
   */
  yColors: string | string[]
  /**
   * The color combinations picked from when `xColors`/`yColors` is
   * `'random'` or a palette name: a name→colors map or an array of color
   * arrays. Every entry must be a non-empty array of CSS color strings.
   * Default: the bundled colorbrewer palettes (`trianglify.utils.colorbrewer`).
   */
  palette: Record<string, string[]> | string[][]
  /** Color space used for gradient interpolation — see {@link ColorSpace}. Default: `'lab'`. */
  colorSpace: ColorSpace
  /**
   * Output format for polygon color strings — see {@link ColorOutput}.
   * Default: `'rgb'`.
   */
  colorOutput: ColorOutput
  /**
   * Number of steps the x/y color scales are quantized to (scale lookups
   * snap to a t-grid of this many steps and are cached, which speeds up
   * generation substantially). `'auto'` derives the step count from
   * `colorOutput` (256 for `'rgb'`, 1024 for wide-gamut formats) so the
   * quantization error stays at or below the output format's own
   * precision; `false` disables quantization for exact scale evaluation.
   * Default: `'auto'`.
   */
  colorQuantization: number | false | 'auto'
  /**
   * Function used to color each polygon — receives
   * {@link ColorFunctionParams} and returns a {@link PatternColor} (or a
   * finished CSS color string, which is emitted as-is). The built-ins live
   * on `trianglify.colorFunctions`.
   * Default: `trianglify.colorFunctions.interpolateLinear(0.5)`.
   */
  colorFunction: ColorFunction
  /** Whether polygons are filled. Default: `true`. */
  fill: boolean
  /**
   * Width of polygon outlines; combine with `fill: false` for weblike
   * patterns. Default: `0`.
   */
  strokeWidth: number
  /**
   * CSS color for polygon strokes; when `null` each polygon strokes in its
   * own fill color. Default: `null`.
   */
  strokeColor: string | null
  /**
   * Custom `[x, y]` points to build the pattern from, replacing the
   * generated layout. Not supported with the `pentagon-*` tiling shapes.
   * Default: `null`.
   */
  points: Point[] | null
  /**
   * Algorithm used to generate the point layout: a jittered square grid, an
   * organic Poisson-disc/best-candidate sampling, a Fermat spiral, or an
   * orthographic sphere projection. Ignored when `points` is provided or
   * when `shape` is a `pentagon-*` tiling. Default: `'grid'`.
   */
  pointGeneration: 'grid' | 'poisson' | 'bestCandidate' | 'spiral' | 'sphere'
  /** The geometry the pattern is built from — see {@link Shape}. Default: `'triangle'`. */
  shape: Shape
  /**
   * Winding direction of the `'spiral'` point layout. Has no effect with
   * other pointGeneration modes. Default: `'ccw'`.
   */
  spiralDirection: 'cw' | 'ccw'
  /**
   * Divergence angle control for the `'spiral'` layout: for a ratio `r` the
   * angle between consecutive points is `2π/r²`, and `'golden'` uses the
   * golden ratio (the sunflower-seed golden angle, ~137.5°). Has no effect
   * with other pointGeneration modes. Default: `'golden'`.
   */
  spiralRatio: number | 'golden'
}

/** The data passed to a {@link ColorFunction} for each polygon. */
export interface ColorFunctionParams {
  /** Center of the polygon being colored. */
  centroid: Centroid
  /** Horizontal position of the centroid within the pattern, normalized to 0–1. */
  xPercent: number
  /** Vertical position of the centroid within the pattern, normalized to 0–1. */
  yPercent: number
  /**
   * Indices into `points` for the polygon's corners. Empty for
   * `shape: 'circle'`, which carries no vertex geometry — rely on `centroid`
   * instead.
   */
  vertexIndices: number[]
  /** The polygon's corner coordinates (empty for `shape: 'circle'`). */
  vertices: Point[]
  /**
   * Gradient over the resolved `xColors`: maps t ∈ [0, 1] to a color
   * (out-of-range t clamps to the gradient ends). Subject to
   * `colorQuantization` — treat returned colors as immutable.
   */
  xScale: (t: number) => PatternColor
  /** Gradient over the resolved `yColors` — same contract as `xScale`. */
  yScale: (t: number) => PatternColor
  /** The full point layout of the pattern. */
  points: Point[]
  /** The validated options the pattern is being generated with. */
  opts: TrianglifyOptions
  /**
   * Seeded random source dedicated to coloring — drawing from it never
   * changes the pattern geometry for a given seed.
   */
  random: () => number
}

/**
 * Serializable reference to a built-in color function — functions can't
 * cross the postMessage boundary, so this is the worker wire format.
 */
export interface ColorFunctionDescriptor {
  /** Name of a built-in color function, e.g. `'sparkle'`. */
  name: string
  /** Arguments to call the factory with, e.g. `[0.2]`. */
  args?: unknown[]
}

/**
 * A polygon-coloring function: receives {@link ColorFunctionParams} and
 * returns a {@link PatternColor}, or a finished CSS color string to emit
 * as-is (bypassing `colorOutput` serialization). Built-in color functions
 * carry a `_descriptor` so they can be serialized to a Web Worker.
 */
export interface ColorFunction {
  (params: ColorFunctionParams): PatternColor | string
  _descriptor?: ColorFunctionDescriptor
}

/**
 * The message a `TrianglifyWorker` client posts to the worker. Functions
 * cannot cross the structured-clone boundary, so a color function only ever
 * arrives as a {@link ColorFunctionDescriptor} or a bare built-in name.
 */
export interface WorkerRequest {
  id?: number
  opts?: Omit<Partial<TrianglifyOptions>, 'colorFunction'> & {
    colorFunction?: ColorFunctionDescriptor | string
  }
}

/**
 * The reply the worker posts back: the request's `id` plus either the
 * serialized pattern data or an error message (never both). A malformed
 * request is answered with `id: undefined`.
 */
export interface WorkerResponse {
  id: number | undefined
  data?: PatternData
  error?: string
}

/** One colored polygon of a generated pattern. */
export interface Polygon {
  /**
   * Indices into the pattern's `points` array defining the polygon corners.
   * Empty for circles, which are defined by `centroid` + `radius` instead.
   */
  vertexIndices: number[]
  /** Center of the polygon. */
  centroid: Centroid
  /** The polygon's color — call `.css()` for a CSS-formatted string. */
  color: CSSColor
  /**
   * Circumradius in pixels, set for the regular-polygon and circle shapes.
   * For `shape: 'circle'` this is the rendered circle's radius.
   */
  radius?: number
}

/**
 * The subset of options a {@link Pattern} needs for rendering — this is what
 * `Pattern.fromData` restores in place of the full generation options.
 */
export interface RenderOpts {
  width: number
  height: number
  fill: boolean
  strokeWidth: number
  strokeColor: string | null
  shape: Shape
  /**
   * The color format the pattern's polygon colors were serialized in.
   * Absent in data from older releases, which is treated as `'rgb'` —
   * `toCanvas()` uses this to reject wide-gamut rendering where the canvas
   * can't support it.
   */
  colorOutput?: ColorOutput
}

/**
 * Plain-object form of a {@link Pattern} as produced by `pattern.toData()`:
 * survives `JSON.stringify` and `postMessage` (colors are CSS strings), and
 * is restored with `Pattern.fromData()`.
 */
export interface PatternData {
  points: Point[]
  polys: { vertexIndices: number[]; centroid: Centroid; color: string; radius?: number }[]
  opts: RenderOpts
}

/** Attribute map of an SVG node; `undefined` values are omitted when serializing. */
export type SVGAttrs = Record<string, string | number | undefined>

/**
 * Lightweight SVG node tree returned by `toSVG()`/`toSVGTree()` outside the
 * browser — call `toString()` to serialize it to a valid SVG string.
 */
export interface SVGTreeNode {
  tagName: string
  attrs: SVGAttrs
  children: SVGTreeNode[] | null
  toString(): string
}

/** SVG-specific rendering options for `toSVG()`/`toSVGTree()`. */
export interface SVGOptions {
  /**
   * Include the `xmlns` attribute on the root `<svg>` tag — required when
   * the markup is used standalone (e.g. saved to a file). Default: `true`.
   */
  includeNamespace?: boolean
  /**
   * How many decimals to round coordinate values to; set to `-1` to disable
   * rounding. Default: `1`.
   */
  coordinateDecimals?: number
}

/** Canvas-specific rendering options for `toCanvas()`. */
export interface CanvasOptions {
  /**
   * How the canvas is rendered on high-DPI displays: `'auto'` matches the
   * device pixel ratio, a number forces that scale factor, `false` disables
   * scaling. Default: `'auto'` in browsers, `false` in Node.
   */
  scaling?: 'auto' | false | number
  /**
   * When the canvas is rendered at a scaled resolution, apply inline CSS to
   * display it back at `width` × `height`. Default: `true` in browsers,
   * `false` in Node.
   */
  applyCssScaling?: boolean
}
