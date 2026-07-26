import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import bundleSize from 'rollup-plugin-bundle-size'
import dts from 'rollup-plugin-dts'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// license attribution for the standalone bundles, which inline third-party
// code (BSD-3-Clause and Apache-2.0 require notice retention in binary
// redistribution) — the /*! marker plus terser's `comments: 'some'` keeps
// this through minification
const licenseBanner = `/*!
 * Trianglify v${pkg.version} <https://github.com/qrohlf/trianglify> — GPL-3.0 © Quinn Rohlf
 * Bundled dependencies:
 *   chroma-js © Gregor Aisch — BSD-3-Clause & Apache-2.0
 *   delaunator © Mapbox — ISC
 *   robust-predicates port © Vladimir Agafonkin — Unlicense
 */`

const ts = (tsconfig = './tsconfig.json') => typescript({ tsconfig, declaration: false })
const minify = () => terser({ format: { comments: 'some' } })

export default [
  { // build for node & module bundlers (CJS + ESM)
    input: 'src/trianglify.ts',
    external: ['chroma-js'],
    plugins: [resolve(), commonjs(), ts(), bundleSize()],
    output: [
      {
        file: 'dist/trianglify.cjs',
        format: 'cjs',
        sourcemap: true,
        // expose a `default` self-reference so the CJS runtime shape matches
        // the default export declared in trianglify.d.cts
        footer: 'module.exports.default = module.exports;'
      },
      {
        file: 'dist/trianglify.mjs',
        format: 'es',
        sourcemap: true,
        banner: 'import{createRequire as _createRequire}from"node:module";const require=_createRequire(import.meta.url);'
      }
    ]
  },
  {
    // ESM build for browser bundlers, served via the "browser" exports
    // condition: no node:module banner (which breaks Vite/webpack builds),
    // the require('canvas') branch is unreachable in browsers
    input: 'src/trianglify.ts',
    external: ['chroma-js'],
    plugins: [resolve({ browser: true }), commonjs(), ts(), bundleSize()],
    output: { file: 'dist/trianglify.browser.mjs', format: 'es', sourcemap: true }
  },
  {
    // build minified bundle to be used standalone for browser use
    // note: // chroma.js weighs 40k minified, a smaller solution would be nice
    input: 'src/trianglify.ts',
    plugins: [resolve({ browser: true }), commonjs(), ts(), bundleSize()],
    output: { file: 'dist/trianglify.bundle.js', format: 'umd', name: 'trianglify', sourcemap: true, banner: licenseBanner, plugins: [minify()] }
  },
  {
    // build non-minified bundle to be used for debugging
    input: 'src/trianglify.ts',
    plugins: [resolve({ browser: true }), commonjs(), ts(), bundleSize()],
    output: { file: 'dist/trianglify.bundle.debug.js', format: 'umd', name: 'trianglify', sourcemap: true, banner: licenseBanner }
  },
  {
    // build minified web worker bundle for offloading pattern generation
    input: 'src/worker.ts',
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
