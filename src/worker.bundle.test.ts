/**
 * @jest-environment node
 */
export {}

// Executes the built worker bundle (dist/trianglify.worker.js) against a
// mock worker global scope, covering the message protocol end-to-end:
// pattern generation, color function descriptor resolution, and error
// replies. Complements src/workerClient.test.ts, which mocks the worker
// side and tests only the client.

const fs = require('fs')
const path = require('path')

const trianglify = require('../dist/trianglify.cjs')
const { Pattern } = trianglify

const workerSource = fs.readFileSync(
  path.join(__dirname, '../dist/trianglify.worker.js'),
  'utf8'
)

interface WorkerReply {
  id: number
  data?: any
  error?: string
}

interface WorkerScope {
  onmessage: ((e: { data: unknown }) => void) | null
  postMessage: (msg: WorkerReply) => void
}

// evaluate the IIFE with `self` bound to a mock scope, the same shape a
// DedicatedWorkerGlobalScope presents to the bundle
const bootWorker = () => {
  const posted: WorkerReply[] = []
  const scope: WorkerScope = {
    onmessage: null,
    postMessage: (msg) => { posted.push(msg) }
  }
  new Function('self', workerSource)(scope)
  const send = (id: number, opts: Record<string, unknown>) =>
    scope.onmessage!({ data: { id, opts } })
  return { scope, posted, send }
}

describe('worker bundle execution', () => {
  test('registers an onmessage handler on the worker scope', () => {
    const { scope } = bootWorker()
    expect(typeof scope.onmessage).toBe('function')
  })

  test('replies with serialized pattern data for valid options', () => {
    const { posted, send } = bootWorker()
    send(7, { seed: 'worker-exec', width: 200, height: 200 })

    expect(posted).toHaveLength(1)
    expect(posted[0]!.id).toBe(7)
    expect(posted[0]!.error).toBeUndefined()
    expect(posted[0]!.data.points.length).toBeGreaterThan(0)
    expect(posted[0]!.data.polys.length).toBeGreaterThan(0)
  })

  test('produces output identical to main-thread generation', () => {
    const opts = { seed: 'worker-exec', width: 200, height: 200 }
    const { posted, send } = bootWorker()
    send(0, opts)

    const restored = Pattern.fromData(posted[0]!.data)
    expect(restored.toSVGTree().toString()).toBe(
      trianglify(opts).toSVGTree().toString()
    )
  })

  test('resolves built-in color function descriptors', () => {
    const { posted, send } = bootWorker()
    send(0, { seed: 's', width: 100, height: 100, colorFunction: { name: 'sparkle', args: [0.2] } })
    expect(posted[0]!.error).toBeUndefined()

    const expected = trianglify({
      seed: 's',
      width: 100,
      height: 100,
      colorFunction: trianglify.colorFunctions.sparkle(0.2)
    })
    expect(Pattern.fromData(posted[0]!.data).toSVGTree().toString()).toBe(
      expected.toSVGTree().toString()
    )
  })

  test('accepts bare string color function descriptors', () => {
    const { posted, send } = bootWorker()
    send(0, { seed: 's', width: 100, height: 100, colorFunction: 'shadows' })
    expect(posted[0]!.error).toBeUndefined()

    const expected = trianglify({
      seed: 's',
      width: 100,
      height: 100,
      colorFunction: trianglify.colorFunctions.shadows()
    })
    expect(Pattern.fromData(posted[0]!.data).toSVGTree().toString()).toBe(
      expected.toSVGTree().toString()
    )
  })

  test('replies with an error for unknown color function names', () => {
    const { posted, send } = bootWorker()
    send(3, { width: 100, height: 100, colorFunction: { name: 'nope' } })
    expect(posted[0]).toEqual({ id: 3, error: 'Unknown color function: nope' })
  })

  test('replies with an error instead of throwing on invalid options', () => {
    const { posted, send } = bootWorker()
    expect(() => send(4, { cellSize: 0.5 })).not.toThrow()
    expect(posted[0]!.id).toBe(4)
    expect(posted[0]!.error).toMatch(/invalid cellSize/)
  })

  test('answers sequential requests with matching ids', () => {
    const { posted, send } = bootWorker()
    send(1, { seed: 'a', width: 100, height: 100 })
    send(2, { seed: 'b', width: 120, height: 120 })

    expect(posted.map(m => m.id)).toEqual([1, 2])
    expect(posted[0]!.data.opts.width).toBe(100)
    expect(posted[1]!.data.opts.width).toBe(120)
  })
})
