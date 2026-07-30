import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import bundleSize from 'rollup-plugin-bundle-size'
import dts from 'rollup-plugin-dts'
import { readFileSync } from 'node:fs'
import { startDevServer } from './scripts/dev-server.mjs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// license attribution for the bundles, which inline third-party code (MIT
// and ISC require notice retention in redistribution) — the /*! marker
// plus terser's `comments: 'some'` keeps this through minification.
// culori is bundled (from the tree-shakeable culori/fn entry) rather than
// left external: its ./fn subpath ships only ESM, which require() cannot
// load on older node 20.x
const licenseBanner = `/*!
 * Trianglify v${pkg.version} <https://github.com/IDontKnowMyUsername/trianglify> — GPL-3.0 © Quinn Rohlf
 * Bundled dependencies:
 *   culori © Dan Burzo — MIT
 *   delaunator © Mapbox — ISC
 *   robust-predicates port © Vladimir Agafonkin — Unlicense
 */`

const ts = (tsconfig = './tsconfig.json') => typescript({ tsconfig, declaration: false })
const minify = () => terser({ format: { comments: 'some' } })

// culori's internal module graph has benign cycles (modes ↔ converter ↔
// parse); every other warning still surfaces
const onwarn = (warning, warn) => {
  if (warning.code === 'CIRCULAR_DEPENDENCY' && (warning.ids ?? []).some(id => id.includes('culori'))) return
  warn(warning)
}

// `pnpm dev` = rollup watch + a static server for examples/. Gated on
// ROLLUP_WATCH so `pnpm run build` (and CI) never opens a socket, and
// latched so the six config entries below start exactly one server.
let devServerStarted = false
const devServer = () => ({
  name: 'dev-server',
  buildStart () {
    if (!process.env.ROLLUP_WATCH || devServerStarted) return
    devServerStarted = true
    return startDevServer().then(() => undefined, err => { this.warn(`dev server failed to start: ${err.message}`) })
  }
})

export default [
  { // build for node & module bundlers (CJS + ESM)
    input: 'src/trianglify.ts',
    onwarn,
    plugins: [resolve(), commonjs(), ts(), bundleSize(), devServer()],
    output: [
      {
        file: 'dist/trianglify.cjs',
        format: 'cjs',
        sourcemap: true,
        banner: licenseBanner,
        // expose a `default` self-reference so the CJS runtime shape matches
        // the default export declared in trianglify.d.cts
        footer: 'module.exports.default = module.exports;'
      },
      {
        file: 'dist/trianglify.mjs',
        format: 'es',
        sourcemap: true,
        banner: licenseBanner + '\nimport{createRequire as _createRequire}from"node:module";const require=_createRequire(import.meta.url);'
      }
    ]
  },
  {
    // ESM build for browser bundlers, served via the "browser" exports
    // condition: no node:module banner (which breaks Vite/webpack builds),
    // the require('canvas') branch is unreachable in browsers
    input: 'src/trianglify.ts',
    onwarn,
    plugins: [resolve({ browser: true }), commonjs(), ts(), bundleSize()],
    output: { file: 'dist/trianglify.browser.mjs', format: 'es', sourcemap: true, banner: licenseBanner }
  },
  {
    // build minified bundle to be used standalone for browser use
    input: 'src/trianglify.ts',
    onwarn,
    plugins: [resolve({ browser: true }), commonjs(), ts(), bundleSize()],
    output: { file: 'dist/trianglify.bundle.js', format: 'umd', name: 'trianglify', sourcemap: true, banner: licenseBanner, plugins: [minify()] }
  },
  {
    // build non-minified bundle to be used for debugging
    input: 'src/trianglify.ts',
    onwarn,
    plugins: [resolve({ browser: true }), commonjs(), ts(), bundleSize()],
    output: { file: 'dist/trianglify.bundle.debug.js', format: 'umd', name: 'trianglify', sourcemap: true, banner: licenseBanner }
  },
  {
    // build minified web worker bundle for offloading pattern generation
    input: 'src/worker.ts',
    onwarn,
    plugins: [resolve({ browser: true }), commonjs(), ts('./tsconfig.worker.json'), bundleSize()],
    output: { file: 'dist/trianglify.worker.js', format: 'iife', sourcemap: true, banner: licenseBanner, plugins: [minify()] }
  },
  {
    // bundle type declarations into a single .d.ts file
    input: 'dist/types/trianglify.d.ts',
    plugins: [dts()],
    output: { file: 'dist/trianglify.d.ts', format: 'es' }
  }
]
