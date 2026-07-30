// Compile-time verification of the shipped CJS type declarations
// (dist/trianglify.d.cts, resolved via the "require" exports condition).
// The export = shape must be callable and carry the named types through
// the merged namespace.
import trianglify = require('@designerpawssalon/trianglify')

const pattern = trianglify({ width: 100, height: 100, seed: 'typetest-cjs' })
const svgString: string = pattern.toSVGTree().toString()

const opts: trianglify.TrianglifyOptions = { ...trianglify.defaultOptions }
const data: trianglify.PatternData = pattern.toData()
const restored = trianglify.Pattern.fromData(data)

// the runtime sets module.exports.default = module.exports — the types
// must reflect that self-reference
const viaDefault: typeof trianglify = trianglify.default

// the worker protocol surface must carry through the merged namespace
const handleMessage = trianglify.createWorkerHandler((response: trianglify.WorkerResponse) => { void response })
const request: trianglify.WorkerRequest = { id: 1, opts: { width: 10 } }
handleMessage(request)

void svgString
void opts
void data
void restored
void viaDefault
