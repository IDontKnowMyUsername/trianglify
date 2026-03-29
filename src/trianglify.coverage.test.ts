/**
 * @jest-environment node
 */
export {}

// Additional tests to increase code coverage of trianglify
const trianglify = require('../dist/trianglify.cjs')
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
    const points: [number, number][] = []
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

describe('Poisson disc point generation', () => {
  test('should generate a pattern with poisson point generation', () => {
    const pattern = trianglify({
      width: 200,
      height: 200,
      cellSize: 30,
      pointGeneration: 'poisson',
      seed: 'poisson-cov'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.points.length).toBeGreaterThan(10)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('should apply jitter when variance > 0', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 20,
      variance: 0.75,
      pointGeneration: 'poisson',
      seed: 'poisson-jitter'
    })
    expect(pattern.points.length).toBeGreaterThan(3)
  })

  test('should produce deterministic results when seeded', () => {
    const p1 = trianglify({ seed: 'poisson-det', pointGeneration: 'poisson', width: 100, height: 100 })
    const p2 = trianglify({ seed: 'poisson-det', pointGeneration: 'poisson', width: 100, height: 100 })
    expect(p1.toSVGTree().toString()).toEqual(p2.toSVGTree().toString())
  })

  test('should work with zero variance (no jitter)', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 20,
      variance: 0,
      pointGeneration: 'poisson',
      seed: 'poisson-novar'
    })
    expect(pattern.points.length).toBeGreaterThan(3)
  })
})

describe('Best candidate point generation', () => {
  test('should generate a pattern with bestCandidate point generation', () => {
    const pattern = trianglify({
      width: 200,
      height: 200,
      cellSize: 30,
      pointGeneration: 'bestCandidate',
      seed: 'bc-cov'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.points.length).toBeGreaterThan(10)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('should work with high variance (few candidates)', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      variance: 1.0,
      pointGeneration: 'bestCandidate',
      seed: 'bc-highvar'
    })
    expect(pattern.points.length).toBeGreaterThan(3)
  })

  test('should work with low variance (many candidates)', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      variance: 0,
      pointGeneration: 'bestCandidate',
      seed: 'bc-lowvar'
    })
    expect(pattern.points.length).toBeGreaterThan(3)
  })

  test('should produce deterministic results when seeded', () => {
    const p1 = trianglify({ seed: 'bc-det', pointGeneration: 'bestCandidate', width: 100, height: 100 })
    const p2 = trianglify({ seed: 'bc-det', pointGeneration: 'bestCandidate', width: 100, height: 100 })
    expect(p1.toSVGTree().toString()).toEqual(p2.toSVGTree().toString())
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

  test('should use strokeColor when provided on canvas', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      strokeWidth: 2,
      strokeColor: '#ff0000',
      seed: 'stroke-color-canvas'
    })
    const canvas = pattern.toCanvas()
    expect(canvas).toBeDefined()
  })

  test('should handle scaling: false (no scaling applied)', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      seed: 'no-scaling'
    })
    const canvas = pattern.toCanvas(undefined, { scaling: false })
    expect(canvas.width).toBe(100)
    expect(canvas.height).toBe(100)
  })

  test('should handle scaling: auto in node (ratio 1)', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      seed: 'auto-scaling-node'
    })
    const canvas = pattern.toCanvas(undefined, { scaling: 'auto' as const })
    expect(canvas.width).toBe(100)
    expect(canvas.height).toBe(100)
  })

  test('should draw anti-aliasing edge strokes with fractional strokeWidth', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      strokeWidth: 0.5,
      seed: 'aa-edge'
    })
    const canvas = pattern.toCanvas()
    expect(canvas).toBeDefined()
  })
})

describe('Pattern serialization', () => {
  test('toData returns a plain serializable object', () => {
    const pattern = trianglify({ seed: 'ser-test', width: 100, height: 100 })
    const data = pattern.toData()
    expect(data.points).toBeInstanceOf(Array)
    expect(data.polys).toBeInstanceOf(Array)
    expect(data.opts.width).toBe(100)
    expect(data.opts.height).toBe(100)
    expect(data.opts.fill).toBe(true)
    expect(data.opts.strokeWidth).toBe(0)
    data.polys.forEach((poly: { color: string }) => {
      expect(typeof poly.color).toBe('string')
    })
  })

  test('toData output is JSON-serializable', () => {
    const pattern = trianglify({ seed: 'json-ser', width: 100, height: 100 })
    const data = pattern.toData()
    const json = JSON.stringify(data)
    expect(JSON.parse(json)).toEqual(data)
  })

  test('fromData reconstructs a renderable Pattern', () => {
    const pattern = trianglify({ seed: 'from-data', width: 100, height: 100 })
    const data = pattern.toData()
    const restored = Pattern.fromData(data)
    expect(restored).toBeInstanceOf(Pattern)
    expect(restored.points).toEqual(data.points)
    expect(restored.polys.length).toBe(data.polys.length)
    const originalSVG = pattern.toSVGTree().toString()
    const restoredSVG = restored.toSVGTree().toString()
    expect(restoredSVG).toEqual(originalSVG)
  })

  test('fromData restores working color.css() accessors', () => {
    const pattern = trianglify({ seed: 'css-check', width: 100, height: 100 })
    const data = pattern.toData()
    const restored = Pattern.fromData(data)
    restored.polys.forEach((poly: { color: { css: () => string } }, i: number) => {
      expect(typeof poly.color.css).toBe('function')
      expect(poly.color.css()).toBe(data.polys[i].color)
    })
  })

  test('fromData pattern renders to canvas', () => {
    const pattern = trianglify({ seed: 'canvas-from', width: 100, height: 100 })
    const data = pattern.toData()
    const restored = Pattern.fromData(data)
    const canvas = restored.toCanvas()
    expect(canvas).toBeDefined()
  })

  test('serialization roundtrip with stroke options', () => {
    const pattern = trianglify({
      seed: 'stroke-ser',
      width: 100,
      height: 100,
      strokeWidth: 2,
      strokeColor: '#ff0000'
    })
    const restored = Pattern.fromData(pattern.toData())
    expect(restored.toSVGTree().toString()).toEqual(pattern.toSVGTree().toString())
  })
})

describe('Option validation (CJS)', () => {
  test('should throw on unrecognized options', () => {
    expect(() => trianglify({ bad_option: true } as any)).toThrow('Unrecognized option')
  })

  test('should throw on invalid dimensions', () => {
    expect(() => trianglify({ width: -1 })).toThrow('invalid width')
    expect(() => trianglify({ height: -1 })).toThrow('invalid height')
  })

  test('should throw on invalid cellSize', () => {
    expect(() => trianglify({ cellSize: 0 })).toThrow('invalid cellSize')
    expect(() => trianglify({ cellSize: -1 })).toThrow('invalid cellSize')
    expect(() => trianglify({ cellSize: Infinity })).toThrow('invalid cellSize')
    expect(() => trianglify({ cellSize: NaN })).toThrow('invalid cellSize')
    expect(() => trianglify({ cellSize: 'abc' as any })).toThrow('invalid cellSize')
  })

  test('should throw on invalid variance', () => {
    expect(() => trianglify({ variance: -1 })).toThrow('invalid variance')
    expect(() => trianglify({ variance: NaN })).toThrow('invalid variance')
    expect(() => trianglify({ variance: Infinity })).toThrow('invalid variance')
  })

  test('should throw on invalid pointGeneration', () => {
    expect(() => trianglify({ pointGeneration: 'invalid' as any })).toThrow('invalid pointGeneration')
  })

  test('should throw on unrecognized palette name', () => {
    expect(() => trianglify({ xColors: 'NonExistentPalette' })).toThrow('Unrecognized color')
  })
})

describe('Color processing branches', () => {
  test('yColors as a different palette from xColors (not match)', () => {
    const pattern = trianglify({
      xColors: 'YlGn',
      yColors: 'Blues',
      seed: 'diff-colors'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('palette as array with xColors and yColors both random', () => {
    const palette = [
      ['#ff0000', '#00ff00', '#0000ff'],
      ['#ffff00', '#ff00ff', '#00ffff']
    ]
    const pattern = trianglify({
      palette,
      xColors: 'random',
      yColors: 'random',
      seed: 'arr-palette-both'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })
})

describe('Color function defaults', () => {
  test('interpolateLinear with default bias', () => {
    const pattern = trianglify({
      colorFunction: trianglify.colorFunctions.interpolateLinear(),
      seed: 'interp-default'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('sparkle with default jitterFactor', () => {
    const pattern = trianglify({
      colorFunction: trianglify.colorFunctions.sparkle(),
      seed: 'sparkle-default'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('shadows with default shadowIntensity', () => {
    const pattern = trianglify({
      colorFunction: trianglify.colorFunctions.shadows(),
      seed: 'shadows-default'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })
})

describe('Varied triangulation inputs', () => {
  test('very small pattern (few triangles)', () => {
    const pattern = trianglify({
      width: 20,
      height: 20,
      cellSize: 15,
      seed: 'tiny'
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('large pattern (many triangles)', () => {
    const pattern = trianglify({
      width: 500,
      height: 500,
      cellSize: 15,
      seed: 'large'
    })
    expect(pattern.polys.length).toBeGreaterThan(100)
  })

  test('narrow pattern (extreme aspect ratio)', () => {
    const pattern = trianglify({
      width: 500,
      height: 10,
      cellSize: 8,
      seed: 'narrow'
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('zero variance (regular grid)', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      variance: 0,
      seed: 'novariance'
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('custom near-collinear points', () => {
    const points: [number, number][] = [
      [0, 0], [50, 0.001], [100, 0], [0, 100], [100, 100],
      [50, 50], [25, 75], [75, 25], [0, 50], [100, 50]
    ]
    const pattern = trianglify({
      width: 100,
      height: 100,
      points,
      seed: 'collinear'
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('fully collinear points (degenerate triangulation)', () => {
    // All points on a horizontal line: triggers Delaunator collinear handling path
    const points: [number, number][] = []
    for (let i = 0; i <= 10; i++) {
      points.push([i * 10, 50])
    }
    const pattern = trianglify({
      width: 100,
      height: 100,
      points,
      seed: 'full-collinear'
    })
    // Collinear points produce 0 triangles
    expect(pattern.polys).toHaveLength(0)
  })

  test('points with duplicates (near-duplicate skip)', () => {
    const points: [number, number][] = [
      [0, 0], [0, 0], [50, 0], [100, 0], [50, 0],
      [0, 100], [100, 100], [50, 50], [50, 50]
    ]
    const pattern = trianglify({
      width: 100,
      height: 100,
      points,
      seed: 'duplicates'
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('points triggering adaptive orient2d (large coords, nearly collinear)', () => {
    // Points with coordinates that cause collinear triples where
    // detsum > 0 but det ≈ 0, triggering orient2dadapt
    const points: [number, number][] = [
      [10, 10], [20, 20], [30, 30],      // exactly collinear on y=x
      [40, 40], [50, 50], [60, 60],      // more collinear points
      [10, 60], [60, 10],                // off-diagonal anchors
      [35, 35.0000000001],               // nearly collinear perturbation
      [25, 25], [45, 45], [15, 45], [45, 15]
    ]
    const pattern = trianglify({
      width: 70,
      height: 70,
      points,
      seed: 'orient2d-adapt'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('high point density grid (exercises more Delaunator legalize paths)', () => {
    // A large grid with many points exercises more Delaunator internal paths
    // including _legalize edge flips and hull updates
    const pattern = trianglify({
      width: 300,
      height: 300,
      cellSize: 8,
      variance: 0.5,
      seed: 'dense-grid'
    })
    expect(pattern.polys.length).toBeGreaterThan(500)
  })

  test('points in circular arrangement', () => {
    // Circular points create many near-equal circumradii, stressing Delaunator
    const points: [number, number][] = [[50, 50]]
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * 2 * Math.PI
      points.push([50 + 40 * Math.cos(angle), 50 + 40 * Math.sin(angle)])
    }
    // Add some interior points
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 2 * Math.PI
      points.push([50 + 20 * Math.cos(angle), 50 + 20 * Math.sin(angle)])
    }
    const pattern = trianglify({
      width: 100,
      height: 100,
      points,
      seed: 'circular'
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('minimal point set forcing orient2d on collinear triple with FP rounding', () => {
    // 4 points where 3 are on y=x with mixed magnitudes (0.1 to 1e15).
    // The 4th point (off-diagonal) forces a hull where the collinear-ish
    // edge is tested during insertion, triggering orient2dadapt with
    // non-zero tails from FP rounding in the coordinate subtractions.
    const points: [number, number][] = [
      [0.1, 0.1],
      [5e14, 5e14],
      [1e15, 1e15],
      [0.1, 1e15],
    ]
    const pattern = trianglify({
      width: 1e15,
      height: 1e15,
      points,
      seed: 'orient2d-tails'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('collinear-ish points at different scales forcing adaptive arithmetic', () => {
    // Multiple points on y=x at scale 1e15 with a small offset point
    // ensures orient2d is called with triples where subtraction loses
    // low-order bits, producing non-zero error tails
    const points: [number, number][] = [
      [0.1, 0.1],
      [1e14, 1e14],
      [2e14, 2e14],
      [5e14, 5e14],
      [1e15, 1e15],
      [0.1, 1e15],       // off-diagonal anchor
      [1e15, 0.1],       // off-diagonal anchor
    ]
    const pattern = trianglify({
      width: 1e15,
      height: 1e15,
      points,
      seed: 'multi-scale-collinear'
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('points spanning huge range trigger deep orient2dadapt', () => {
    // Extreme coordinate range: some at ~0.1, others at ~1e15
    // Forces orient2dadapt into the full adaptive path (lines 160+)
    // because subtractions like 0.1 - 1e15 lose the 0.1 term entirely
    const S = 1e15
    const points: [number, number][] = [
      [0.1, 0.1],
      [S, S],
      [0.5 * S, 0.5 * S],
      [0.25 * S, 0.25 * S],
      [0.75 * S, 0.75 * S],
      [0.1, S],
      [S, 0.1],
      [0.5 * S, 0.1],
      [0.1, 0.5 * S],
    ]
    const pattern = trianglify({
      width: S,
      height: S,
      points,
      seed: 'huge-range'
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('many collinear subsets mixed with non-collinear points', () => {
    const points: [number, number][] = []
    // Horizontal lines
    for (let y = 0; y <= 100; y += 20) {
      for (let x = 0; x <= 100; x += 10) {
        points.push([x, y])
      }
    }
    const pattern = trianglify({
      width: 100,
      height: 100,
      points,
      seed: 'grid-collinear'
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })
})

describe('TrianglifyWorker (CJS coverage)', () => {
  const mockWorkerInstances: MockWorker[] = []

  class MockWorker {
    url: string
    onmessage: ((e: { data: any }) => void) | null = null
    onerror: ((e: { message: string }) => void) | null = null
    postMessage = jest.fn()
    terminate = jest.fn()
    addEventListener = jest.fn()
    removeEventListener = jest.fn()

    constructor (url: string) {
      this.url = url
      mockWorkerInstances.push(this)
    }

    simulateMessage (data: any) {
      if (this.onmessage) {
        this.onmessage({ data })
      }
    }

    simulateError (message: string) {
      if (this.onerror) {
        this.onerror({ message })
      }
    }
  }

  beforeEach(() => {
    mockWorkerInstances.length = 0
    ;(global as any).Worker = MockWorker
  })

  afterEach(() => {
    delete (global as any).Worker
  })

  const TrianglifyWorker = trianglify.TrianglifyWorker

  test('constructor creates a Worker and sets up handlers', () => {
    const tw = new TrianglifyWorker('test.worker.js')
    expect(mockWorkerInstances).toHaveLength(1)
    expect(mockWorkerInstances[0].url).toBe('test.worker.js')
    expect(mockWorkerInstances[0].onmessage).toBeInstanceOf(Function)
    expect(mockWorkerInstances[0].onerror).toBeInstanceOf(Function)
  })

  test('generate sends message and resolves on success', async () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const mock = mockWorkerInstances[0]

    const realPattern = trianglify({ seed: 'worker-gen', width: 100, height: 100 })
    const data = realPattern.toData()

    const promise = tw.generate({ seed: 'test', width: 100, height: 100 })
    expect(mock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 0, opts: expect.any(Object) })
    )

    mock.simulateMessage({ id: 0, data })
    const result = await promise
    expect(result).toBeInstanceOf(Pattern)
  })

  test('generate rejects on worker error response', async () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const mock = mockWorkerInstances[0]

    const promise = tw.generate({})
    mock.simulateMessage({ id: 0, error: 'Something went wrong' })

    await expect(promise).rejects.toThrow('Something went wrong')
  })

  test('generate rejects when worker returns neither data nor error', async () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const mock = mockWorkerInstances[0]

    const promise = tw.generate({})
    mock.simulateMessage({ id: 0 })

    await expect(promise).rejects.toThrow('Worker returned neither data nor error')
  })

  test('onerror rejects all pending promises', async () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const mock = mockWorkerInstances[0]

    const p1 = tw.generate({})
    const p2 = tw.generate({})

    mock.simulateError('Fatal error')

    await expect(p1).rejects.toThrow('Fatal error')
    await expect(p2).rejects.toThrow('Fatal error')
  })

  test('terminate rejects pending promises', async () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const mock = mockWorkerInstances[0]

    const p1 = tw.generate({})
    tw.terminate()

    expect(mock.terminate).toHaveBeenCalled()
    await expect(p1).rejects.toThrow('Worker terminated')
  })

  test('generate with already-aborted signal rejects immediately', async () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const controller = new AbortController()
    controller.abort()

    await expect(
      tw.generate({}, { signal: controller.signal })
    ).rejects.toThrow()
  })

  test('generate with abort signal that fires mid-flight', async () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const controller = new AbortController()

    const promise = tw.generate({}, { signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toThrow()
  })

  test('serializes built-in color function descriptors', () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const mock = mockWorkerInstances[0]

    const fn = trianglify.colorFunctions.sparkle(0.3)
    tw.generate({ colorFunction: fn })

    const sentOpts = mock.postMessage.mock.calls[0][0].opts
    expect(sentOpts.colorFunction).toEqual({ name: 'sparkle', args: [0.3] })
  })

  test('strips custom color functions without descriptor', () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const mock = mockWorkerInstances[0]

    const customFn = () => ({})
    tw.generate({ colorFunction: customFn as any })

    const sentOpts = mock.postMessage.mock.calls[0][0].opts
    expect(sentOpts.colorFunction).toBeUndefined()
  })

  test('onmessage ignores unknown ids', () => {
    const tw = new TrianglifyWorker('test.worker.js')
    const mock = mockWorkerInstances[0]

    expect(() => mock.simulateMessage({ id: 999, data: {} })).not.toThrow()
  })
})
