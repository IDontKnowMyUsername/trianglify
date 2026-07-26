// Shared browser-environment detection: true when both window and document
// exist (jsdom included), false in Node and Web Workers
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
