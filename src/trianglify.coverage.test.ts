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
    // value equality, not identity: the pattern copies user points so it
    // never aliases (or mutates) the caller's array
    expect(pattern.points).toEqual(points)
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

describe('Shape option', () => {
  const shapes = ['triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'circle'] as const
  const expectedVertexCounts: Record<string, number> = {
    pentagon: 5,
    hexagon: 6,
    heptagon: 7,
    octagon: 8
  }

  test('should throw on invalid shape values', () => {
    expect(() => trianglify({ shape: 'invalid' as any })).toThrow('invalid shape')
    expect(() => trianglify({ shape: '' as any })).toThrow('invalid shape')
  })

  shapes.forEach(shape => {
    test(`should generate a valid pattern with shape: '${shape}'`, () => {
      const pattern = trianglify({
        width: 100,
        height: 100,
        cellSize: 25,
        shape,
        seed: `shape-${shape}`
      })
      expect(pattern).toBeInstanceOf(Pattern)
      expect(pattern.polys.length).toBeGreaterThan(0)
    })
  })

  test('triangle shape should use Delaunay (3 vertices per poly)', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'triangle',
      seed: 'tri-verts'
    })
    pattern.polys.forEach((poly: { vertexIndices: number[] }) => {
      expect(poly.vertexIndices).toHaveLength(3)
    })
  })

  Object.entries(expectedVertexCounts).forEach(([shape, count]) => {
    test(`${shape} primary polys should have ${count} vertex indices`, () => {
      const pattern = trianglify({
        width: 100,
        height: 100,
        cellSize: 25,
        shape: shape as any,
        seed: `verts-${shape}`
      })
      // Primary shapes have N vertex indices; gap-filling triangles have 3
      const primaryPolys = pattern.polys.filter((p: { vertexIndices: number[] }) => p.vertexIndices.length === count)
      const gapPolys = pattern.polys.filter((p: { vertexIndices: number[] }) => p.vertexIndices.length === 3)
      expect(primaryPolys.length).toBeGreaterThan(0)
      expect(gapPolys.length).toBeGreaterThan(0)
      expect(primaryPolys.length + gapPolys.length).toBe(pattern.polys.length)
    })
  })

  test('circle polys should include circles with radius and gap-filling triangles', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'circle',
      seed: 'circle-check'
    })
    const circles = pattern.polys.filter((p: { vertexIndices: number[]; radius?: number }) =>
      p.vertexIndices.length === 0 && p.radius != null)
    const gaps = pattern.polys.filter((p: { vertexIndices: number[] }) =>
      p.vertexIndices.length === 3)
    expect(circles.length).toBeGreaterThan(0)
    expect(gaps.length).toBeGreaterThan(0)
    circles.forEach((poly: { radius?: number }) => {
      expect(poly.radius).toBeGreaterThan(0)
    })
  })

  test('shapes should be deterministic when seeded', () => {
    const p1 = trianglify({ seed: 'hex-det', shape: 'hexagon', width: 100, height: 100 })
    const p2 = trianglify({ seed: 'hex-det', shape: 'hexagon', width: 100, height: 100 })
    expect(p1.toSVGTree().toString()).toEqual(p2.toSVGTree().toString())
  })

  test('hexagon with grid should produce honeycomb offset', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      variance: 0,
      shape: 'hexagon',
      pointGeneration: 'grid',
      seed: 'honeycomb'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })
})

describe('Shape SVG rendering', () => {
  test('circle shape should render <circle> and gap-filling <path> elements in SVG', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'circle',
      seed: 'svg-circle'
    })
    const svgStr = pattern.toSVGTree().toString()
    expect(svgStr).toContain('<circle')
    expect(svgStr).toContain('cx=')
    expect(svgStr).toContain('cy=')
    expect(svgStr).toContain('r=')
    // Gap-filling triangles are rendered as <path> elements
    expect(svgStr).toContain('<path')
  })

  test('hexagon shape should render <path> elements including hexagons and gap triangles', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'hexagon',
      seed: 'svg-hex'
    })
    const svgStr = pattern.toSVGTree().toString()
    expect(svgStr).toContain('<path')
    const paths = svgStr.match(/ d='[^']+'/g)
    expect(paths).not.toBeNull()
    // Hexagon paths have M + 5 L + Z; gap triangles have M + 2 L + Z
    const hexPaths = paths!.filter((d: string) => (d.match(/L/g) || []).length === 5)
    const gapPaths = paths!.filter((d: string) => (d.match(/L/g) || []).length === 2)
    expect(hexPaths.length).toBeGreaterThan(0)
    expect(gapPaths.length).toBeGreaterThan(0)
  })

  test('circle shape SVG with stroke', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'circle',
      strokeWidth: 2,
      strokeColor: '#ff0000',
      seed: 'svg-circle-stroke'
    })
    const svgStr = pattern.toSVGTree().toString()
    expect(svgStr).toContain('stroke=')
    expect(svgStr).toContain('stroke-width')
  })
})

describe('Shape canvas rendering', () => {
  test('circle shape renders to canvas without error', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'circle',
      seed: 'canvas-circle'
    })
    const canvas = pattern.toCanvas()
    expect(canvas).toBeDefined()
  })

  test('hexagon shape renders to canvas without error', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'hexagon',
      seed: 'canvas-hex'
    })
    const canvas = pattern.toCanvas()
    expect(canvas).toBeDefined()
  })

  test('pentagon shape renders to canvas with stroke', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'pentagon',
      strokeWidth: 2,
      seed: 'canvas-pent-stroke'
    })
    const canvas = pattern.toCanvas()
    expect(canvas).toBeDefined()
  })
})

describe('Shape serialization', () => {
  test('toData/fromData roundtrip with hexagon shape', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'hexagon',
      seed: 'ser-hex'
    })
    const data = pattern.toData()
    expect(data.opts.shape).toBe('hexagon')
    const restored = Pattern.fromData(data)
    expect(restored.toSVGTree().toString()).toEqual(pattern.toSVGTree().toString())
  })

  test('toData/fromData roundtrip with circle shape', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      shape: 'circle',
      seed: 'ser-circle'
    })
    const data = pattern.toData()
    expect(data.opts.shape).toBe('circle')
    const circlePolys = data.polys.filter((p: { radius?: number }) => p.radius != null)
    expect(circlePolys.length).toBeGreaterThan(0)
    circlePolys.forEach((poly: { radius?: number }) => {
      expect(poly.radius).toBeGreaterThan(0)
    })
    const restored = Pattern.fromData(data)
    expect(restored.toSVGTree().toString()).toEqual(pattern.toSVGTree().toString())
  })
})

describe('Spiral point generation', () => {
  test('should generate a pattern with spiral point generation', () => {
    const pattern = trianglify({
      width: 200,
      height: 200,
      cellSize: 30,
      pointGeneration: 'spiral',
      seed: 'spiral-test'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.points.length).toBeGreaterThan(10)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('spiral should be deterministic when seeded', () => {
    const p1 = trianglify({ seed: 'spiral-det', pointGeneration: 'spiral', width: 100, height: 100 })
    const p2 = trianglify({ seed: 'spiral-det', pointGeneration: 'spiral', width: 100, height: 100 })
    expect(p1.toSVGTree().toString()).toEqual(p2.toSVGTree().toString())
  })

  test('spiral with clockwise direction', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      pointGeneration: 'spiral',
      spiralDirection: 'cw',
      seed: 'spiral-cw'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('spiral with counterclockwise direction', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      pointGeneration: 'spiral',
      spiralDirection: 'ccw',
      seed: 'spiral-ccw'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('cw and ccw spirals should produce different patterns', () => {
    const cw = trianglify({ seed: 'dir-test', pointGeneration: 'spiral', spiralDirection: 'cw', width: 100, height: 100 })
    const ccw = trianglify({ seed: 'dir-test', pointGeneration: 'spiral', spiralDirection: 'ccw', width: 100, height: 100 })
    expect(cw.toSVGTree().toString()).not.toEqual(ccw.toSVGTree().toString())
  })

  test('spiral with golden ratio (default)', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      pointGeneration: 'spiral',
      spiralRatio: 'golden',
      seed: 'spiral-golden'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('spiral with custom numeric ratio', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      pointGeneration: 'spiral',
      spiralRatio: 2,
      seed: 'spiral-ratio-2'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('different ratios should produce different patterns', () => {
    const golden = trianglify({ seed: 'ratio-test', pointGeneration: 'spiral', spiralRatio: 'golden', width: 100, height: 100 })
    const two = trianglify({ seed: 'ratio-test', pointGeneration: 'spiral', spiralRatio: 2, width: 100, height: 100 })
    expect(golden.toSVGTree().toString()).not.toEqual(two.toSVGTree().toString())
  })

  test('spiral combined with hexagon shape', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      pointGeneration: 'spiral',
      shape: 'hexagon',
      seed: 'spiral-hex'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('spiral with zero variance', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      variance: 0,
      pointGeneration: 'spiral',
      seed: 'spiral-novar'
    })
    expect(pattern.points.length).toBeGreaterThan(3)
  })
})

describe('Spiral option validation', () => {
  test('should throw on invalid spiralDirection', () => {
    expect(() => trianglify({ spiralDirection: 'invalid' as any })).toThrow('invalid spiralDirection')
  })

  test('should throw on invalid spiralRatio', () => {
    expect(() => trianglify({ spiralRatio: 0 })).toThrow('invalid spiralRatio')
    expect(() => trianglify({ spiralRatio: -1 })).toThrow('invalid spiralRatio')
    expect(() => trianglify({ spiralRatio: NaN as any })).toThrow('invalid spiralRatio')
    expect(() => trianglify({ spiralRatio: 'invalid' as any })).toThrow('invalid spiralRatio')
  })

  test('should accept valid spiral options', () => {
    expect(() => trianglify({ pointGeneration: 'spiral', spiralDirection: 'cw', spiralRatio: 'golden', seed: 'valid' })).not.toThrow()
    expect(() => trianglify({ pointGeneration: 'spiral', spiralDirection: 'ccw', spiralRatio: 3, seed: 'valid2' })).not.toThrow()
  })
})

describe('Sphere point generation', () => {
  test('should generate a pattern with sphere point generation', () => {
    const pattern = trianglify({
      width: 200,
      height: 200,
      cellSize: 30,
      pointGeneration: 'sphere',
      seed: 'sphere-test'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.points.length).toBeGreaterThan(10)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('sphere should be deterministic when seeded', () => {
    const p1 = trianglify({ seed: 'sphere-det', pointGeneration: 'sphere', width: 100, height: 100 })
    const p2 = trianglify({ seed: 'sphere-det', pointGeneration: 'sphere', width: 100, height: 100 })
    expect(p1.toSVGTree().toString()).toEqual(p2.toSVGTree().toString())
  })

  test('sphere with zero variance', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      variance: 0,
      pointGeneration: 'sphere',
      seed: 'sphere-novar'
    })
    expect(pattern.points.length).toBeGreaterThan(3)
  })

  test('sphere combined with circle shape', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      cellSize: 25,
      pointGeneration: 'sphere',
      shape: 'circle',
      seed: 'sphere-circle'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })
})

describe('Radial and angular color functions', () => {
  test('should export radial color function', () => {
    expect(trianglify.colorFunctions.radial).toBeInstanceOf(Function)
  })

  test('should export angular color function', () => {
    expect(trianglify.colorFunctions.angular).toBeInstanceOf(Function)
  })

  test('radial color function generates valid pattern', () => {
    const pattern = trianglify({
      colorFunction: trianglify.colorFunctions.radial(),
      seed: 'radial-test'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('radial with custom falloff', () => {
    const pattern = trianglify({
      colorFunction: trianglify.colorFunctions.radial(0.5),
      seed: 'radial-falloff'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('angular color function generates valid pattern', () => {
    const pattern = trianglify({
      colorFunction: trianglify.colorFunctions.angular(),
      seed: 'angular-test'
    })
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.polys.length).toBeGreaterThan(0)
  })

  test('angular with custom offset', () => {
    const pattern = trianglify({
      colorFunction: trianglify.colorFunctions.angular(Math.PI / 4),
      seed: 'angular-offset'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('radial color function has serializable descriptor', () => {
    const fn = trianglify.colorFunctions.radial(0.5)
    expect(fn._descriptor).toEqual({ name: 'radial', args: [0.5] })
  })

  test('angular color function has serializable descriptor', () => {
    const fn = trianglify.colorFunctions.angular(1.0)
    expect(fn._descriptor).toEqual({ name: 'angular', args: [1.0] })
  })

  test('radial with spiral layout', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      pointGeneration: 'spiral',
      colorFunction: trianglify.colorFunctions.radial(),
      seed: 'radial-spiral'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })

  test('angular with spiral layout', () => {
    const pattern = trianglify({
      width: 100,
      height: 100,
      pointGeneration: 'spiral',
      colorFunction: trianglify.colorFunctions.angular(),
      seed: 'angular-spiral'
    })
    expect(pattern).toBeInstanceOf(Pattern)
  })
})

describe('caller-supplied points', () => {
  test('input array is not mutated by polygon shape generation', () => {
    const inputPoints: Array<[number, number]> = []
    for (let x = 0; x <= 100; x += 25) {
      for (let y = 0; y <= 100; y += 25) {
        inputPoints.push([x, y])
      }
    }
    const snapshot = JSON.stringify(inputPoints)

    trianglify({ width: 100, height: 100, points: inputPoints, shape: 'pentagon', seed: 'no-mutate' })
    trianglify({ width: 100, height: 100, points: inputPoints, shape: 'circle', seed: 'no-mutate' })
    trianglify({ width: 100, height: 100, points: inputPoints, shape: 'triangle', seed: 'no-mutate' })

    expect(inputPoints).toHaveLength(25)
    expect(JSON.stringify(inputPoints)).toBe(snapshot)
  })
})

describe('falsy seeds', () => {
  const svg = (seed: string | number) =>
    trianglify({ seed, width: 100, height: 100 }).toSVGTree().toString()

  test('seed: 0 is deterministic', () => {
    expect(svg(0)).toEqual(svg(0))
  })

  test("seed: '' is deterministic", () => {
    expect(svg('')).toEqual(svg(''))
  })

  test('numeric seeds are deterministic and distinct', () => {
    expect(svg(42)).toEqual(svg(42))
    expect(svg(0)).not.toEqual(svg(1))
  })

  test('numeric seed matches its string form', () => {
    expect(svg(42)).toEqual(svg('42'))
  })
})

describe('option validation edge cases', () => {
  test('rejects non-numeric width and height', () => {
    expect(() => trianglify({ width: '600' })).toThrow('invalid width')
    expect(() => trianglify({ height: '400' })).toThrow('invalid height')
    expect(() => trianglify({ width: Infinity })).toThrow('invalid width')
  })

  test('rejects xColors: false at runtime', () => {
    expect(() => trianglify({ xColors: false })).toThrow('invalid xColors')
  })

  test('rejects custom points for tiling shapes', () => {
    const pts: Array<[number, number]> = [[0, 0], [50, 0], [0, 50], [50, 50]]
    expect(() =>
      trianglify({ width: 100, height: 100, shape: 'pentagon-cairo', points: pts })
    ).toThrow('custom points are not supported')
  })
})

describe('SVG attribute escaping', () => {
  test('escapes quotes in user-supplied strokeColor', () => {
    const pattern = trianglify({
      seed: 'escape',
      width: 100,
      height: 100,
      fill: false,
      strokeWidth: 1,
      strokeColor: "red' onload='alert(1)"
    })
    const svgString = pattern.toSVGTree().toString()
    expect(svgString).not.toContain("stroke='red' onload=")
    expect(svgString).toContain('&apos;')
  })
})

describe('angular color function wrapping', () => {
  test('negative offsets wrap instead of clamping at the scale ends', () => {
    const base = { seed: 'angular-wrap', width: 100, height: 100 }
    const a = trianglify({ ...base, colorFunction: trianglify.colorFunctions.angular(-1) })
    const b = trianglify({ ...base, colorFunction: trianglify.colorFunctions.angular(-1 + 2 * Math.PI) })
    expect(a.toSVGTree().toString()).toEqual(b.toSVGTree().toString())
  })
})

describe('sphere layout canvas coverage', () => {
  const inTriangle = (
    px: number, py: number,
    [ax, ay]: number[], [bx, by]: number[], [cx, cy]: number[]
  ): boolean => {
    const d1 = (px - bx!) * (ay! - by!) - (ax! - bx!) * (py - by!)
    const d2 = (px - cx!) * (by! - cy!) - (bx! - cx!) * (py - cy!)
    const d3 = (px - ax!) * (cy! - ay!) - (cx! - ax!) * (py - ay!)
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0
    return !(hasNeg && hasPos)
  }

  test('triangulation covers all four canvas corners', () => {
    const width = 600
    const height = 400
    const pattern = trianglify({
      width,
      height,
      cellSize: 25,
      pointGeneration: 'sphere',
      seed: 'sphere-corners'
    })
    const corners = [[0, 0], [width, 0], [0, height], [width, height]]
    corners.forEach(([px, py]) => {
      const covered = pattern.polys.some((poly: { vertexIndices: number[] }) => {
        const [a, b, c] = poly.vertexIndices.map((i: number) => pattern.points[i])
        return inTriangle(px!, py!, a, b, c)
      })
      expect(covered).toBe(true)
    })
  })
})

describe('colorSpace option', () => {
  const spaces = ['rgb', 'hsv', 'hsl', 'hsi', 'lab', 'hcl', 'oklab', 'oklch']

  test('generates valid patterns in every supported color space', () => {
    spaces.forEach(colorSpace => {
      const pattern = trianglify({ seed: 'colorspace', width: 100, height: 100, colorSpace })
      expect(pattern.polys.length).toBeGreaterThan(0)
      pattern.polys.forEach((poly: { color: { css: () => string } }) => {
        expect(poly.color.css()).toMatch(/^(rgb|hsl|#)/)
      })
    })
  })

  test('different color spaces interpolate differently', () => {
    const svgFor = (colorSpace: string) =>
      trianglify({ seed: 'colorspace', width: 100, height: 100, colorSpace }).toSVGTree().toString()
    expect(svgFor('rgb')).not.toEqual(svgFor('lab'))
  })
})

describe('Point count invariant across pointGeneration modes', () => {
  // every mode must emit the count defined by the shared grid-density
  // contract in src/utils/geom.ts, so modes are interchangeable at a
  // given cellSize
  const gridCount = (w: number, h: number, c: number) =>
    (Math.floor(w / c) + 4) * (Math.floor(h / c) + 4)
  const modes = ['grid', 'poisson', 'bestCandidate', 'spiral', 'sphere'] as const
  const configs = [
    { width: 600, height: 400, cellSize: 75 },
    { width: 200, height: 200, cellSize: 30 }
  ]

  configs.forEach(({ width, height, cellSize }) => {
    modes.forEach(mode => {
      test(`${mode} emits ${gridCount(width, height, cellSize)} points at ${width}x${height}/${cellSize}`, () => {
        const pattern = trianglify({
          width,
          height,
          cellSize,
          pointGeneration: mode,
          seed: `count-${mode}`
        })
        expect(pattern.points.length).toBe(gridCount(width, height, cellSize))
      })
    })
  })
})

describe('Hexagon honeycomb layout', () => {
  // Even-odd ray-casting point-in-polygon test
  const pointInPoly = (x: number, y: number, verts: number[][]): boolean => {
    let inside = false
    for (let k = 0, m = verts.length - 1; k < verts.length; m = k++) {
      const xi = verts[k]![0]!
      const yi = verts[k]![1]!
      const xm = verts[m]![0]!
      const ym = verts[m]![1]!
      if ((yi > y) !== (ym > y) && x < ((xm - xi) * (y - yi)) / (ym - yi) + xi) {
        inside = !inside
      }
    }
    return inside
  }

  // Shoelace area of a polygon
  const polyArea = (verts: number[][]): number => {
    let sum = 0
    for (let k = 0; k < verts.length; k++) {
      const v = verts[k]!
      const w = verts[(k + 1) % verts.length]!
      sum += v[0]! * w[1]! - w[0]! * v[1]!
    }
    return Math.abs(sum) / 2
  }

  const WIDTH = 200
  const HEIGHT = 150
  const CELL = 40

  const generate = () => trianglify({
    width: WIDTH,
    height: HEIGHT,
    cellSize: CELL,
    shape: 'hexagon',
    variance: 0,
    seed: 'hex-honeycomb'
  })

  test('primary hexagons cover the artboard with no gaps or overlaps at variance 0', () => {
    const pattern = generate()
    const hexes = pattern.polys
      .filter((p: { vertexIndices: number[] }) => p.vertexIndices.length === 6)
      .map((p: { vertexIndices: number[] }) => p.vertexIndices.map((i: number) => pattern.points[i]))
    // Every sample point in the visible canvas must fall inside exactly
    // one hexagon: 0 means a gap, 2+ means an overlap. The fractional
    // offsets keep samples away from hexagon edges and vertices.
    const N = 13
    const uncovered: string[] = []
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = (i + 0.271828) * (WIDTH / N)
        const y = (j + 0.577215) * (HEIGHT / N)
        let count = 0
        for (const verts of hexes) {
          if (pointInPoly(x, y, verts)) count++
        }
        if (count !== 1) uncovered.push(`(${x.toFixed(1)}, ${y.toFixed(1)}) covered ${count}x`)
      }
    }
    expect(uncovered).toEqual([])
  })

  test('gap-filling triangles inside the artboard are degenerate slivers at variance 0', () => {
    const pattern = generate()
    // genuine gap triangles exist at the honeycomb's jagged outer boundary,
    // but that lies in the bleed zone — inside the artboard the tiling is
    // exact, so any gap-fill triangles are floating-point slivers with
    // essentially zero area
    const gapArea = pattern.polys
      .filter((p: { vertexIndices: number[] }) => p.vertexIndices.length === 3)
      .filter((p: { centroid: { x: number; y: number } }) =>
        p.centroid.x >= 0 && p.centroid.x <= WIDTH && p.centroid.y >= 0 && p.centroid.y <= HEIGHT)
      .reduce((sum: number, p: { vertexIndices: number[] }) =>
        sum + polyArea(p.vertexIndices.map((i: number) => pattern.points[i])), 0)
    expect(gapArea).toBeLessThan(WIDTH * HEIGHT * 0.001)
  })

  test('hexagon rows use honeycomb spacing of (sqrt(3)/2) * cellSize', () => {
    const pattern = generate()
    const rowYs = [...new Set(
      pattern.polys
        .filter((p: { vertexIndices: number[] }) => p.vertexIndices.length === 6)
        .map((p: { centroid: { y: number } }) => p.centroid.y)
    )].sort((a, b) => (a as number) - (b as number)) as number[]
    expect(rowYs.length).toBeGreaterThan(2)
    const expected = CELL * Math.sqrt(3) / 2
    for (let i = 1; i < rowYs.length; i++) {
      expect(rowYs[i]! - rowYs[i - 1]!).toBeCloseTo(expected, 6)
    }
  })
})

describe('Palette and color option validation', () => {
  test('should throw on a non-object palette', () => {
    expect(() => trianglify({ palette: 'YlGn' })).toThrow('invalid palette')
    expect(() => trianglify({ palette: null })).toThrow('invalid palette')
  })

  test('should throw on an empty palette object', () => {
    expect(() => trianglify({ palette: {} })).toThrow('invalid palette')
  })

  test('should throw on an empty palette array', () => {
    expect(() => trianglify({ palette: [] })).toThrow('invalid palette')
  })

  test('should throw on a palette entry that is not an array', () => {
    expect(() => trianglify({ palette: { Bad: 'red' } })).toThrow('invalid palette entry')
  })

  test('should throw on a palette entry with no colors', () => {
    expect(() => trianglify({ palette: { Bad: [] } })).toThrow('invalid palette entry')
  })

  test('should throw on non-string palette colors', () => {
    expect(() => trianglify({ palette: { Bad: ['#ffffff', 42] } })).toThrow('invalid palette color')
  })

  test('should throw on an empty xColors array', () => {
    expect(() => trianglify({ xColors: [] })).toThrow('invalid xColors')
  })

  test('should throw on non-string xColors entries', () => {
    expect(() => trianglify({ xColors: ['#ffffff', 5] })).toThrow('invalid xColors entry')
  })

  test('should throw on an empty yColors array', () => {
    expect(() => trianglify({ yColors: [] })).toThrow('invalid yColors')
  })

  test('should throw on non-string yColors entries', () => {
    expect(() => trianglify({ yColors: [null] })).toThrow('invalid yColors entry')
  })

  test('single-entry palettes and short color arrays still work', () => {
    const pattern = trianglify({
      palette: { only: ['#a0a0a0', '#303030'] },
      seed: 'single-palette',
      width: 100,
      height: 100
    })
    expect(pattern.polys.length).toBeGreaterThan(0)
  })
})

describe('immutability of shared defaults', () => {
  test('colorbrewer palette map is deeply frozen', () => {
    expect(Object.isFrozen(trianglify.utils.colorbrewer)).toBe(true)
    expect(Object.isFrozen(trianglify.utils.colorbrewer.YlGn)).toBe(true)
    // mutating the shared default palette must throw, not silently change
    // every future pattern
    expect(() => trianglify.utils.colorbrewer.YlGn.push('#ffffff')).toThrow()
  })

  test('defaultOptions is frozen', () => {
    expect(Object.isFrozen(trianglify.defaultOptions)).toBe(true)
  })
})

describe('point count allocation guard', () => {
  test('rejects width/height/cellSize combinations that explode the point grid', () => {
    expect(() => trianglify({ width: 100000, height: 100000, cellSize: 1 })).toThrow('increase cellSize')
  })

  test('accounts for per-center vertex emission of circle shapes', () => {
    // 646,416 grid centers pass a center-count-only guard, but each circle
    // appends 24 gap-computation vertices — ~16M points that previously
    // crashed deep in generation (Map maximum size exceeded)
    expect(() => trianglify({ width: 4000, height: 4000, cellSize: 5, shape: 'circle' }))
      .toThrow('increase cellSize')
  })

  test('accounts for regular-polygon vertex emission', () => {
    expect(() => trianglify({ width: 2500, height: 2500, cellSize: 5, shape: 'pentagon' }))
      .toThrow('increase cellSize')
  })

  test('accounts for pentagonal tiling density', () => {
    // ~92k lattice centers pass a center-count-only guard, but the tiling
    // allocates ~6.5M raw pentagon vertices — a multi-second hang
    expect(() => trianglify({ width: 3000, height: 3000, cellSize: 10, shape: 'pentagon-nonconvex' }))
      .toThrow('increase cellSize')
  })

  test('accounts for honeycomb row spacing of hexagon grids', () => {
    // square-grid rows would count 957,816 centers (under the cap); the
    // honeycomb packs rows √3/2 apart and each hexagon appends 6 vertices
    expect(() => trianglify({ width: 1000, height: 950, cellSize: 1, shape: 'hexagon' }))
      .toThrow('increase cellSize')
  })

  test('accepts large but renderable non-triangle patterns', () => {
    expect(() => trianglify({ seed: 'guard-ok', width: 1920, height: 1080, cellSize: 75, shape: 'circle' })).not.toThrow()
    expect(() => trianglify({ seed: 'guard-ok', width: 1920, height: 1080, cellSize: 75, shape: 'pentagon-cairo' })).not.toThrow()
  })

  test('custom points bypass the generation-size guard', () => {
    const points: Array<[number, number]> = [[0, 0], [50000, 0], [0, 50000], [50000, 50000]]
    expect(() => trianglify({ width: 100000, height: 100000, cellSize: 1, points })).not.toThrow()
  })
})

describe('render option validation', () => {
  const pattern = () => trianglify({ seed: 'render-opts', width: 50, height: 50 })

  test('rejects unknown SVG option keys', () => {
    expect(() => pattern().toSVGTree({ decimals: 2 } as any)).toThrow('Unrecognized SVG option: decimals')
  })

  test('rejects malformed coordinateDecimals instead of emitting NaN paths', () => {
    // 10 ** 400 is Infinity — before validation this silently produced
    // d='MNaN,NaN…' output
    expect(() => pattern().toSVGTree({ coordinateDecimals: 400 })).toThrow('invalid coordinateDecimals')
    expect(() => pattern().toSVGTree({ coordinateDecimals: NaN })).toThrow('invalid coordinateDecimals')
    expect(() => pattern().toSVGTree({ coordinateDecimals: 1.5 })).toThrow('invalid coordinateDecimals')
  })

  test('rejects non-boolean includeNamespace', () => {
    expect(() => pattern().toSVGTree({ includeNamespace: 'yes' } as any)).toThrow('invalid includeNamespace')
  })

  test('coordinateDecimals bounds the decimals actually emitted', () => {
    const svg = pattern().toSVGTree({ coordinateDecimals: 3 }).toString()
    const numbers = svg.match(/-?\d+(\.\d+)?/g)!
    expect(numbers.length).toBeGreaterThan(0)
    for (const n of numbers) {
      const frac = n.split('.')[1] ?? ''
      expect(frac.length).toBeLessThanOrEqual(3)
    }
  })

  test('rejects unknown canvas option keys and malformed values', () => {
    expect(() => pattern().toCanvas(undefined, { scale: 2 } as any)).toThrow('Unrecognized canvas option: scale')
    expect(() => pattern().toCanvas(undefined, { scaling: -2 })).toThrow('invalid scaling')
    expect(() => pattern().toCanvas(undefined, { scaling: NaN })).toThrow('invalid scaling')
    expect(() => pattern().toCanvas(undefined, { applyCssScaling: 1 } as any)).toThrow('invalid applyCssScaling')
  })
})

describe('canvas error paths', () => {
  test('throws a helpful error when the canvas package is unavailable', () => {
    jest.isolateModules(() => {
      jest.doMock('canvas', () => { throw new Error("Cannot find module 'canvas'") })
      const fresh = require('../dist/trianglify.cjs')
      const pattern = fresh({ seed: 'no-canvas', width: 50, height: 50 })
      expect(() => pattern.toCanvas()).toThrow('requires either a browser environment')
      jest.dontMock('canvas')
    })
  })

  test('throws when the destination canvas cannot provide a 2D context', () => {
    const pattern = trianglify({ seed: 'no-ctx', width: 50, height: 50 })
    const badCanvas = { getContext: () => null } as any
    expect(() => pattern.toCanvas(badCanvas)).toThrow('Could not acquire 2D rendering context')
  })
})

describe('colorOutput option', () => {
  const base = { seed: 'color-output', width: 100, height: 100 }

  test("'rgb' (the default) emits 8-bit rgb() strings", () => {
    const pattern = trianglify(base)
    pattern.polys.forEach((poly: { color: { css: () => string } }) => {
      expect(poly.color.css()).toMatch(/^rgb\(\d+ \d+ \d+\)$/)
    })
  })

  test("'oklch' emits decimal-precision oklch() strings", () => {
    const pattern = trianglify({ ...base, colorOutput: 'oklch' })
    pattern.polys.forEach((poly: { color: { css: () => string } }) => {
      expect(poly.color.css()).toMatch(/^oklch\(/)
    })
  })

  test("'display-p3' emits color(display-p3 …) strings with channels clamped to [0, 1]", () => {
    const pattern = trianglify({ ...base, colorOutput: 'display-p3' })
    pattern.polys.forEach((poly: { color: { css: () => string } }) => {
      const css = poly.color.css()
      expect(css).toMatch(/^color\(display-p3 /)
      const channels = css.slice('color(display-p3 '.length).replace(/[)/].*$/, '').trim().split(/\s+/).map(Number)
      channels.forEach((c: number) => {
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(1)
      })
    })
  })

  test('rejects invalid colorOutput values', () => {
    expect(() => trianglify({ ...base, colorOutput: 'p3' })).toThrow('invalid colorOutput')
    expect(() => trianglify({ ...base, colorOutput: 42 })).toThrow('invalid colorOutput')
  })

  test('colorOutput round-trips through toData/fromData', () => {
    const pattern = trianglify({ ...base, colorOutput: 'oklch' })
    const data = pattern.toData()
    expect(data.opts.colorOutput).toBe('oklch')
    const restored = Pattern.fromData(JSON.parse(JSON.stringify(data)))
    expect(restored.toSVGTree().toString()).toEqual(pattern.toSVGTree().toString())
  })

  test('fromData rejects malformed colorOutput but accepts absent (legacy data)', () => {
    const data = trianglify(base).toData()
    expect(() => Pattern.fromData({ ...data, opts: { ...data.opts, colorOutput: 'cmyk' } })).toThrow('opts.colorOutput')
    const legacy = { ...data, opts: { ...data.opts } }
    delete legacy.opts.colorOutput
    expect(Pattern.fromData(legacy)).toBeInstanceOf(Pattern)
  })

  test('toCanvas throws for wide-gamut output in Node instead of rendering black', () => {
    for (const colorOutput of ['oklch', 'display-p3']) {
      const pattern = trianglify({ ...base, colorOutput })
      expect(() => pattern.toCanvas()).toThrow('node-canvas does not support')
    }
    // restored patterns carry colorOutput across the serialization boundary
    const restored = Pattern.fromData(trianglify({ ...base, colorOutput: 'oklch' }).toData())
    expect(() => restored.toCanvas()).toThrow('node-canvas does not support')
  })
})

describe('colorQuantization option', () => {
  const base = { seed: 'quantization', width: 100, height: 100 }

  test('rejects malformed values', () => {
    expect(() => trianglify({ ...base, colorQuantization: 0 })).toThrow('invalid colorQuantization')
    expect(() => trianglify({ ...base, colorQuantization: 1 })).toThrow('invalid colorQuantization')
    expect(() => trianglify({ ...base, colorQuantization: 2.5 })).toThrow('invalid colorQuantization')
    expect(() => trianglify({ ...base, colorQuantization: true })).toThrow('invalid colorQuantization')
    expect(() => trianglify({ ...base, colorQuantization: 2 ** 21 })).toThrow('invalid colorQuantization')
  })

  test('false disables quantization, explicit step counts work', () => {
    const exact = trianglify({ ...base, colorQuantization: false })
    const coarse = trianglify({ ...base, colorQuantization: 2 })
    expect(exact.polys.length).toBeGreaterThan(0)
    expect(coarse.polys.length).toBeGreaterThan(0)
    // a 2-step scale collapses colors far more than the default — the
    // patterns must differ, proving the option reaches the scales
    expect(coarse.toSVGTree().toString()).not.toEqual(exact.toSVGTree().toString())
  })

  test('default quantization stays within one 8-bit channel step of exact', () => {
    const parseRgb = (css: string): number[] => css.match(/\d+/g)!.map(Number)
    const quantized = trianglify(base)
    const exact = trianglify({ ...base, colorQuantization: false })
    quantized.polys.forEach((poly: { color: { css: () => string } }, i: number) => {
      const q = parseRgb(poly.color.css())
      const e = parseRgb(exact.polys[i].color.css())
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(q[c]! - e[c]!)).toBeLessThanOrEqual(1)
      }
    })
  })
})

describe('color utils and custom color functions', () => {
  test('utils.mix blends colors and utils.css serializes them', () => {
    const mixed = trianglify.utils.mix('#ff0000', '#0000ff', 0.5)
    expect(typeof mixed).toBe('object')
    expect(typeof mixed.mode).toBe('string')
    expect(trianglify.utils.css(mixed)).toMatch(/^rgb\(\d+ \d+ \d+\)$/)
    expect(trianglify.utils.css(mixed, 'oklch')).toMatch(/^oklch\(/)
    expect(trianglify.utils.css('#ff0000', 'display-p3')).toMatch(/^color\(display-p3 /)
  })

  test('utils.mix defaults and custom spaces', () => {
    const a = trianglify.utils.css(trianglify.utils.mix('red', 'blue'))
    const b = trianglify.utils.css(trianglify.utils.mix('red', 'blue', 0.5, 'rgb'))
    expect(a).toMatch(/^rgb\(/)
    expect(b).toMatch(/^rgb\(/)
    expect(a).not.toEqual(b) // lab vs rgb interpolation differ
  })

  test('unparseable colors throw a TypeError', () => {
    expect(() => trianglify.utils.mix('not-a-color', 'red')).toThrow('invalid color')
    expect(() => trianglify.utils.css('not-a-color')).toThrow('invalid color')
  })

  test('alpha survives rgb serialization', () => {
    expect(trianglify.utils.css('rgba(255 0 0 / 0.5)')).toMatch(/^rgb\(255 0 0 \/ 0\.5\)$/)
  })

  test('a color function returning a CSS string passes through untouched', () => {
    const pattern = trianglify({
      seed: 'string-color',
      width: 100,
      height: 100,
      colorFunction: () => 'papayawhip'
    })
    pattern.polys.forEach((poly: { color: { css: () => string } }) => {
      expect(poly.color.css()).toBe('papayawhip')
    })
  })

  test('single-color scales produce a constant gradient', () => {
    const pattern = trianglify({
      seed: 'single-color',
      width: 100,
      height: 100,
      xColors: ['#3498db'],
      yColors: 'match'
    })
    const colors = new Set(pattern.polys.map((p: { color: { css: () => string } }) => p.color.css()))
    expect(colors.size).toBe(1)
  })
})
