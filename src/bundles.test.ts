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
  interface EsmProbe {
    svg: string
    api: string[]
    canvasError?: string
  }

  const probe = (file: string): EsmProbe => {
    const fileUrl = 'file://' + path.join(__dirname, '../dist', file)
    const script = `
      // node -e exposes globalThis.require, which a real browser/bundler
      // ESM environment does not have — remove it so the probe sees the
      // bundle's true behavior (trianglify.mjs brings its own module-scoped
      // require via the createRequire banner and is unaffected)
      delete globalThis.require
      import(${JSON.stringify(fileUrl)}).then((m) => {
        const t = m.default
        const out = {
          svg: t(${JSON.stringify(SEED_OPTS)}).toSVGTree().toString(),
          api: ['Pattern', 'TrianglifyWorker', 'colorFunctions', 'defaultOptions', 'utils'].filter((k) => k in t)
        }
        try { t(${JSON.stringify(SEED_OPTS)}).toCanvas() } catch (e) { out.canvasError = e.message }
        process.stdout.write(JSON.stringify(out))
      }).catch((err) => { console.error(err); process.exit(1) })
    `
    return JSON.parse(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 30_000 }))
  }

  test('trianglify.mjs (Node ESM entry) matches CJS and supports node-canvas', () => {
    const result = probe('trianglify.mjs')
    expect(result.svg).toEqual(expectedSVG)
    expect(result.api).toEqual(['Pattern', 'TrianglifyWorker', 'colorFunctions', 'defaultOptions', 'utils'])
    // the createRequire banner makes the optional canvas dependency loadable
    expect(result.canvasError).toBeUndefined()
  })

  test('trianglify.browser.mjs (browser exports condition) matches CJS and degrades gracefully without require', () => {
    const result = probe('trianglify.browser.mjs')
    expect(result.svg).toEqual(expectedSVG)
    expect(result.api).toEqual(['Pattern', 'TrianglifyWorker', 'colorFunctions', 'defaultOptions', 'utils'])
    // the browser build deliberately omits the createRequire banner (it
    // breaks bundlers) — outside a browser, toCanvas() must fail with the
    // helpful install message rather than an opaque ReferenceError
    expect(result.canvasError).toContain('requires either a browser environment')
  })
})

describe('bundle size ceilings', () => {
  const sizeOf = (file: string): number =>
    fs.statSync(path.join(__dirname, '../dist', file)).size

  test('bundles stay under size ceilings', () => {
    // ~15% headroom over current sizes — guards against accidental
    // dependency bloat; raise deliberately when an increase is intentional
    expect(sizeOf('trianglify.bundle.js')).toBeLessThan(88_000)
    expect(sizeOf('trianglify.worker.js')).toBeLessThan(88_000)
    expect(sizeOf('trianglify.cjs')).toBeLessThan(120_000)
  })

  test('minified bundles retain license attribution', () => {
    for (const file of ['trianglify.bundle.js', 'trianglify.worker.js']) {
      const source = fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8')
      expect(source).toContain('chroma-js')
      expect(source).toContain('BSD-3-Clause')
    }
  })
})
