/**
 * @jest-environment node
 */
export {}

// Verifies the shipped bundle artifacts beyond the CJS bundle the rest
// of the suite tests: the minified UMD build, and the two ESM builds
// loaded in a real Node process via dynamic import (Jest's CommonJS
// transform cannot import ESM in-process).

const path = require('path')
const { execFileSync } = require('child_process')

const cjs = require('../dist/trianglify.cjs')

const SEED_OPTS = { seed: 'bundle-parity', width: 120, height: 90 }
const expectedSVG = cjs(SEED_OPTS).toSVGTree().toString()

describe('minified UMD bundle', () => {
  const umd = require('../dist/trianglify.bundle.js')

  test('exposes the same API surface as the CJS bundle', () => {
    expect(typeof umd).toBe('function')
    expect(umd.colorFunctions).toBeDefined()
    expect(umd.Pattern).toBeDefined()
    expect(umd.TrianglifyWorker).toBeDefined()
    expect(umd.defaultOptions).toBeDefined()
  })

  test('produces output identical to the CJS bundle', () => {
    expect(umd(SEED_OPTS).toSVGTree().toString()).toEqual(expectedSVG)
  })
})

describe('ESM bundles (real Node import)', () => {
  const importAndRender = (file: string): string => {
    const fileUrl = 'file://' + path.join(__dirname, '../dist', file)
    const script = `
      import(${JSON.stringify(fileUrl)}).then((m) => {
        const pattern = m.default(${JSON.stringify(SEED_OPTS)})
        process.stdout.write(pattern.toSVGTree().toString())
      }).catch((err) => { console.error(err); process.exit(1) })
    `
    return execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' })
  }

  test('trianglify.mjs (Node ESM entry) renders identically to CJS', () => {
    expect(importAndRender('trianglify.mjs')).toEqual(expectedSVG)
  })

  test('trianglify.browser.mjs (browser exports condition) renders identically to CJS', () => {
    expect(importAndRender('trianglify.browser.mjs')).toEqual(expectedSVG)
  })
})
