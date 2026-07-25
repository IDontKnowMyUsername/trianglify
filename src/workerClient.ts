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
  private _terminated: boolean

  constructor (workerUrl: string) {
    this._worker = new Worker(workerUrl)
    this._nextId = 0
    this._pending = new Map()
    this._terminated = false

    this._worker.onmessage = (e: MessageEvent<{ id: number; data?: PatternData; error?: string }>) => {
      const { id, data, error } = e.data
      const handler = this._pending.get(id)
      if (!handler) return
      this._pending.delete(id)
      if (error !== undefined) handler.reject(new Error(error))
      else if (data) handler.resolve(Pattern.fromData(data))
      else handler.reject(new Error('Worker returned neither data nor error'))
    }

    this._worker.onerror = (e: ErrorEvent) => {
      for (const [, handler] of this._pending) {
        handler.reject(new Error(e.message))
      }
      this._pending.clear()
    }
  }

  generate (opts: Partial<TrianglifyOptions> = {}, { signal }: { signal?: AbortSignal } = {}): Promise<Pattern> {
    return new Promise((resolve, reject) => {
      if (this._terminated) {
        reject(new Error('Worker terminated'))
        return
      }
      if (signal?.aborted) {
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
        return
      }

      const id = this._nextId++
      const workerOpts: WorkerOpts = { ...opts }

      // Serialize colorFunction: use _descriptor for built-in functions,
      // omit custom functions (worker will use default)
      if (typeof workerOpts.colorFunction === 'function') {
        const descriptor = (workerOpts.colorFunction as ColorFunction)._descriptor
        if (descriptor) {
          workerOpts.colorFunction = descriptor
        } else {
          delete workerOpts.colorFunction
        }
      }

      const onAbort = () => {
        this._pending.delete(id)
        reject(signal!.reason ?? new DOMException('Aborted', 'AbortError'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      this._pending.set(id, {
        resolve: (pattern) => {
          signal?.removeEventListener('abort', onAbort)
          resolve(pattern)
        },
        reject: (error) => {
          signal?.removeEventListener('abort', onAbort)
          reject(error)
        }
      })
      try {
        this._worker.postMessage({ id, opts: workerOpts })
      } catch (err) {
        // synchronous failure (e.g. DataCloneError on unserializable opts):
        // reject through the stored handler so the abort listener is removed
        // and the pending entry doesn't leak
        const handler = this._pending.get(id)!
        this._pending.delete(id)
        handler.reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  terminate (): void {
    this._terminated = true
    this._worker.terminate()
    for (const [, handler] of this._pending) {
      handler.reject(new Error('Worker terminated'))
    }
    this._pending.clear()
  }
}
