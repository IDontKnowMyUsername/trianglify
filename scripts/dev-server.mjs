// Static file server for `pnpm dev`, so the examples/ pages can load
// dist/ bundles over http:// instead of file:// (ES module imports and
// `new Worker(...)` both fail under the file: protocol). Zero dependencies:
// rollup watch already keeps the process alive, this just answers requests.
import { createServer } from 'node:http'
import { createReadStream, watch } from 'node:fs'
import { readFile, stat, readdir } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DEFAULT_PORT = 3000
// give up rather than walk the whole port range if something is squatting
const PORT_ATTEMPTS = 10

const LIVERELOAD_PATH = '/__livereload'
// both directories are flat, so a non-recursive watch covers everything the
// browser can load — and sidesteps platform gaps in recursive fs.watch
const WATCH_DIRS = ['dist', 'examples']
// rollup emits six bundles plus sourcemaps per pass; coalesce that burst
// into a single reload
const RELOAD_DEBOUNCE_MS = 150

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
}

const escapeHtml = (str) => str.replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
))

const send = (res, status, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

// ---- live reload -----------------------------------------------------------

const clients = new Set()
const watched = new Set()
let reloadTimer = null

const scheduleReload = () => {
  if (reloadTimer) return
  reloadTimer = setTimeout(() => {
    reloadTimer = null
    for (const res of clients) res.write('data: reload\n\n')
  }, RELOAD_DEBOUNCE_MS)
}

// dist/ may not exist yet on the first watch pass (rollup calls us from
// buildStart), so attaching is retried lazily whenever a page connects
const ensureWatchers = () => {
  for (const dir of WATCH_DIRS) {
    if (watched.has(dir)) continue
    try {
      const watcher = watch(join(ROOT, dir), scheduleReload)
      watcher.on('error', () => { watched.delete(dir) })
      watched.add(dir)
    } catch {
      // directory not there yet — try again on the next connection
    }
  }
}

const LIVERELOAD_SNIPPET = '<script>' +
  `(()=>{const s=new EventSource(${JSON.stringify(LIVERELOAD_PATH)});` +
  's.onmessage=()=>location.reload()})()' +
  '</script>'

const injectLiveReload = (html) => html.includes('</body>')
  ? html.replace('</body>', LIVERELOAD_SNIPPET + '</body>')
  : html + LIVERELOAD_SNIPPET

const openEventStream = (req, res) => {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'keep-alive'
  })
  res.write('retry: 1000\n\n')
  clients.add(res)
  ensureWatchers()
  req.on('close', () => clients.delete(res))
}

const listDirectory = async (dir, urlPath) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const links = entries
    .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map((entry) => {
      const name = entry.name + (entry.isDirectory() ? '/' : '')
      return `<li><a href="${escapeHtml(encodeURIComponent(entry.name))}${entry.isDirectory() ? '/' : ''}">${escapeHtml(name)}</a></li>`
    })
    .join('\n')
  return `<!doctype html>
<meta charset="utf-8">
<title>${escapeHtml(urlPath)}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;margin:2rem}ul{list-style:none;padding:0}a{text-decoration:none}a:hover{text-decoration:underline}</style>
<h1>${escapeHtml(urlPath)}</h1>
<ul>
${urlPath === '/' ? '' : '<li><a href="../">../</a></li>'}
${links}
</ul>`
}

// resolve a request path inside ROOT, rejecting traversal out of the tree
const safePath = (urlPath) => {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  const target = resolve(ROOT, '.' + decoded)
  const rel = relative(ROOT, target)
  if (rel.startsWith('..' + sep) || rel === '..') return null
  return target
}

const handle = async (req, res) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname
  if (urlPath === LIVERELOAD_PATH) return openEventStream(req, res)

  const target = safePath(urlPath)
  if (!target) return send(res, 403, '403 Forbidden')

  let info
  try {
    info = await stat(target)
  } catch {
    return send(res, 404, `404 Not Found: ${urlPath}`)
  }

  if (info.isDirectory()) {
    // redirect so relative links inside the listing resolve against the dir
    if (!urlPath.endsWith('/')) {
      res.writeHead(302, { location: urlPath + '/' })
      return res.end()
    }
    const index = join(target, 'index.html')
    const hasIndex = await stat(index).then(() => true, () => false)
    if (hasIndex) return await sendFile(res, index)
    const listing = injectLiveReload(await listDirectory(target, urlPath))
    return send(res, 200, listing, 'text/html; charset=utf-8')
  }

  return await sendFile(res, target)
}

const sendFile = async (res, file) => {
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
  // HTML is read whole rather than streamed so the live-reload client can be
  // injected; everything else (bundles, images) streams straight through
  if (type.startsWith('text/html')) {
    const html = await readFile(file, 'utf8')
    return send(res, 200, injectLiveReload(html), type)
  }
  res.writeHead(200, {
    'content-type': type,
    // dist/ is rebuilt under us on every watch pass — never let the browser
    // hold a stale bundle
    'cache-control': 'no-store'
  })
  createReadStream(file).pipe(res)
}

/**
 * Start the static server, walking forward from `port` if it is taken.
 * Resolves with the port actually bound.
 */
export const startDevServer = (port = Number(process.env.PORT) || DEFAULT_PORT) =>
  new Promise((resolvePort, reject) => {
    const server = createServer((req, res) => {
      handle(req, res).catch((err) => { send(res, 500, `500 ${err.message}`) })
    })
    let attempt = 0
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && ++attempt < PORT_ATTEMPTS) {
        server.listen(port + attempt)
        return
      }
      reject(err)
    })
    server.on('listening', () => {
      const bound = server.address().port
      ensureWatchers()
      console.log(`\n  dev server  http://localhost:${bound}/examples/  (live reload on)\n`)
      resolvePort(bound)
    })
    server.listen(port)
  })

// allow `node scripts/dev-server.mjs` on its own, without rollup
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startDevServer().catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
}
