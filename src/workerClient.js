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

export default class TrianglifyWorker {
  constructor (workerUrl) {
    this._worker = new Worker(workerUrl)
    this._nextId = 0
    this._pending = new Map()

    this._worker.onmessage = (e) => {
      const { id, data, error } = e.data
      const handler = this._pending.get(id)
      if (!handler) return
      this._pending.delete(id)
      if (error) handler.reject(new Error(error))
      else handler.resolve(Pattern.fromData(data))
    }

    this._worker.onerror = (e) => {
      for (const [, handler] of this._pending) {
        handler.reject(new Error(e.message))
      }
      this._pending.clear()
    }
  }

  generate (opts = {}) {
    return new Promise((resolve, reject) => {
      const id = this._nextId++
      const workerOpts = { ...opts }

      // Serialize colorFunction: use _descriptor for built-in functions,
      // omit custom functions (worker will use default)
      if (typeof workerOpts.colorFunction === 'function') {
        if (workerOpts.colorFunction._descriptor) {
          workerOpts.colorFunction = workerOpts.colorFunction._descriptor
        } else {
          delete workerOpts.colorFunction
        }
      }

      this._pending.set(id, { resolve, reject })
      this._worker.postMessage({ id, opts: workerOpts })
    })
  }

  terminate () {
    this._worker.terminate()
    for (const [, handler] of this._pending) {
      handler.reject(new Error('Worker terminated'))
    }
    this._pending.clear()
  }
}