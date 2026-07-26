/**
 * @jest-environment jsdom
 */
export {}

// Integration tests for browser (DOM) behavior, run under jsdom.
// Tests import from dist/ to validate the public API. Environment detection
// is runtime in v5, so the CJS bundle exercises the same browser code paths
// — and keeping every in-process suite on the same bundle keeps the V8
// coverage remap consistent (merging remaps of different bundles corrupts
// the merged report). The UMD bundles are artifact-tested in bundles.test.ts.
const trianglify = require('../dist/trianglify.cjs')
const Pattern = trianglify.Pattern

describe('Public API', () => {
  test('default export should be a function', () => {
    expect(trianglify).toBeInstanceOf(Function)
  })

  test('should export the colorbrewer palette', () => {
    expect(trianglify.utils.colorbrewer).toBeDefined()
    expect(trianglify.utils.colorbrewer.YlGn).toBeDefined()
  })

  test('should export the mix utility', () => {
    expect(trianglify.utils.mix).toBeDefined()
    expect(trianglify.utils.mix).toBeInstanceOf(Function)
  })

  test('should export the color function generators', () => {
    expect(trianglify.colorFunctions.interpolateLinear).toBeDefined()
    expect(trianglify.colorFunctions.interpolateLinear).toBeInstanceOf(Function)
    expect(trianglify.colorFunctions.sparkle).toBeInstanceOf(Function)
    expect(trianglify.colorFunctions.shadows).toBeInstanceOf(Function)
  })
})

describe('Options Parsing', () => {
  test('should throw an error on unrecognized options', () => {
    expect(
      () => trianglify({ height: 100, width: 100, bad_option: true })
    ).toThrow(/Unrecognized option/)
  })

  test('should throw an error on inherited object keys as options', () => {
    expect(
      () => trianglify({ toString: 'x' } as any)
    ).toThrow(/Unrecognized option/)
  })

  test('should throw an error on invalid dimensions', () => {
    expect(
      () => trianglify({ height: 100, width: -1 })
    ).toThrow(/invalid width/)

    expect(
      () => trianglify({ height: -1, width: 100 })
    ).toThrow(/invalid height/)
  })

  test('should throw an error on invalid cellSize', () => {
    expect(() => trianglify({ cellSize: 0 })).toThrow(/invalid cellSize/)
    expect(() => trianglify({ cellSize: -1 })).toThrow(/invalid cellSize/)
    expect(() => trianglify({ cellSize: 0.5 })).toThrow(/invalid cellSize/)
    expect(() => trianglify({ cellSize: '40' as any })).toThrow(/invalid cellSize/)
    expect(() => trianglify({ cellSize: 'abc' as any })).toThrow(/invalid cellSize/)
    expect(() => trianglify({ cellSize: Infinity })).toThrow(/invalid cellSize/)
    expect(() => trianglify({ cellSize: NaN })).toThrow(/invalid cellSize/)
  })

  test('should throw an error on invalid variance', () => {
    expect(() => trianglify({ variance: -1 })).toThrow(/invalid variance/)
    expect(() => trianglify({ variance: '0.5' as any })).toThrow(/invalid variance/)
    expect(() => trianglify({ variance: NaN })).toThrow(/invalid variance/)
    expect(() => trianglify({ variance: Infinity })).toThrow(/invalid variance/)
  })

  test('should throw an error on invalid pointGeneration', () => {
    expect(() => trianglify({ pointGeneration: 'invalid' as any })).toThrow(/invalid pointGeneration/)
    expect(() => trianglify({ pointGeneration: '' as any })).toThrow(/invalid pointGeneration/)
  })

  test('should throw an error on invalid points', () => {
    expect(() => trianglify({ points: 'nope' as any })).toThrow(/invalid points/)
    expect(() => trianglify({ points: [[1, 2], [3]] as any })).toThrow(/invalid points entry/)
    expect(() => trianglify({ points: [[1, NaN]] as any })).toThrow(/invalid points entry/)
  })

  test('should throw an error on invalid colorSpace, colorFunction, fill, strokeWidth, strokeColor, seed', () => {
    expect(() => trianglify({ colorSpace: 'nope' as any })).toThrow(/invalid colorSpace/)
    expect(() => trianglify({ colorFunction: 'nope' as any })).toThrow(/invalid colorFunction/)
    expect(() => trianglify({ colorFunction: undefined })).toThrow(/invalid colorFunction/)
    expect(() => trianglify({ fill: 'yes' as any })).toThrow(/invalid fill/)
    expect(() => trianglify({ strokeWidth: -1 })).toThrow(/invalid strokeWidth/)
    expect(() => trianglify({ strokeColor: 42 as any })).toThrow(/invalid strokeColor/)
    expect(() => trianglify({ seed: {} as any })).toThrow(/invalid seed/)
  })

  test('should accept valid pointGeneration values', () => {
    expect(() => trianglify({ pointGeneration: 'grid', seed: 'test' })).not.toThrow()
    expect(() => trianglify({ pointGeneration: 'poisson', seed: 'test' })).not.toThrow()
    expect(() => trianglify({ pointGeneration: 'bestCandidate', seed: 'test' })).not.toThrow()
    expect(() => trianglify({ pointGeneration: 'spiral', seed: 'test' })).not.toThrow()
    expect(() => trianglify({ pointGeneration: 'sphere', seed: 'test' })).not.toThrow()
  })

  test('should throw an error on invalid shape', () => {
    expect(() => trianglify({ shape: 'invalid' as any })).toThrow(/invalid shape/)
    expect(() => trianglify({ shape: '' as any })).toThrow(/invalid shape/)
  })

  test('should accept valid shape values', () => {
    const shapes = ['triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'circle'] as const
    shapes.forEach(shape => {
      expect(() => trianglify({ shape, seed: 'shape-test' })).not.toThrow()
    })
  })

  test('should throw on invalid spiralDirection', () => {
    expect(() => trianglify({ spiralDirection: 'invalid' as any })).toThrow(/invalid spiralDirection/)
  })

  test('should throw on invalid spiralRatio', () => {
    expect(() => trianglify({ spiralRatio: 0 })).toThrow(/invalid spiralRatio/)
    expect(() => trianglify({ spiralRatio: -1 })).toThrow(/invalid spiralRatio/)
  })
})

describe('Pattern generation', () => {
  test('return a Pattern given valid options', () => {
    expect(trianglify({ height: 100, width: 100 })).toBeInstanceOf(Pattern)
  })

  test('should use default options when invoked', () => {
    const pattern = trianglify()
    expect(pattern.opts).toEqual(trianglify.defaultOptions)
  })

  test('should override opts with user-provided options', () => {
    const pattern = trianglify({ height: 100, width: 100, cellSize: 1234 })
    expect(pattern.opts.cellSize).toEqual(1234)
  })

  test('should accept the random color option without erroring', () => {
    expect(() => {
      trianglify({ xColors: 'random' })
      trianglify({ yColors: 'random' })
    }).not.toThrow()
  })

  test('should accept the match color option without erroring', () => {
    expect(() => {
      trianglify({ xColors: 'random', yColors: 'match' })
    }).not.toThrow()
  })

  test('should accept a named colorbrewer palette without erroring', () => {
    expect(() => {
      trianglify({ xColors: 'RdBu' })
      trianglify({ yColors: 'OrRd' })
    }).not.toThrow()
  })

  test('should error on a named palette that does not exist', () => {
    expect(() => trianglify({ xColors: 'Foo' })).toThrow(/Unrecognized color option/)
    expect(() => trianglify({ yColors: 'Bar' })).toThrow(/Unrecognized color option/)
  })

  test('should generate well-formed geometry', () => {
    const pattern = trianglify({ height: 100, width: 100, cellSize: 20 })
    // we care about pattern.points and pattern.polys here
    expect(pattern.points).toBeInstanceOf(Array)
    // assert that points is an array of [x, y] tuples
    pattern.points.forEach((point: number[]) => {
      expect(point).toBeInstanceOf(Array)
      expect(point).toHaveLength(2)
    })

    // asset the polys looks right
    expect(pattern.polys).toBeInstanceOf(Array)
    pattern.polys.forEach((poly: Record<string, unknown>) => {
      expect(poly).toBeInstanceOf(Object)
      expect(Object.keys(poly)).toEqual(['vertexIndices', 'centroid', 'color'])
    })
  })

  test('should be random by default', () => {
    const pattern1 = trianglify()
    const pattern2 = trianglify()
    expect(pattern1.toSVG()).not.toEqual(pattern2.toSVG())
  })

  test('should be deterministic when seeded', () => {
    const pattern1 = trianglify({ seed: 'deadbeef' })
    const pattern2 = trianglify({ seed: 'deadbeef' })
    expect(pattern1.toSVG()).toEqual(pattern2.toSVG())
  })

  test('should match snapshot for non-breaking version bumps', () => {
    expect(trianglify({ seed: 'snapshotText' }).toSVG()).toMatchSnapshot()
  })

  test('should generate well-formed geometry with spiral point generation', () => {
    const pattern = trianglify({ height: 100, width: 100, cellSize: 20, pointGeneration: 'spiral', seed: 'spiral-browser' })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.points).toBeInstanceOf(Array)
    expect(pattern.points.length).toBeGreaterThan(3)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('should generate well-formed geometry with sphere point generation', () => {
    const pattern = trianglify({ height: 100, width: 100, cellSize: 20, pointGeneration: 'sphere', seed: 'sphere-browser' })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.points).toBeInstanceOf(Array)
    expect(pattern.points.length).toBeGreaterThan(3)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('should generate well-formed geometry with hexagon shape', () => {
    const pattern = trianglify({ height: 100, width: 100, cellSize: 20, shape: 'hexagon', seed: 'hex-browser' })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.polys.length).toBeGreaterThan(0)
    // polys include primary hexagons (6 vertices) and gap-filling triangles (3 vertices)
    const hexPolys = pattern.polys.filter((p: { vertexIndices: number[] }) => p.vertexIndices.length === 6)
    expect(hexPolys.length).toBeGreaterThan(0)
  })

  test('should generate well-formed geometry with poisson point generation', () => {
    const pattern = trianglify({ height: 100, width: 100, cellSize: 20, pointGeneration: 'poisson', seed: 'poisson-test' })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.points).toBeInstanceOf(Array)
    expect(pattern.points.length).toBeGreaterThan(3)
    pattern.points.forEach((point: number[]) => {
      expect(point).toHaveLength(2)
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('should generate well-formed geometry with bestCandidate point generation', () => {
    const pattern = trianglify({ height: 100, width: 100, cellSize: 20, pointGeneration: 'bestCandidate', seed: 'bc-test' })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.points).toBeInstanceOf(Array)
    expect(pattern.points.length).toBeGreaterThan(3)
    pattern.points.forEach((point: number[]) => {
      expect(point).toHaveLength(2)
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('poisson generation should be deterministic when seeded', () => {
    const p1 = trianglify({ seed: 'poisson-seed', pointGeneration: 'poisson' })
    const p2 = trianglify({ seed: 'poisson-seed', pointGeneration: 'poisson' })
    expect(p1.toSVG()).toEqual(p2.toSVG())
  })

  test('bestCandidate generation should be deterministic when seeded', () => {
    const p1 = trianglify({ seed: 'bc-seed', pointGeneration: 'bestCandidate' })
    const p2 = trianglify({ seed: 'bc-seed', pointGeneration: 'bestCandidate' })
    expect(p1.toSVG()).toEqual(p2.toSVG())
  })
})

describe('Pattern outputs in browser environment', () => {
  describe('#toSVG', () => {
    test('returns a well-formed SVG node', () => {
      const pattern = trianglify()
      const svgDOM = pattern.toSVG()
      expect(svgDOM.tagName).toEqual('svg')
      expect(svgDOM.children).toBeInstanceOf(global.HTMLCollection)
      Array.from(svgDOM.children as Iterable<Element>).forEach((node: Element) => {
        expect(node.tagName).toEqual('path')
      })
      expect(svgDOM.children).toHaveLength(pattern.polys.length)
    })

    test('supports rendering to the destSVG target', () => {
      const destSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      expect(destSVG.children).toHaveLength(0)
      const pattern = trianglify({ seed: 'destSVG works' })
      // side-effect-ful render to destSVG
      pattern.toSVG(destSVG)
      expect(destSVG.children).toHaveLength(pattern.polys.length)
      expect(destSVG).toMatchSnapshot()
    })

    test('re-rendering into the same destSVG replaces content instead of appending', () => {
      const destSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const pattern = trianglify({ seed: 'destSVG works' })
      pattern.toSVG(destSVG)
      pattern.toSVG(destSVG)
      expect(destSVG.children).toHaveLength(pattern.polys.length)
    })
  })

  describe('#toSVGTree', () => {
    const makeTree = () => trianglify({ seed: 'foobar' }).toSVGTree()

    test('returns a synthetic tree of object literals', () => {
      expect(Object.keys(makeTree())).toEqual(['tagName', 'attrs', 'children', 'toString'])
    })

    test('serializes to an SVG string', () => {
      expect(makeTree().toString()).toMatchSnapshot()
    })
  })

  describe('#toCanvas', () => {
    test('returns a Canvas node', () => {
      const pattern = trianglify()
      const canvas = pattern.toCanvas()
      expect(canvas).toBeInstanceOf(global.HTMLElement)
      expect(canvas.tagName).toEqual('CANVAS')
      // canvas pixel contents can't be asserted under jest-canvas-mock —
      // the node suite covers real pixel verification
    })

    test('renders at devicePixelRatio scale with CSS scaling applied', () => {
      const originalDPR = window.devicePixelRatio
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
      try {
        const canvas = trianglify({ width: 100, height: 50, seed: 'hidpi' }).toCanvas()
        expect(canvas.width).toBe(200)
        expect(canvas.height).toBe(100)
        expect(canvas.style.width).toBe('100px')
        expect(canvas.style.height).toBe('50px')
      } finally {
        Object.defineProperty(window, 'devicePixelRatio', { value: originalDPR, configurable: true })
      }
    })

    test('numeric scaling renders at the given ratio, without CSS scaling when disabled', () => {
      const canvas = trianglify({ width: 100, height: 50, seed: 'hidpi' })
        .toCanvas(undefined, { scaling: 2, applyCssScaling: false })
      expect(canvas.width).toBe(200)
      expect(canvas.height).toBe(100)
      expect(canvas.style.width).toBe('')
    })
  })
})
