/**
 * @jest-environment node
 */
/* eslint-env jest */
// Additional tests to increase code coverage of trianglify.js
const trianglify = require('../dist/trianglify.js')
const Pattern = trianglify.Pattern

describe('Color options', () => {
  test('should accept direct color arrays for xColors', () => {
    const pattern = trianglify({
      xColors: ['#ff0000', '#00ff00', '#0000ff'],
      seed: 'directColors'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('should accept direct color arrays for yColors', () => {
    const pattern = trianglify({
      xColors: 'YlGn',
      yColors: ['#ff0000', '#00ff00', '#0000ff'],
      seed: 'directYColors'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('should accept palette as an array of color arrays', () => {
    const palette = [
      ['#ff0000', '#00ff00', '#0000ff'],
      ['#ffff00', '#ff00ff', '#00ffff']
    ]
    const pattern = trianglify({
      palette,
      xColors: 'random',
      seed: 'arrayPalette'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })
})

describe('Custom points', () => {
  test('should accept user-provided points', () => {
    const points = []
    for (let x = 0; x <= 100; x += 25) {
      for (let y = 0; y <= 100; y += 25) {
        points.push([x, y])
      }
    }
    const pattern = trianglify({
      width: 100,
      height: 100,
      points,
      seed: 'customPoints'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.points).toBe(points)
  })
})

describe('Color functions', () => {
  test('should support the sparkle color function', () => {
    const pattern = trianglify({
      colorFunction: trianglify.colorFunctions.sparkle(0.2),
      seed: 'sparkle'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('should support the shadows color function', () => {
    const pattern = trianglify({
      colorFunction: trianglify.colorFunctions.shadows(0.5),
      seed: 'shadows'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })
})

describe('SVG rendering options', () => {
  test('should render SVG with strokeWidth', () => {
    const pattern = trianglify({
      strokeWidth: 2,
      seed: 'stroke'
    })
    const svg = pattern.toSVGTree()
    const svgStr = svg.toString()
    expect(svgStr).toContain('stroke-width')
    expect(svgStr).toContain('stroke-linejoin')
  })

  test('should render SVG without fill', () => {
    const pattern = trianglify({
      fill: false,
      strokeWidth: 1,
      seed: 'noFill'
    })
    const svg = pattern.toSVGTree()
    const svgStr = svg.toString()
    expect(svgStr).not.toContain('shape-rendering')
    expect(svgStr).toContain('stroke-width')
  })

  test('should support coordinateDecimals: -1 to disable rounding', () => {
    const pattern = trianglify({
      seed: 'decimals'
    })
    const svgRounded = pattern.toSVGTree()
    const svgUnrounded = pattern.toSVGTree({ coordinateDecimals: -1 })
    // unrounded SVG should have more decimal places
    expect(svgUnrounded.toString()).not.toEqual(svgRounded.toString())
  })

  test('should support includeNamespace: false', () => {
    const pattern = trianglify({ seed: 'ns' })
    const svg = pattern.toSVGTree({ includeNamespace: false })
    const svgStr = svg.toString()
    expect(svgStr).not.toContain('xmlns')
  })
})

describe('Canvas rendering options', () => {
  test('should render to canvas with explicit scaling ratio', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      seed: 'canvasScaling'
    })
    const canvas = pattern.toCanvas(null, { scaling: 2 })
    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(200)
  })

  test('should render to canvas with scaling ratio of 1', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      seed: 'canvasScale1'
    })
    const canvas = pattern.toCanvas(null, { scaling: 1 })
    expect(canvas.width).toBe(100)
    expect(canvas.height).toBe(100)
  })

  test('should render to canvas with strokeWidth and fill', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      strokeWidth: 2,
      seed: 'canvasStroke'
    })
    const canvas = pattern.toCanvas()
    expect(canvas).toBeDefined()
  })

  test('should render to canvas with fill: false', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      fill: false,
      strokeWidth: 1,
      seed: 'canvasNoFill'
    })
    const canvas = pattern.toCanvas()
    expect(canvas).toBeDefined()
  })

  test('should render to a provided destCanvas', () => {
    const { createCanvas } = require('canvas')
    const destCanvas = createCanvas(100, 100)
    const pattern = trianglify({
      width: 100,
      height: 100,
      seed: 'destCanvas'
    })
    const result = pattern.toCanvas(destCanvas)
    expect(result).toBe(destCanvas)
  })
})
