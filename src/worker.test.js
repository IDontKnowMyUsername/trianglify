/**
 * @jest-environment jsdom
 */
/* eslint-env jest */

// Tests for Web Worker support: Pattern serialization/deserialization,
// color function descriptors, and the TrianglifyWorker client.

const trianglify = require('../dist/trianglify.bundle.debug.js')
const Pattern = trianglify.Pattern

describe('Pattern.toData()', () => {
  test('returns a plain serializable object', () => {
    const pattern = trianglify({ seed: 'worker-test', width: 100, height: 100 })
    const data = pattern.toData()

    expect(data.points).toBeInstanceOf(Array)
    expect(data.polys).toBeInstanceOf(Array)
    expect(data.opts).toBeDefined()
  })

  test('converts colors to CSS strings', () => {
    const pattern = trianglify({ seed: 'worker-test', width: 100, height: 100 })
    const data = pattern.toData()

    data.polys.forEach(poly => {
      expect(typeof poly.color).toBe('string')
      // should be a valid CSS color string
      expect(poly.color).toMatch(/^(rgb|hsl|#)/)
    })
  })

  test('preserves geometry data', () => {
    const pattern = trianglify({ seed: 'worker-test', width: 100, height: 100, cellSize: 20 })
    const data = pattern.toData()

    expect(data.points).toEqual(pattern.points)
    data.polys.forEach((poly, i) => {
      expect(poly.vertexIndices).toEqual(pattern.polys[i].vertexIndices)
      expect(poly.centroid).toEqual(pattern.polys[i].centroid)
    })
  })

  test('strips non-serializable opts (colorFunction, palette)', () => {
    const pattern = trianglify({ seed: 'worker-test', width: 100, height: 100 })
    const data = pattern.toData()

    expect(data.opts.colorFunction).toBeUndefined()
    expect(data.opts.palette).toBeUndefined()
    // rendering-relevant opts should be preserved
    expect(data.opts.width).toBe(100)
    expect(data.opts.height).toBe(100)
    expect(data.opts.fill).toBe(true)
    expect(data.opts.strokeWidth).toBe(0)
  })

  test('output is JSON-serializable', () => {
    const pattern = trianglify({ seed: 'json-test', width: 100, height: 100 })
    const data = pattern.toData()

    expect(() => JSON.stringify(data)).not.toThrow()
    const roundTripped = JSON.parse(JSON.stringify(data))
    expect(roundTripped).toEqual(data)
  })
})

describe('Pattern.fromData()', () => {
  test('reconstructs a Pattern instance', () => {
    const pattern = trianglify({ seed: 'fromData-test', width: 100, height: 100 })
    const data = pattern.toData()
    const restored = Pattern.fromData(data)

    expect(restored).toBeInstanceOf(Pattern)
    expect(restored.points).toEqual(data.points)
    expect(restored.polys).toHaveLength(data.polys.length)
  })

  test('restored pattern has working color.css() on polys', () => {
    const pattern = trianglify({ seed: 'fromData-test', width: 100, height: 100 })
    const data = pattern.toData()
    const restored = Pattern.fromData(data)

    restored.polys.forEach((poly, i) => {
      expect(typeof poly.color.css).toBe('function')
      expect(poly.color.css()).toBe(data.polys[i].color)
    })
  })

  test('restored pattern renders to SVG', () => {
    const pattern = trianglify({ seed: 'svg-test', width: 100, height: 100 })
    const data = pattern.toData()
    const restored = Pattern.fromData(data)
    const svg = restored.toSVG()

    expect(svg.tagName).toEqual('svg')
    expect(svg.children).toHaveLength(restored.polys.length)
  })

  test('restored pattern renders to Canvas', () => {
    const pattern = trianglify({ seed: 'canvas-test', width: 100, height: 100 })
    const data = pattern.toData()
    const restored = Pattern.fromData(data)
    const canvas = restored.toCanvas()

    expect(canvas).toBeInstanceOf(global.HTMLElement)
    expect(canvas.tagName).toEqual('CANVAS')
  })

  test('restored pattern renders to SVGTree string', () => {
    const pattern = trianglify({ seed: 'svgtree-test', width: 100, height: 100 })
    const data = pattern.toData()
    const restored = Pattern.fromData(data)
    const svgTree = restored.toSVGTree()

    expect(typeof svgTree.toString()).toBe('string')
    expect(svgTree.toString()).toContain('<svg')
    expect(svgTree.toString()).toContain('<path')
  })
})

describe('Serialization round-trip', () => {
  test('SVG output matches between original and restored pattern', () => {
    const pattern = trianglify({ seed: 'roundtrip', width: 200, height: 200 })
    const restored = Pattern.fromData(pattern.toData())

    const originalSVG = pattern.toSVGTree().toString()
    const restoredSVG = restored.toSVGTree().toString()

    expect(restoredSVG).toEqual(originalSVG)
  })

  test('round-trip through JSON produces identical SVG', () => {
    const pattern = trianglify({ seed: 'json-roundtrip', width: 200, height: 200 })
    const json = JSON.stringify(pattern.toData())
    const restored = Pattern.fromData(JSON.parse(json))

    const originalSVG = pattern.toSVGTree().toString()
    const restoredSVG = restored.toSVGTree().toString()

    expect(restoredSVG).toEqual(originalSVG)
  })

  test('works with stroke options', () => {
    const pattern = trianglify({
      seed: 'stroke-test',
      width: 100,
      height: 100,
      strokeWidth: 2,
      strokeColor: '#ff0000'
    })
    const restored = Pattern.fromData(pattern.toData())

    const originalSVG = pattern.toSVGTree().toString()
    const restoredSVG = restored.toSVGTree().toString()

    expect(restoredSVG).toEqual(originalSVG)
    expect(restoredSVG).toContain('stroke')
  })

  test('works with fill disabled', () => {
    const pattern = trianglify({
      seed: 'nofill-test',
      width: 100,
      height: 100,
      fill: false,
      strokeWidth: 1
    })
    const restored = Pattern.fromData(pattern.toData())
    const originalSVG = pattern.toSVGTree().toString()
    const restoredSVG = restored.toSVGTree().toString()

    expect(restoredSVG).toEqual(originalSVG)
  })

  test('works with all built-in color functions', () => {
    const funcs = ['interpolateLinear', 'sparkle', 'shadows']
    funcs.forEach(name => {
      const pattern = trianglify({
        seed: `cf-${name}`,
        width: 100,
        height: 100,
        colorFunction: trianglify.colorFunctions[name]()
      })
      const restored = Pattern.fromData(pattern.toData())
      const originalSVG = pattern.toSVGTree().toString()
      const restoredSVG = restored.toSVGTree().toString()

      expect(restoredSVG).toEqual(originalSVG)
    })
  })
})

describe('Color function descriptors', () => {
  test('built-in color functions have _descriptor property', () => {
    const fn = trianglify.colorFunctions.interpolateLinear(0.3)
    expect(fn._descriptor).toEqual({ name: 'interpolateLinear', args: [0.3] })

    const fn2 = trianglify.colorFunctions.sparkle(0.2)
    expect(fn2._descriptor).toEqual({ name: 'sparkle', args: [0.2] })

    const fn3 = trianglify.colorFunctions.shadows(0.5)
    expect(fn3._descriptor).toEqual({ name: 'shadows', args: [0.5] })
  })

  test('default color function has _descriptor', () => {
    expect(trianglify.defaultOptions.colorFunction._descriptor).toEqual({
      name: 'interpolateLinear',
      args: [0.5]
    })
  })
})

describe('TrianglifyWorker export', () => {
  test('is exported from the main module', () => {
    expect(trianglify.TrianglifyWorker).toBeDefined()
    expect(typeof trianglify.TrianglifyWorker).toBe('function')
  })
})
