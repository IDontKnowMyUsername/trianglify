/*
 * Worker-side implementation of the TrianglifyWorker message protocol.
 *
 * This lives outside the worker entry point (worker.ts) so it is bundled
 * into the main entry and measured by coverage — worker.ts itself is
 * executed only as a built IIFE, which the coverage remap cannot see. It is
 * exposed publicly as `trianglify.createWorkerHandler` so hand-rolled
 * worker scripts (e.g. bundlers that compile workers from the consumer's
 * own source) stay protocol-compatible with the TrianglifyWorker client.
 */

import * as colorFunctions from './utils/colorFunctions'
import type Pattern from './pattern'
import type { ColorFunction, ColorFunctionDescriptor, TrianglifyOptions, WorkerRequest, WorkerResponse } from './types'

type ColorFunctionName = keyof typeof colorFunctions

// injected rather than imported to keep this module free of a circular
// dependency on the main entry, which imports it to build the public
// `trianglify.createWorkerHandler`
type GenerateFn = (opts?: Partial<TrianglifyOptions>) => Pattern

const resolveColorFunction = (descriptor: ColorFunctionDescriptor | string | undefined): ColorFunction | undefined => {
  if (!descriptor) return undefined
  // wire data: the descriptor's declared type is not trusted, so name/args
  // are handled as unknown until checked
  const { name, args = [] } = typeof descriptor === 'string'
    ? { name: descriptor as unknown, args: [] as unknown[] }
    : (descriptor as { name?: unknown; args?: unknown[] })
  // own-property check: inherited names like 'constructor' must not resolve
  if (typeof name !== 'string' || !Object.hasOwn(colorFunctions, name)) {
    throw new Error(`Unknown color function: ${String(name)}`)
  }
  const factory = colorFunctions[name as ColorFunctionName]
  return (factory as (...args: unknown[]) => ColorFunction)(...args)
}

/**
 * Build a message handler implementing the {@link WorkerRequest} →
 * {@link WorkerResponse} protocol: feed it the `data` of incoming worker
 * messages, and it forwards each reply through `post`.
 */
export const createWorkerHandler = (generate: GenerateFn, post: (response: WorkerResponse) => void) =>
  (data: WorkerRequest | null | undefined): void => {
    // read the id defensively so a malformed message produces an error reply
    // for its own request instead of an uncaught error that rejects every
    // pending request via the client's onerror handler
    const id = (data && typeof data === 'object') ? data.id : undefined
    try {
      if (!data || typeof data !== 'object' || typeof data.id !== 'number') {
        throw new Error('Malformed worker message: expected { id, opts }')
      }
      const opts = { ...data.opts }
      if (opts.colorFunction) {
        opts.colorFunction = resolveColorFunction(opts.colorFunction)
      }
      const pattern = generate(opts as Partial<TrianglifyOptions>)
      post({ id, data: pattern.toData() })
    } catch (err) {
      // non-Error throws (strings, objects) have no .message — stringify them
      // so the client reports the real failure
      const message = err instanceof Error ? err.message : String(err)
      post({ id, error: message || 'Unknown worker error' })
    }
  }
