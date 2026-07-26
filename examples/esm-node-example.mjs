// Node ESM usage: generates a pattern and writes it out as an SVG file.
//
// Run `pnpm run build` first, then:
//   node examples/esm-node-example.mjs
//
// The bare 'trianglify' import resolves through the package exports map
// (Node package self-reference) — in your own project, `pnpm add trianglify`
// and use the exact same import.
import { writeFileSync } from 'node:fs'
import trianglify from 'trianglify'

const pattern = trianglify({
  width: 1200,
  height: 630,
  cellSize: 60,
  seed: 'esm-example',
  xColors: 'YlGnBu'
})

writeFileSync('esm-example.svg', pattern.toSVGTree().toString())
console.log('wrote esm-example.svg')
