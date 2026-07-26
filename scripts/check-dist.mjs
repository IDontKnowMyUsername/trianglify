// Guard against testing stale build artifacts: every test suite loads the
// built bundles from dist/, so running jest against an old (or missing)
// build silently tests the wrong code.
import { statSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const newestSourceMtime = (dir) => {
  let newest = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.endsWith('.test.ts') || entry.name === '__snapshots__') continue
    const p = join(dir, entry.name)
    const m = entry.isDirectory() ? newestSourceMtime(p) : statSync(p).mtimeMs
    if (m > newest) newest = m
  }
  return newest
}

if (!existsSync('dist/trianglify.cjs')) {
  console.error('dist/ is missing — run `pnpm run build` first (tests run against the built bundles).')
  process.exit(1)
}
if (newestSourceMtime('src') > statSync('dist/trianglify.cjs').mtimeMs) {
  console.error('dist/ is older than src/ — run `pnpm run build` first (tests run against the built bundles).')
  process.exit(1)
}
