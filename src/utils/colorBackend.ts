/*
 * Internal color backend — the seam between trianglify and the underlying
 * color library (culori). All color math and serialization goes through
 * here so the rest of the codebase (and the public API) never depends on
 * backend types directly (docs/color-pipeline-plan.md).
 *
 * Imports use culori/fn, the tree-shakeable entry: only the color spaces
 * registered below end up in the bundles.
 */
import { useMode, converter, interpolate, formatCss, parse, modeRgb, modeLrgb, modeHsl, modeHsv, modeHsi, modeXyz65, modeLab65, modeLch65, modeOklab, modeOklch, modeP3 } from 'culori/fn'
import type { PatternColor, ColorSpace, ColorOutput } from '../types'

// Every color space reachable from the public options must be registered,
// plus the intermediates conversions route through (lrgb for oklab/oklch,
// xyz65 for lab65/lch65/p3) — an unregistered mode throws at conversion
// time, not at import time.
useMode(modeRgb)
useMode(modeLrgb)
useMode(modeHsl)
useMode(modeHsv)
useMode(modeHsi)
useMode(modeXyz65)
useMode(modeLab65)
useMode(modeLch65)
useMode(modeOklab)
useMode(modeOklch)
useMode(modeP3)

// colorSpace option → culori mode. lab/hcl map to the D65-whitepoint
// variants, matching the interpolation whitepoint of earlier releases.
const SPACE_TO_MODE: Record<ColorSpace, string> = {
  rgb: 'rgb',
  hsv: 'hsv',
  hsl: 'hsl',
  hsi: 'hsi',
  lab: 'lab65',
  hcl: 'lch65',
  oklab: 'oklab',
  oklch: 'oklch'
}

/** Validity map for the colorOutput option, shared by option validation and Pattern.fromData. */
export const validColorOutputs: Record<ColorOutput, true> = { rgb: true, oklch: true, 'display-p3': true }

/** Parse a CSS color string into a color object; throws a TypeError on unparseable input. */
export const parseColor = (css: string): PatternColor => {
  const parsed = parse(css)
  if (parsed === undefined) {
    throw TypeError(`invalid color: ${JSON.stringify(css)} (expected a CSS color string)`)
  }
  return parsed
}

const toColor = (color: PatternColor | string): PatternColor =>
  typeof color === 'string' ? parseColor(color) : color

/**
 * Build a gradient function over the given color stops, evenly spaced on
 * t ∈ [0, 1] (out-of-range t clamps to the ends).
 */
export const makeScale = (colors: string[], space: ColorSpace): ((t: number) => PatternColor) => {
  const stops = colors.map(parseColor)
  // a single stop means a constant scale; interpolate needs two points
  if (stops.length === 1) stops.push(stops[0]!)
  return interpolate(stops, SPACE_TO_MODE[space])
}

/** Mix two colors in the given interpolation space. */
export const mix = (a: PatternColor | string, b: PatternColor | string, ratio = 0.5, space: ColorSpace = 'lab'): PatternColor =>
  interpolate([toColor(a), toColor(b)], SPACE_TO_MODE[space])(ratio)

const toLab65 = converter('lab65')
const toRgb = converter('rgb')
const toOklch = converter('oklch')
const toP3 = converter('p3')

// lightness step per darken unit on the CIELAB L axis (same constant
// earlier releases used, so shadows() keeps its visual depth)
const LAB_KN = 18

/** Darken a color by reducing CIELAB lightness (1 unit = 18 L). */
export const darken = (color: PatternColor | string, amount = 1): PatternColor => {
  // object input in a registered mode always converts — undefined is only
  // possible for unparseable strings, which toColor has already rejected
  const lab = toLab65(toColor(color)) as PatternColor & { l: number }
  return { ...lab, l: lab.l - LAB_KN * amount }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

// wide-gamut components are emitted at 5 decimals — beyond 12-bit-per-
// channel precision, without formatCss's full-float digit spray
const round5 = (v: number): number => Math.round(v * 1e5) / 1e5

const roundChannels = (c: PatternColor): PatternColor => {
  const out: PatternColor = { mode: c.mode }
  for (const k of Object.keys(c)) {
    const v = c[k]
    out[k] = typeof v === 'number' ? round5(v) : v
  }
  return out
}

/**
 * Serialize a color for pattern output:
 * - `'rgb'` — 8-bit `rgb(r g b)`, channel-clamped to sRGB
 * - `'oklch'` — decimal-precision `oklch(l c h)`, gamut unclamped (the
 *   display maps it)
 * - `'display-p3'` — `color(display-p3 r g b)`, channel-clamped to P3
 */
export const serializeColor = (color: PatternColor | string, output: ColorOutput = 'rgb'): string => {
  const c = toColor(color)
  switch (output) {
    case 'rgb': {
      const rgb = toRgb(c) as PatternColor & { r: number; g: number; b: number }
      const r = Math.round(clamp01(rgb.r) * 255)
      const g = Math.round(clamp01(rgb.g) * 255)
      const b = Math.round(clamp01(rgb.b) * 255)
      const alpha = typeof rgb.alpha === 'number' && rgb.alpha < 1 ? ` / ${round5(clamp01(rgb.alpha))}` : ''
      return `rgb(${r} ${g} ${b}${alpha})`
    }
    case 'oklch':
      return formatCss(roundChannels(toOklch(c)!))!
    case 'display-p3': {
      const p3 = toP3(c) as PatternColor & { r: number; g: number; b: number }
      return formatCss(roundChannels({ ...p3, r: clamp01(p3.r), g: clamp01(p3.g), b: clamp01(p3.b) }))!
    }
  }
}
