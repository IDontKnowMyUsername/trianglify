import { mix, darken } from './colorBackend'
import type { ColorFunction, ColorFunctionParams } from '../types'

// Built in color functions provided for your convenience.
//
// Usage example:
//
// const pattern = trianglify({
//  width: 300,
//  height: 200,
//  colorFunction: trianglify.colorFunctions.sparkle(0.2)
// })
//
// the snippet above gives you a trianglify pattern with a 20% random
// jitter applied to the x and y gradient scales

/**
 * Linear interpolation of two gradients, one for the x and one for the y
 * axis. This is the default Trianglify color function.
 * @param bias - how prevalent the y axis is versus the x axis (0–1)
 */
export const interpolateLinear = (bias = 0.5): ColorFunction => {
  const fn: ColorFunction = ({ xPercent, yPercent, xScale, yScale, opts }: ColorFunctionParams) =>
    mix(xScale(xPercent), yScale(yPercent), bias, opts.colorSpace)
  fn._descriptor = { name: 'interpolateLinear', args: [bias] }
  return fn
}

/**
 * Give the pattern a 'sparkle' effect by introducing random noise into the
 * x and y gradients, making for higher contrast between cells.
 * @param jitterFactor - amount of noise applied to the gradient positions
 */
export const sparkle = (jitterFactor = 0.15): ColorFunction => {
  const fn: ColorFunction = ({ xPercent, yPercent, xScale, yScale, opts, random }: ColorFunctionParams) => {
    const jitter = () => (random() - 0.5) * jitterFactor
    const a = xScale(xPercent + jitter())
    const b = yScale(yPercent + jitter())
    return mix(a, b, 0.5, opts.colorSpace)
  }
  fn._descriptor = { name: 'sparkle', args: [jitterFactor] }
  return fn
}

/**
 * Similar to the sparkle effect, but instead of swapping colors around it
 * darkens cells by a random amount.
 * @param shadowIntensity - how dark the darkest shadows are
 */
export const shadows = (shadowIntensity = 0.8): ColorFunction => {
  const fn: ColorFunction = ({ xPercent, yPercent, xScale, yScale, opts, random }: ColorFunctionParams) => {
    const a = xScale(xPercent)
    const b = yScale(yPercent)
    const color = mix(a, b, 0.5, opts.colorSpace)
    return darken(color, shadowIntensity * random())
  }
  fn._descriptor = { name: 'shadows', args: [shadowIntensity] }
  return fn
}

/**
 * Map color based on distance from center. Pairs well with spiral and
 * sphere layouts.
 * @param falloff - curve of the gradient (1 = linear, <1 concentrates color
 *   near the center, >1 concentrates it at the edges)
 */
export const radial = (falloff = 1): ColorFunction => {
  const fn: ColorFunction = ({ centroid, xScale, opts }: ColorFunctionParams) => {
    const cx = opts.width / 2
    const cy = opts.height / 2
    const maxDist = Math.sqrt(cx * cx + cy * cy)
    const dx = centroid.x - cx
    const dy = centroid.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const t = Math.min(1, (dist / maxDist) ** falloff)
    return xScale(t)
  }
  fn._descriptor = { name: 'radial', args: [falloff] }
  return fn
}

/**
 * Map color based on angle from center. Pairs well with spiral layouts.
 * @param offset - rotates the gradient (in radians)
 */
export const angular = (offset = 0): ColorFunction => {
  const fn: ColorFunction = ({ centroid, xScale, opts }: ColorFunctionParams) => {
    const cx = opts.width / 2
    const cy = opts.height / 2
    const angle = Math.atan2(centroid.y - cy, centroid.x - cx)
    const TWO_PI = 2 * Math.PI
    // double modulo: JS % keeps the dividend's sign, so negative offsets
    // would otherwise clamp at the scale ends instead of wrapping
    const t = (((angle + Math.PI + offset) % TWO_PI + TWO_PI) % TWO_PI) / TWO_PI
    return xScale(t)
  }
  fn._descriptor = { name: 'angular', args: [offset] }
  return fn
}
