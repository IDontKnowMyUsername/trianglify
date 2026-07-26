/// <reference lib="webworker" />
/*
 * Trianglify Web Worker entry point
 *
 * This file is built as a standalone bundle (dist/trianglify.worker.js)
 * for use with Web Workers. It receives pattern options via postMessage
 * and returns serialized pattern data that can be reconstructed on the
 * main thread via Pattern.fromData().
 */

import trianglify from './trianglify'
import * as colorFunctions from './utils/colorFunctions'
import type { ColorFunction, ColorFunctionDescriptor, TrianglifyOptions } from './types'

declare const self: DedicatedWorkerGlobalScope

type ColorFunctionName = keyof typeof colorFunctions

interface WorkerRequest {
  id?: number
  // functions cannot cross the structured-clone boundary, so a color
  // function only ever arrives as a descriptor or a bare name
  opts?: Omit<Partial<TrianglifyOptions>, 'colorFunction'> & {
    colorFunction?: ColorFunctionDescriptor | string
  }
}

const resolveColorFunction = (descriptor: ColorFunctionDescriptor | string | undefined): ColorFunction | undefined => {
  if (!descriptor) return undefined
  const { name, args = [] } = typeof descriptor === 'string'
    ? { name: descriptor, args: [] as unknown[] }
    : descriptor
  // own-property check: inherited names like 'constructor' must not resolve
  if (typeof name !== 'string' || !Object.hasOwn(colorFunctions, name)) {
    throw new Error(`Unknown color function: ${String(name)}`)
  }
  const factory = colorFunctions[name as ColorFunctionName]
  return (factory as (...args: unknown[]) => ColorFunction)(...args)
}

self.onmessage = (e: MessageEvent<WorkerRequest | null>) => {
  // read the id defensively so a malformed message produces an error reply
  // for its own request instead of an uncaught error that rejects every
  // pending request via the client's onerror handler
  const id = (e.data && typeof e.data === 'object') ? e.data.id : undefined
  try {
    if (!e.data || typeof e.data !== 'object' || typeof e.data.id !== 'number') {
      throw new Error('Malformed worker message: expected { id, opts }')
    }
    const opts = { ...e.data.opts }
    if (opts.colorFunction) {
      opts.colorFunction = resolveColorFunction(opts.colorFunction)
    }
    const pattern = trianglify(opts as Partial<TrianglifyOptions>)
    self.postMessage({ id, data: pattern.toData() })
  } catch (err) {
    // non-Error throws (strings, objects) have no .message — stringify them
    // so the client reports the real failure
    const message = err instanceof Error ? err.message : String(err)
    self.postMessage({ id, error: message || 'Unknown worker error' })
  }
}
