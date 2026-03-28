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
import type { ColorFunction } from './types'

declare const self: DedicatedWorkerGlobalScope

type ColorFunctionName = keyof typeof colorFunctions

interface ColorFunctionDescriptor {
  name: string
  args?: unknown[]
}

const resolveColorFunction = (descriptor: ColorFunctionDescriptor | ColorFunction | string | undefined): ColorFunction | undefined => {
  if (!descriptor || typeof descriptor === 'function') return descriptor as ColorFunction | undefined
  const { name, args = [] } = typeof descriptor === 'string'
    ? { name: descriptor, args: [] as unknown[] }
    : descriptor
  const factory = colorFunctions[name as ColorFunctionName]
  if (!factory) throw new Error(`Unknown color function: ${name}`)
  return (factory as (...args: unknown[]) => ColorFunction)(...args)
}

self.onmessage = (e: MessageEvent) => {
  const { id, opts } = e.data
  try {
    if (opts.colorFunction) {
      opts.colorFunction = resolveColorFunction(opts.colorFunction)
    }
    const pattern = trianglify(opts)
    self.postMessage({ id, data: pattern.toData() })
  } catch (err) {
    self.postMessage({ id, error: (err as Error).message })
  }
}
