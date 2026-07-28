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

// Everything that shapes the dist output, not just src/: build config,
// build scripts, and the lockfile (dependencies are inlined into the
// bundles, so a dependency bump changes the output without touching src/).
const buildInputs = [
  'rollup.config.js',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'tsconfig.build.json',
  'tsconfig.worker.json',
  'scripts/clean.mjs',
  'scripts/postbuild.mjs'
]

// Every artifact the build emits — an interrupted build that produced some
// bundles but not others must not pass the guard.
const artifacts = [
  'trianglify.cjs',
  'trianglify.mjs',
  'trianglify.browser.mjs',
  'trianglify.bundle.js',
  'trianglify.bundle.debug.js',
  'trianglify.worker.js',
  'trianglify.d.ts',
  'trianglify.d.cts',
  'trianglify.worker.d.ts'
].map((f) => join('dist', f))

const missing = artifacts.filter((f) => !existsSync(f))
if (missing.length > 0) {
  console.error(`dist/ is incomplete (missing: ${missing.join(', ')}) — run \`pnpm run build\` first (tests run against the built bundles).`)
  process.exit(1)
}

const newestInput = Math.max(
  newestSourceMtime('src'),
  ...buildInputs.map((f) => statSync(f).mtimeMs)
)
const oldestArtifact = Math.min(...artifacts.map((f) => statSync(f).mtimeMs))
if (newestInput > oldestArtifact) {
  console.error('dist/ is older than the source or build configuration — run `pnpm run build` first (tests run against the built bundles).')
  process.exit(1)
}
