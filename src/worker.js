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

const resolveColorFunction = (descriptor) => {
  if (!descriptor || typeof descriptor === 'function') return descriptor
  const { name, args = [] } = typeof descriptor === 'string'
    ? { name: descriptor }
    : descriptor
  const factory = colorFunctions[name]
  if (!factory) throw new Error(`Unknown color function: ${name}`)
  return factory(...args)
}

self.onmessage = (e) => {
  const { id, opts } = e.data
  try {
    if (opts.colorFunction) {
      opts.colorFunction = resolveColorFunction(opts.colorFunction)
    }
    const pattern = trianglify(opts)
    self.postMessage({ id, data: pattern.toData() })
  } catch (err) {
    self.postMessage({ id, error: err.message })
  }
}
