import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import bundleSize from 'rollup-plugin-bundle-size'
import dts from 'rollup-plugin-dts'

export default [
  { // build for node & module bundlers (CJS + ESM)
    input: 'src/trianglify.ts',
    external: ['chroma-js'],
    plugins: [resolve(), commonjs(), typescript({ tsconfig: './tsconfig.json', declaration: false }), bundleSize()],
    output: [
      { file: 'dist/trianglify.cjs', format: 'cjs', sourcemap: true },
      {
        file: 'dist/trianglify.mjs',
        format: 'es',
        sourcemap: true,
        banner: 'import{createRequire as _createRequire}from"node:module";const require=_createRequire(import.meta.url);'
      }
    ]
  },
  {
    // build minified bundle to be used standalone for browser use
    // note: // chroma.js weighs 40k minified, a smaller solution would be nice
    input: 'src/trianglify.ts',
    plugins: [terser({ output: { comments: false } }), resolve({ browser: true }), commonjs(), typescript({ tsconfig: './tsconfig.json', declaration: false }), bundleSize()],
    output: { file: 'dist/trianglify.bundle.js', format: 'umd', name: 'trianglify', sourcemap: true }
  },
  {
    // build non-minified bundle to be used for debugging
    input: 'src/trianglify.ts',
    plugins: [resolve({ browser: true }), commonjs(), typescript({ tsconfig: './tsconfig.json', declaration: false }), bundleSize()],
    output: { file: 'dist/trianglify.bundle.debug.js', format: 'umd', name: 'trianglify', sourcemap: true }
  },
  {
    // build minified web worker bundle for offloading pattern generation
    input: 'src/worker.ts',
    plugins: [terser({ output: { comments: false } }), resolve({ browser: true }), commonjs(), typescript({ tsconfig: './tsconfig.worker.json', declaration: false }), bundleSize()],
    output: { file: 'dist/trianglify.worker.js', format: 'iife', sourcemap: true }
  },
  {
    // bundle type declarations into a single .d.ts file
    input: 'dist/types/trianglify.d.ts',
    plugins: [dts()],
    output: { file: 'dist/trianglify.d.ts', format: 'es' }
  }
]
