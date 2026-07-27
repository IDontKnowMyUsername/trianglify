/// <reference lib="webworker" />
/*
 * Trianglify Web Worker entry point
 *
 * This file is built as a standalone bundle (dist/trianglify.worker.js)
 * for use with Web Workers. It receives pattern options via postMessage
 * and returns serialized pattern data that can be reconstructed on the
 * main thread via Pattern.fromData(). The protocol itself lives in
 * workerHost.ts (bundled into the main entry so coverage measures it) —
 * this file only wires the public handler to the worker scope.
 */

import trianglify from './trianglify'
import type { WorkerRequest } from './types'

declare const self: DedicatedWorkerGlobalScope

const handleMessage = trianglify.createWorkerHandler(response => { self.postMessage(response) })

self.onmessage = (e: MessageEvent<WorkerRequest | null>) => { handleMessage(e.data) }
