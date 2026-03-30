import chroma from 'chroma-js'
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

// Linear interpolation of two gradients, one for the x and one for the y
// axis. This is the default Trianglify color function.
// The bias parameter controls how prevalent the y axis is versus the x axis
export const interpolateLinear = (bias = 0.5): ColorFunction => {
  const fn: ColorFunction = ({ xPercent, yPercent, xScale, yScale, opts }: ColorFunctionParams) =>
    chroma.mix(xScale(xPercent), yScale(yPercent), bias, opts.colorSpace)
  fn._descriptor = { name: 'interpolateLinear', args: [bias] }
  return fn
}

// Give the pattern a 'sparkle' effect by introducing random noise into the
// x and y gradients, making for higher contrast between cells.
export const sparkle = (jitterFactor = 0.15): ColorFunction => {
  const fn: ColorFunction = ({ xPercent, yPercent, xScale, yScale, opts, random }: ColorFunctionParams) => {
    const jitter = () => (random() - 0.5) * jitterFactor
    const a = xScale(xPercent + jitter())
    const b = yScale(yPercent + jitter())
    return chroma.mix(a, b, 0.5, opts.colorSpace)
  }
  fn._descriptor = { name: 'sparkle', args: [jitterFactor] }
  return fn
}

// This is similar to the sparkle effect, but instead of swapping colors around
// it darkens cells by a random amount. The shadowIntensity parameter controls
// how dark the darkest shadows are.
export const shadows = (shadowIntensity = 0.8): ColorFunction => {
  const fn: ColorFunction = ({ xPercent, yPercent, xScale, yScale, opts, random }: ColorFunctionParams) => {
    const a = xScale(xPercent)
    const b = yScale(yPercent)
    const color = chroma.mix(a, b, 0.5, opts.colorSpace)
    return color.darken(shadowIntensity * random())
  }
  fn._descriptor = { name: 'shadows', args: [shadowIntensity] }
  return fn
}

// Map color based on distance from center. Pairs well with spiral and
// sphere layouts. The falloff parameter controls the curve of the gradient
// (1 = linear, <1 = concentrates color near center, >1 = concentrates at edges).
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

// Map color based on angle from center. Pairs well with spiral layouts.
// The offset parameter rotates the gradient (in radians).
export const angular = (offset = 0): ColorFunction => {
  const fn: ColorFunction = ({ centroid, xScale, opts }: ColorFunctionParams) => {
    const cx = opts.width / 2
    const cy = opts.height / 2
    const angle = Math.atan2(centroid.y - cy, centroid.x - cx)
    const t = ((angle + Math.PI + offset) % (2 * Math.PI)) / (2 * Math.PI)
    return xScale(t)
  }
  fn._descriptor = { name: 'angular', args: [offset] }
  return fn
}
