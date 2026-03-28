/*
 * TrianglifyWorker - client-side helper for running Trianglify
 * pattern generation in a Web Worker.
 *
 * Usage:
 *   const worker = new TrianglifyWorker('path/to/trianglify.worker.js')
 *   const pattern = await worker.generate({ width: 800, height: 600 })
 *   pattern.toCanvas(myCanvas)
 *   worker.terminate()
 *
 * Built-in color functions are automatically serialized for the worker.
 * Custom color functions cannot be transferred and will fall back to the
 * default (interpolateLinear).
 */

import Pattern from './pattern'
import type { TrianglifyOptions, ColorFunction, PatternData } from './types'

interface PendingHandler {
  resolve: (pattern: Pattern) => void
  reject: (error: Error) => void
}

interface WorkerOpts extends Omit<Partial<TrianglifyOptions>, 'colorFunction'> {
  colorFunction?: ColorFunction | { name: string; args: unknown[] }
}

export default class TrianglifyWorker {
  private _worker: Worker
  private _nextId: number
  private _pending: Map<number, PendingHandler>

  constructor (workerUrl: string) {
    this._worker = new Worker(workerUrl)
    this._nextId = 0
    this._pending = new Map()

    this._worker.onmessage = (e: MessageEvent<{ id: number; data?: PatternData; error?: string }>) => {
      const { id, data, error } = e.data
      const handler = this._pending.get(id)
      if (!handler) return
      this._pending.delete(id)
      if (error) handler.reject(new Error(error))
      else handler.resolve(Pattern.fromData(data!))
    }

    this._worker.onerror = (e: ErrorEvent) => {
      for (const [, handler] of this._pending) {
        handler.reject(new Error(e.message))
      }
      this._pending.clear()
    }
  }

  generate (opts: Partial<TrianglifyOptions> = {}): Promise<Pattern> {
    return new Promise((resolve, reject) => {
      const id = this._nextId++
      const workerOpts: WorkerOpts = { ...opts }

      // Serialize colorFunction: use _descriptor for built-in functions,
      // omit custom functions (worker will use default)
      if (typeof workerOpts.colorFunction === 'function') {
        if ((workerOpts.colorFunction as ColorFunction)._descriptor) {
          workerOpts.colorFunction = (workerOpts.colorFunction as ColorFunction)._descriptor!
        } else {
          delete workerOpts.colorFunction
        }
      }

      this._pending.set(id, { resolve, reject })
      this._worker.postMessage({ id, opts: workerOpts })
    })
  }

  terminate (): void {
    this._worker.terminate()
    for (const [, handler] of this._pending) {
      handler.reject(new Error('Worker terminated'))
    }
    this._pending.clear()
  }
}
