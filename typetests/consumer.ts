// Compile-time verification of the shipped ESM type declarations, resolved
// through the package exports map via TypeScript's self-reference support.
// Run with `tsc -p typetests` (part of `pnpm run lint:package`); requires a
// prior build. skipLibCheck is intentionally OFF so this also proves the
// declarations work for consumers who fully typecheck their dependencies.
import trianglify, {
  type TrianglifyOptions,
  type PatternData,
  type ColorFunctionDescriptor,
  type Polygon,
  type Shape,
  type Point,
  type Centroid,
  type WorkerRequest,
  type WorkerResponse
} from '@designerpawssalon/trianglify'
import 'trianglify/worker'

const opts: Partial<TrianglifyOptions> = { width: 100, height: 100, seed: 'typetest' }
const pattern = trianglify(opts)

const polys: Polygon[] = pattern.polys
const css: string = polys[0]!.color.css()
// Point and Centroid are named in public signatures (custom points,
// color-function params) and must be importable
const points: Point[] = pattern.points
const centroid: Centroid = polys[0]!.centroid
void points
void centroid

const data: PatternData = pattern.toData()
const restored = trianglify.Pattern.fromData(data)
const svgString: string = restored.toSVGTree().toString()

const shape: Shape = trianglify.defaultOptions.shape
const descriptor: ColorFunctionDescriptor | undefined =
  trianglify.colorFunctions.sparkle(0.2)._descriptor

const worker = new trianglify.TrianglifyWorker('trianglify.worker.js')
const generated: Promise<InstanceType<typeof trianglify.Pattern>> =
  worker.generate({ width: 10, height: 10 })

// createWorkerHandler builds a protocol-compatible handler for hand-rolled
// worker scripts; the request/response wire types must be importable
const responses: WorkerResponse[] = []
const handleMessage: (data: WorkerRequest | null | undefined) => void =
  trianglify.createWorkerHandler(response => { responses.push(response) })

void css
void svgString
void shape
void descriptor
void generated
void handleMessage
