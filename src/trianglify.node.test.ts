/**
 * @jest-environment node
 */
export {}

// Here, we test the node-specific functionality of Trianglify.
const trianglify = require('../dist/trianglify.cjs')
const { Canvas, createCanvas } = require('canvas')
const Pattern = trianglify.Pattern

describe('Pattern generation', () => {
  test('return a Pattern given valid options', () => {
    expect(trianglify({ height: 100, width: 100 })).toBeInstanceOf(Pattern)
  })

  test('should be random by default', () => {
    const pattern1 = trianglify()
    const pattern2 = trianglify()
    expect(pattern1.toSVG()).not.toEqual(pattern2.toSVG())
  })

  test('should match snapshot for non-breaking version bumps', () => {
    expect(trianglify({ seed: 'snapshotText' }).toSVG().toString()).toMatchSnapshot()
  })
})

describe('Pattern outputs in a node environment', () => {
  describe('#toSVG', () => {
    test('returns a synthetic tree of object literals', () => {
      const svgTree = trianglify().toSVG()
      expect(Object.keys(svgTree)).toEqual(['tagName', 'attrs', 'children', 'toString'])
    })
  })

  describe('#toCanvas', () => {
    test('returns a node-canvas Canvas object', () => {
      const canvas = trianglify().toCanvas()
      expect(canvas).toBeInstanceOf(Canvas)
      expect(canvas.createPNGStream).toBeInstanceOf(Function)
    })

    test('paints pixels with the pattern color', () => {
      // a single-color palette makes every poly the same color, so sampled
      // pixels must come out red regardless of the seeded geometry
      const canvas = trianglify({
        width: 40, height: 30, cellSize: 15, seed: 'pixels',
        xColors: ['#ff0000', '#ff0000']
      }).toCanvas()
      const ctx = canvas.getContext('2d')
      for (const [x, y] of [[2, 2], [20, 15], [37, 27]]) {
        const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
        expect(a).toBe(255)
        expect(r).toBeGreaterThan(200)
        expect(g).toBeLessThan(60)
        expect(b).toBeLessThan(60)
      }
    })

    test('renders strokes with the configured strokeColor', () => {
      const opts = { width: 40, height: 30, cellSize: 15, seed: 'pixels', xColors: ['#000000', '#000000'] }
      const wireframe = trianglify({ ...opts, fill: false, strokeWidth: 2, strokeColor: '#00ff00' }).toCanvas()
      const { data } = wireframe.getContext('2d').getImageData(0, 0, 40, 30)
      let greenPixels = 0
      let filledPixels = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]! > 0) filledPixels++
        if (data[i + 1]! > 200 && data[i]! < 60 && data[i + 2]! < 60) greenPixels++
      }
      // wireframe: some pixels are green strokes, but the canvas isn't
      // fully covered (no fill)
      expect(greenPixels).toBeGreaterThan(0)
      expect(filledPixels).toBeLessThan(40 * 30)
    })

    test('resizes a destCanvas to the pattern dimensions', () => {
      const dest = createCanvas(10, 10)
      trianglify({ width: 40, height: 30, seed: 'resize' }).toCanvas(dest)
      expect(dest.width).toBe(40)
      expect(dest.height).toBe(30)
    })
  })
})
