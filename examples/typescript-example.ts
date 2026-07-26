// TypeScript usage: typed options, a typed custom color function, and
// pattern caching with toData()/fromData().
//
// This file is compile-checked in CI against the published type
// declarations (see typetests/tsconfig.json), so it always matches the
// current API. Run it with any TS runner, e.g.:
//   pnpm dlx tsx examples/typescript-example.ts
import trianglify, {
  type TrianglifyOptions,
  type ColorFunction,
  type PatternData
} from 'trianglify'

// Options are fully typed — invalid keys or values are compile errors.
const opts: Partial<TrianglifyOptions> = {
  width: 800,
  height: 600,
  cellSize: 50,
  seed: 'typescript-example',
  shape: 'hexagon'
}

// A custom color function gets typed params: centroid, normalized
// coordinates, chroma scales, the point layout, and a seeded random source.
const diagonal: ColorFunction = ({ xPercent, yPercent, xScale }) =>
  xScale((xPercent + yPercent) / 2)

const pattern = trianglify({ ...opts, colorFunction: diagonal })

// Cache the generated pattern: toData() produces a JSON-safe object, and
// fromData() restores a renderable Pattern — useful for e.g. persisting
// expensive patterns or moving them out of a Web Worker.
const cached: PatternData = pattern.toData()
const restored = trianglify.Pattern.fromData(JSON.parse(JSON.stringify(cached)) as PatternData)

const svg: string = restored.toSVGTree().toString()
console.log(`generated ${String(pattern.polys.length)} polygons, ${String(svg.length)} bytes of SVG`)
