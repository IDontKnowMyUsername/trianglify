/**
 * @jest-environment jsdom
 */
export {}

// Unit tests for the TrianglifyWorker client (src/workerClient.ts).
// jsdom does not implement Web Workers, so a mock Worker stands in for
// the real one — these tests exercise the client's message plumbing:
// request/response matching, error propagation, abort, and terminate.
const trianglify = require('../dist/trianglify.cjs')
const { TrianglifyWorker, Pattern } = trianglify

interface PostedMessage {
  id: number
  opts: Record<string, any>
}

class MockWorker {
  static instances: MockWorker[] = []
  url: string
  // assignable handler slots, like a real Worker — the client must NOT
  // touch these (it attaches via addEventListener), so tests can verify
  // caller-installed handlers survive
  onmessage: ((e: { data: any }) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null
  listeners: { message: Array<(e: { data: any }) => void>; error: Array<(e: { message: string }) => void> } = { message: [], error: [] }
  posted: PostedMessage[] = []
  terminated = false

  options: WorkerOptions | undefined

  constructor (url: string, options?: WorkerOptions) {
    this.url = url
    this.options = options
    MockWorker.instances.push(this)
  }

  addEventListener (type: 'message' | 'error', listener: (e: any) => void): void {
    this.listeners[type].push(listener)
  }

  postMessage (msg: PostedMessage): void {
    this.posted.push(msg)
  }

  terminate (): void {
    this.terminated = true
  }

  // test helpers simulating worker events: dispatch to the assigned
  // handler slot and to every addEventListener listener, like a real Worker
  dispatchMessage (data: unknown): void {
    this.onmessage?.({ data })
    for (const listener of this.listeners.message) listener({ data })
  }

  dispatchError (message: string): void {
    this.onerror?.({ message })
    for (const listener of this.listeners.error) listener({ message })
  }

  respond (id: number, data: unknown): void {
    this.dispatchMessage({ id, data })
  }

  respondError (id: number, error: string): void {
    this.dispatchMessage({ id, error })
  }
}

const patternData = (opts: Record<string, any> = {}) =>
  trianglify({ seed: 'mock-worker', width: 100, height: 100, ...opts }).toData()

let worker: any
let mock: MockWorker

beforeEach(() => {
  MockWorker.instances = []
  ;(globalThis as any).Worker = MockWorker
  worker = new TrianglifyWorker('fake/worker.js')
  mock = MockWorker.instances[0]!
})

afterEach(() => {
  delete (globalThis as any).Worker
})

describe('construction', () => {
  test('spawns a Worker with the given URL', () => {
    expect(MockWorker.instances).toHaveLength(1)
    expect(mock.url).toBe('fake/worker.js')
  })

  test('passes workerOptions through to the Worker constructor', () => {
    void new TrianglifyWorker('modular/worker.js', { type: 'module', name: 'tri' })
    const spawned = MockWorker.instances[1]!
    expect(spawned.url).toBe('modular/worker.js')
    expect(spawned.options).toEqual({ type: 'module', name: 'tri' })
  })

  test('accepts a pre-constructed Worker instance instead of a URL', async () => {
    const instance = new MockWorker('preconstructed.js')
    const client = new TrianglifyWorker(instance)

    // no additional Worker may be spawned for the instance
    expect(MockWorker.instances).toHaveLength(2)

    const promise = client.generate({ width: 100, height: 100 })
    instance.respond(instance.posted[0]!.id, patternData())
    await expect(promise).resolves.toBeInstanceOf(Pattern)
  })

  test('does not clobber handlers on a caller-supplied Worker', async () => {
    const instance = new MockWorker('shared.js')
    const callerHandler = jest.fn()
    instance.onmessage = callerHandler
    const client = new TrianglifyWorker(instance)

    const promise = client.generate({ width: 100, height: 100 })
    instance.respond(instance.posted[0]!.id, patternData())
    await expect(promise).resolves.toBeInstanceOf(Pattern)

    // the caller's own handler is still installed and still receives events
    expect(instance.onmessage).toBe(callerHandler)
    expect(callerHandler).toHaveBeenCalled()
  })
})

describe('generate()', () => {
  test('posts the options with sequential request ids', () => {
    worker.generate({ width: 320, cellSize: 40 }).catch(() => {})
    worker.generate({ width: 640 }).catch(() => {})

    expect(mock.posted).toHaveLength(2)
    expect(mock.posted[0]!.id).toBe(0)
    expect(mock.posted[1]!.id).toBe(1)
    expect(mock.posted[0]!.opts).toMatchObject({ width: 320, cellSize: 40 })
    expect(mock.posted[1]!.opts).toMatchObject({ width: 640 })
  })

  test('resolves with a reconstructed Pattern on worker response', async () => {
    const promise = worker.generate({ width: 100, height: 100 })
    const data = patternData()
    mock.respond(mock.posted[0]!.id, data)

    const pattern = await promise
    expect(pattern).toBeInstanceOf(Pattern)
    expect(pattern.toSVGTree().toString()).toBe(
      Pattern.fromData(data).toSVGTree().toString()
    )
  })

  test('resolves out-of-order responses to the right callers', async () => {
    const p1 = worker.generate({ width: 100 })
    const p2 = worker.generate({ width: 120 })

    mock.respond(mock.posted[1]!.id, patternData({ width: 120 }))
    mock.respond(mock.posted[0]!.id, patternData({ width: 100 }))

    expect((await p1).opts.width).toBe(100)
    expect((await p2).opts.width).toBe(120)
  })

  test('rejects when the worker reports an error', async () => {
    const promise = worker.generate({})
    mock.respondError(mock.posted[0]!.id, 'invalid cellSize: NaN')
    await expect(promise).rejects.toThrow('invalid cellSize: NaN')
  })

  test('rejects when the worker returns neither data nor error', async () => {
    const promise = worker.generate({})
    mock.dispatchMessage({ id: mock.posted[0]!.id })
    await expect(promise).rejects.toThrow('Worker returned neither data nor error')
  })

  test('rejects with the reported error even when its message is empty', async () => {
    const promise = worker.generate({})
    mock.respondError(mock.posted[0]!.id, '')

    const err = await promise.catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).not.toContain('neither data nor error')
  })

  test('rejects and cleans up when postMessage throws synchronously', async () => {
    mock.postMessage = () => {
      throw new Error('could not clone options')
    }
    const controller = new AbortController()

    await expect(
      worker.generate({}, { signal: controller.signal })
    ).rejects.toThrow('could not clone options')

    // pending map must be empty: a stale response for that id is a no-op,
    // and aborting afterwards must not throw either
    expect(() => { mock.respond(0, patternData()); }).not.toThrow()
    expect(() => { controller.abort(); }).not.toThrow()
  })

  test('ignores responses with unknown ids', async () => {
    const promise = worker.generate({})
    expect(() => { mock.respond(999, patternData()); }).not.toThrow()

    // the real response must still resolve normally afterwards
    mock.respond(mock.posted[0]!.id, patternData())
    await expect(promise).resolves.toBeInstanceOf(Pattern)
  })
})

describe('colorFunction serialization', () => {
  test('built-in color functions are posted as descriptors', () => {
    worker.generate({ colorFunction: trianglify.colorFunctions.sparkle(0.2) }).catch(() => {})
    expect(mock.posted[0]!.opts.colorFunction).toEqual({ name: 'sparkle', args: [0.2] })
  })

  test('custom color functions are omitted from the posted options', () => {
    const custom = () => null
    worker.generate({ colorFunction: custom }).catch(() => {})
    expect('colorFunction' in mock.posted[0]!.opts).toBe(false)
  })
})

describe('abort', () => {
  test('rejects immediately and posts nothing when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const promise = worker.generate({}, { signal: controller.signal })
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(mock.posted).toHaveLength(0)
  })

  test('rejects a pending generate when aborted, then ignores the late response', async () => {
    const controller = new AbortController()
    const promise = worker.generate({}, { signal: controller.signal })

    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })

    // a response arriving after abort must not throw or resurrect anything
    expect(() => { mock.respond(mock.posted[0]!.id, patternData()); }).not.toThrow()
  })

  test('aborting after resolution has no effect', async () => {
    const controller = new AbortController()
    const promise = worker.generate({}, { signal: controller.signal })
    mock.respond(mock.posted[0]!.id, patternData())

    await expect(promise).resolves.toBeInstanceOf(Pattern)
    controller.abort()
    await expect(promise).resolves.toBeInstanceOf(Pattern)
  })
})

describe('worker-level errors', () => {
  test('a worker error event rejects all pending generates', async () => {
    const p1 = worker.generate({})
    const p2 = worker.generate({})

    mock.dispatchError('worker script failed to load')

    await expect(p1).rejects.toThrow('worker script failed to load')
    await expect(p2).rejects.toThrow('worker script failed to load')
  })
})

describe('terminate()', () => {
  test('terminates the underlying worker', () => {
    worker.terminate()
    expect(mock.terminated).toBe(true)
  })

  test('rejects all pending generates', async () => {
    const p1 = worker.generate({})
    const p2 = worker.generate({})

    worker.terminate()

    await expect(p1).rejects.toThrow('Worker terminated')
    await expect(p2).rejects.toThrow('Worker terminated')
  })

  test('generate() after terminate() rejects instead of hanging', async () => {
    worker.terminate()

    await expect(worker.generate({})).rejects.toThrow('Worker terminated')
    expect(mock.posted).toHaveLength(0)
  })
})
