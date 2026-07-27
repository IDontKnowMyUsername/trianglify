/**
 * @jest-environment jsdom
 */
export {}

// Tests for Pattern serialization/deserialization and color function
// descriptors — the data layer that Web Worker support is built on.
// The worker bundle itself is exercised in src/worker.bundle.test.ts.
// Loads the CJS bundle like every other in-process suite so the V8
// coverage remap stays consistent (see trianglify.browser.test.ts).

const trianglify = require('../dist/trianglify.cjs')
const Pattern = trianglify.Pattern

interface SerializedPoly {
  vertexIndices: number[]
  centroid: { x: number; y: number }
  color: string
}

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

    data.polys.forEach((poly: SerializedPoly) => {
      expect(typeof poly.color).toBe('string')
      // should be a valid CSS color string
      expect(poly.color).toMatch(/^(rgb|hsl|#)/)
    })
  })

  test('preserves geometry data', () => {
    const pattern = trianglify({ seed: 'worker-test', width: 100, height: 100, cellSize: 20 })
    const data = pattern.toData()

    expect(data.points).toEqual(pattern.points)
    data.polys.forEach((poly: SerializedPoly, i: number) => {
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

  test('output shares no structure with the pattern (mutation-safe)', () => {
    const pattern = trianglify({ seed: 'isolation', width: 100, height: 100 })
    const before = pattern.toSVGTree().toString()

    const data = pattern.toData()
    data.points[0][0] = 9999
    data.polys[0].vertexIndices[0] = 0
    data.polys[0].centroid.x = 9999

    expect(pattern.toSVGTree().toString()).toBe(before)
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

    restored.polys.forEach((poly: { color: { css: () => string } }, i: number) => {
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

describe('Pattern.fromData() validation', () => {
  // fromData sits on a trust boundary (postMessage results, JSON caches):
  // malformed data must fail fast with a clear TypeError instead of
  // crashing later inside a render call
  const validData = () =>
    trianglify({ seed: 'fromData-validation', width: 100, height: 100 }).toData()

  test('rejects non-object data', () => {
    expect(() => Pattern.fromData(null)).toThrow('invalid pattern data')
    expect(() => Pattern.fromData('nope')).toThrow('invalid pattern data')
  })

  test('rejects non-object polys entries', () => {
    const data = validData()
    data.polys[0] = 'nope'
    expect(() => Pattern.fromData(data)).toThrow('polys entries must be objects')
  })

  test('rejects out-of-range vertex indices', () => {
    const data = validData()
    data.polys[0].vertexIndices = [0, 1, data.points.length]
    expect(() => Pattern.fromData(data)).toThrow('not an index into points')
  })

  test('rejects non-integer vertex indices', () => {
    const data = validData()
    data.polys[0].vertexIndices = [0, 1, 1.5]
    expect(() => Pattern.fromData(data)).toThrow('not an index into points')
  })

  test('rejects malformed points entries', () => {
    const data = validData()
    data.points[0] = ['x', 0]
    expect(() => Pattern.fromData(data)).toThrow('invalid pattern data')
  })

  test('rejects non-string poly colors', () => {
    const data = validData()
    data.polys[0].color = 42
    expect(() => Pattern.fromData(data)).toThrow('poly.color')
  })

  test('rejects a vertexless poly without a radius', () => {
    const data = validData()
    data.polys[0].vertexIndices = []
    expect(() => Pattern.fromData(data)).toThrow('radius')
  })

  test('rejects malformed centroids', () => {
    const data = validData()
    data.polys[0].centroid = { x: NaN, y: 0 }
    expect(() => Pattern.fromData(data)).toThrow('centroid')
  })

  test('rejects malformed render opts', () => {
    const badWidth = validData()
    badWidth.opts.width = -5
    expect(() => Pattern.fromData(badWidth)).toThrow('opts.width')

    const badFill = validData()
    badFill.opts.fill = 'yes'
    expect(() => Pattern.fromData(badFill)).toThrow('opts.fill')

    const badStroke = validData()
    badStroke.opts.strokeColor = 7
    expect(() => Pattern.fromData(badStroke)).toThrow('opts.strokeColor')
  })

  test('rejects an unknown opts.shape', () => {
    const data = validData()
    data.opts.shape = 'bogus'
    expect(() => Pattern.fromData(data)).toThrow('opts.shape')
  })

  test('copies its input, so later mutation cannot corrupt the pattern', () => {
    const data = validData()
    const restored = Pattern.fromData(data)
    const before = restored.toSVGTree().toString()

    data.points[0][0] = 9999
    data.polys[0].centroid.x = 9999
    data.opts.strokeWidth = 50

    expect(restored.toSVGTree().toString()).toBe(before)
  })

  test('accepts valid circle-pattern data round-trips', () => {
    const pattern = trianglify({ seed: 'circle-data', width: 100, height: 100, cellSize: 25, shape: 'circle' })
    const restored = Pattern.fromData(pattern.toData())
    expect(restored.toSVGTree().toString()).toBe(pattern.toSVGTree().toString())
  })
})
