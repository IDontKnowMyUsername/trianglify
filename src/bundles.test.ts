/**
 * @jest-environment node
 */
export {}

// Verifies the shipped bundle artifacts beyond the CJS bundle the rest
// of the suite tests: the minified UMD build, and the two ESM builds
// loaded in a real Node process via dynamic import (Jest's CommonJS
// transform cannot import ESM in-process).

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const cjs = require('../dist/trianglify.cjs')

const SEED_OPTS = { seed: 'bundle-parity', width: 120, height: 90 }
const expectedSVG = cjs(SEED_OPTS).toSVGTree().toString()

// Both UMD variants are excluded from coverage collection (see
// coveragePathIgnorePatterns): remapping several bundles of the same
// sources and merging the results corrupts the coverage report.
for (const [label, file] of [['minified', 'trianglify.bundle.js'], ['debug', 'trianglify.bundle.debug.js']] as const) {
  describe(`${label} UMD bundle`, () => {
    const umd = require(`../dist/${file}`)

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
}

describe('ESM bundles (real Node import)', () => {
  const importAndRender = (file: string): string => {
    const fileUrl = 'file://' + path.join(__dirname, '../dist', file)
    const script = `
      import(${JSON.stringify(fileUrl)}).then((m) => {
        const pattern = m.default(${JSON.stringify(SEED_OPTS)})
        process.stdout.write(pattern.toSVGTree().toString())
      }).catch((err) => { console.error(err); process.exit(1) })
    `
    return execFileSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 30_000 })
  }

  test('trianglify.mjs (Node ESM entry) renders identically to CJS', () => {
    expect(importAndRender('trianglify.mjs')).toEqual(expectedSVG)
  })

  test('trianglify.browser.mjs (browser exports condition) renders identically to CJS', () => {
    expect(importAndRender('trianglify.browser.mjs')).toEqual(expectedSVG)
  })
})

describe('bundle size ceilings', () => {
  const sizeOf = (file: string): number =>
    fs.statSync(path.join(__dirname, '../dist', file)).size

  test('bundles stay under generous size ceilings', () => {
    // guards against accidental dependency bloat — raise deliberately when
    // a size increase is intentional
    expect(sizeOf('trianglify.bundle.js')).toBeLessThan(120_000)
    expect(sizeOf('trianglify.worker.js')).toBeLessThan(120_000)
    expect(sizeOf('trianglify.cjs')).toBeLessThan(150_000)
  })

  test('minified bundles retain license attribution', () => {
    for (const file of ['trianglify.bundle.js', 'trianglify.worker.js']) {
      const source = fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8')
      expect(source).toContain('chroma-js')
      expect(source).toContain('BSD-3-Clause')
    }
  })
})
