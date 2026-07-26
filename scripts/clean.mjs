// Remove dist/ before building so renamed or removed bundles never linger
// across builds and end up in a published tarball
import { rmSync } from 'node:fs'
rmSync('dist', { recursive: true, force: true })
