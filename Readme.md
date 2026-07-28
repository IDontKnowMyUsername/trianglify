# Trianglify


Trianglify is a library that I wrote to generate nice SVG background images like this one:

![](https://cloud.githubusercontent.com/assets/347189/6771063/f8b0af46-d090-11e4-8d4c-6c7ef5bd9d37.png)

# Contents
[📦 Getting Trianglify](#-getting-trianglify)  
&nbsp;&nbsp;[Module formats & TypeScript](#module-formats--typescript)  
[🏎 Quickstart](#-quickstart)  
[⚖️ Licensing](#%EF%B8%8F-licensing)  
[📖 API](#-api)  
&nbsp;&nbsp;[TrianglifyWorker](#trianglifyworker)  
[🎨 Configuration](#-configuration)

# 📦 Getting Trianglify

You can grab Trianglify with your package manager of choice:

```
pnpm add trianglify
# or: npm install trianglify
```

Include it in your application via the unpkg CDN:

```
<script src='https://unpkg.com/trianglify@^5/dist/trianglify.bundle.js'></script>
```

Or download a .zip from the [**releases page**](https://github.com/qrohlf/trianglify/releases).

## Module formats & TypeScript

Trianglify ships several builds, selected automatically via the package `exports` map:

| How you load it | File served | Notes |
|---|---|---|
| `import trianglify from 'trianglify'` (bundlers) | `dist/trianglify.browser.mjs` | ESM for Vite/webpack/etc. |
| `import trianglify from 'trianglify'` (Node ESM) | `dist/trianglify.mjs` | ESM for Node |
| `require('trianglify')` | `dist/trianglify.cjs` | CommonJS for Node |
| `<script src=…>` | `dist/trianglify.bundle.js` | Minified UMD with all dependencies included (`.bundle.debug.js` is the unminified variant) |
| `'trianglify/worker'` | `dist/trianglify.worker.js` | Web Worker script, see [TrianglifyWorker](#trianglifyworker) |

TypeScript definitions are bundled — `dist/trianglify.d.ts` for ESM consumers and `dist/trianglify.d.cts` for CommonJS — so no `@types` package is needed, and option/result types are importable:

```ts
import trianglify, { type TrianglifyOptions } from 'trianglify'
```

The full set of importable types: `TrianglifyOptions`, `RenderOpts`, `Pattern` data types (`PatternData`, `Polygon`, `Point`, `Centroid`), color typing (`ColorFunction`, `ColorFunctionParams`, `ColorFunctionDescriptor`, `CSSColor`), rendering options (`SVGOptions`, `CanvasOptions`, `SVGTreeNode`), shape names (`Shape`, `TilingShape`), and the worker protocol (`WorkerRequest`, `WorkerResponse`).

Consuming the CommonJS type definitions requires TypeScript >= 5.3 with `moduleResolution` set to `node16`/`nodenext` or `bundler` (the `.d.cts` uses `resolution-mode` import attributes). ESM consumers have no additional version floor.

Node >= 20 is required. Color support ([culori](https://culorijs.org/), tree-shaken) is bundled — trianglify has no runtime dependencies; `canvas` is an optional peer dependency needed only for `toCanvas()`/PNG output in Node.

Upgrading from v4? See [**MIGRATING.md**](./MIGRATING.md) for the breaking-changes checklist.

# 🏎 Quickstart

**Browsers**
```html
<script src='https://unpkg.com/trianglify@^5/dist/trianglify.bundle.js'></script>
<script>
  const pattern = trianglify({
    width: window.innerWidth,
    height: window.innerHeight
  })
  document.body.appendChild(pattern.toCanvas())
</script>
```

**Node**
```js
const trianglify = require('trianglify')
const fs = require('fs')

const canvas = trianglify({
  width: 1920,
  height: 1080
}).toCanvas()

const file = fs.createWriteStream('trianglify.png')
canvas.createPNGStream().pipe(file)
```

In ES modules, use `import trianglify from 'trianglify'` instead of the `require` call — everything else is identical (see [`examples/esm-node-example.mjs`](./examples/esm-node-example.mjs)).

Note: `toCanvas()` in Node requires the optional [node-canvas](https://github.com/Automattic/node-canvas) peer dependency (`pnpm add canvas`). SVG output via `toSVG()`/`toSVGTree()` works without it.

**CSS backgrounds**

To use a pattern as a CSS background, serialize it into a data URI — as a vector SVG (crisp at any size, no canvas involved) or as a rasterized PNG:

```js
const pattern = trianglify({ width: 1200, height: 600 })

// vector: SVG data URI
const svg = pattern.toSVGTree().toString()
document.body.style.backgroundImage =
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

// raster: PNG data URI via canvas
document.body.style.backgroundImage = `url(${pattern.toCanvas().toDataURL()})`
```

You can see the [`examples/`](./examples) folder for more usage examples, and the [`docs/`](./docs) folder for design notes (including the exact pentagonal-tiling geometry derivations). To contribute, start with [CONTRIBUTING.md](./CONTRIBUTING.md); to report a security issue, see [SECURITY.md](./SECURITY.md); release notes live in [changelog.txt](./changelog.txt).

The https://trianglify.io/ GUI is a good place to play around with the various configuration parameters and see their effect on the generated output, live.

# ⚖️ Licensing

The source code of Trianglify is licensed under version 3 of the GNU General Public License ([GPLv3](https://www.gnu.org/licenses/gpl-3.0.html)). This means that any websites, apps, or other projects that include the Trianglify javascript library need to be released under a compatible open-source license. If you are interested in using Trianglify in a closed-source project, please email qr@qrohlf.com to purchase a commercial license.

**However**, it's worth noting that you own the copyright to the output image files which you create using Trianglify, just like you own the copyright to an image created using something like [GIMP](https://www.gimp.org/). If you just want to use an image file that was generated using Trianglify in your project, and do not plan to distribute the Trianglify source code or compiled versions of it, you do not need to worry about the license restrictions described above.


# 📖 API

Trianglify is primarily used by calling the `trianglify` function, which returns a `trianglify.Pattern` object.

```js
// load the library, either via a window global (browsers) or require call (node)
// in es-module environments, you can `import trianglify from 'trianglify'` as well
const trianglify = window.trianglify || require('trianglify')

const options = { height: 400, width: 600 }
const pattern = trianglify(options)
console.log(pattern instanceof trianglify.Pattern) // true
```

## pattern

This object holds the generated geometry and colors, and exposes a number of methods for rendering this geometry to the DOM or a Canvas.


**`pattern.opts`**

Object containing the options used to generate the pattern. For patterns restored via `Pattern.fromData()` this is the narrower rendering subset (`RenderOpts`: `width`, `height`, `fill`, `strokeWidth`, `strokeColor`, `shape`) rather than the full generation options.


**`pattern.points`**

The pseudo-random point grid used for the pattern geometry, in the following format:

```js
[
  [x, y],
  [x, y],
  [x, y],
  // and so on...
]
```


**`pattern.polys`**

The array of colored polygons that make up the pattern, in the following format:

```js
// {x, y} center of the first polygon in the pattern
pattern.polys[0].centroid

// [i, i, i] three indexes into the pattern.points array, 
// defining the shape corners
pattern.polys[0].vertexIndices

// color object defining the color of the polygon. Call .css() to get
// the color as a CSS-formatted string, e.g. 'rgb(129,204,177)'
pattern.polys[0].color
```


**`pattern.toSVG(destSVG?, svgOpts?)`**

Rendering function for SVG. In browser or browser-like (e.g. JSDOM) environments, this will return a SVGElement DOM node. In node environments, this will return a lightweight node tree structure that can be serialized to a valid SVG string using the `toString()` function.

If an existing svg element is passed as the `destSVG`, this function will render the pattern to the pre-existing element instead of creating a new one, replacing any content it already has — so re-rendering into the same element in a loop is safe.

The `svgOpts` option allows for some svg-specific customizations to the output:

```js
const svgOpts = {
  // Include or exclude the xmlns='http://www.w3.org/2000/svg' attribute on
  // the root <svg> tag. See https://github.com/qrohlf/trianglify/issues/41
  // for additional details on why this is sometimes important
  includeNamespace: true,
  // Controls how many decimals to round coordinate values to.
  // You can set this to -1 to disable rounding. Default is 1.
  coordinateDecimals: 1
}
```


**`pattern.toSVGTree(svgOpts?)`**

Alternate rendering function for SVG. Returns a lightweight node tree structure that can be seralized to a valid SVG string using the `toString()` function. In node environments, this is an alias for
`pattern.toSVG()`.


**`pattern.toCanvas(destCanvas?, canvasOpts?)`**

Rendering function for canvas. In browser and browser-like environments, returns a Canvas HTMLElement node. In node environments, this will return a node-canvas object which follows [a superset of the Web Canvas API](https://github.com/Automattic/node-canvas#documentation).

If an existing canvas element is passed as the `destCanvas`, this function will render the pattern to the pre-existing element instead of creating a new one.

To use this in a node.js environment, the optional dependency [node-canvas](https://github.com/Automattic/node-canvas) needs to be installed as a dependency of your project `pnpm add canvas`.

The `canvasOpts` option allows for some canvas-specific customizations to the output:

```js
const canvasOpts = {
  // determines how the canvas is rendered on high-DPI (aka "retina") devices.
  // - 'auto' will automatically render the canvas at the appropriate scale ratio
  //   for pixel-perfect display.
  // - a numeric value will render the canvas at that specific scale factor
  //   for example, 2.0 will render it at 2x resolution, wheras 0.5 will render
  //   at half resolution
  // - 'false' will disable scaling, and the canvas will be rendered at the 
  //   exact resolution specified by `width, height`
  scaling: 'auto',
  // if the canvas is rendered at a different resolution than the {width, height}
  // trianglify will apply some inline style attributes to scale it back to
  // the requested {width, height} options. Set applyCssScaling to false to 
  // disable this behavior.
  applyCssScaling: true
}
```

The defaults shown above apply in browsers. In Node the defaults are `scaling: false, applyCssScaling: false` — the canvas is rendered at exactly `width` × `height`.

**`pattern.toData()`** / **`trianglify.Pattern.fromData(data)`**

`pattern.toData()` serializes the pattern to a plain object (colors become CSS strings) that survives `JSON.stringify` or `postMessage`. `trianglify.Pattern.fromData(data)` reconstructs a renderable `Pattern` from that data, validating it structurally first — malformed data throws a `TypeError` instead of crashing mid-render. This is useful for caching generated patterns, and it is how the Web Worker support (below) transfers patterns between threads.

**`trianglify.defaultOptions`**

The (frozen) default options object — see [Configuration](#-configuration).

**`trianglify.utils.mix`** / **`trianglify.utils.css`** / **`trianglify.utils.colorbrewer`**

Color helpers for custom palettes and color functions: `mix(a, b, ratio = 0.5, colorSpace = 'lab')` blends two colors (CSS strings or color objects) and returns a color object; `css(color, colorOutput = 'rgb')` serializes a color to a CSS string in any supported [`colorOutput`](#-configuration) format; `colorbrewer` is the built-in palette map.

## TrianglifyWorker

Pattern generation can be offloaded to a Web Worker to keep the main thread responsive. Use the `TrianglifyWorker` client together with the prebuilt worker bundle (`dist/trianglify.worker.js`, also exposed as the `trianglify/worker` package export):

```js
const worker = new trianglify.TrianglifyWorker('path/to/trianglify.worker.js')

const pattern = await worker.generate({ width: 800, height: 600 })
pattern.toCanvas(myCanvas)

worker.terminate() // when you're done with it
```

The constructor accepts a script URL/path (plus optional `WorkerOptions`), or a pre-constructed `Worker` — useful with bundlers:

```js
const worker = new trianglify.TrianglifyWorker(
  new Worker(new URL('trianglify/worker', import.meta.url))
)
```

See [`examples/web-worker-example.html`](./examples/web-worker-example.html) for a runnable demo.

If your build setup compiles workers from your own source files instead of using the prebuilt bundle, `trianglify.createWorkerHandler` wires up a worker script that stays protocol-compatible with the `TrianglifyWorker` client:

```js
// my-worker.js — compiled as a worker entry by your bundler
import trianglify from 'trianglify'

const handleMessage = trianglify.createWorkerHandler(response => self.postMessage(response))
self.onmessage = e => handleMessage(e.data)
```

**`worker.generate(options, { signal })`**

Accepts the same options object as the `trianglify` function and returns a `Promise<Pattern>`. The optional second argument accepts an `AbortSignal` to cancel a pending generation:

```js
const controller = new AbortController()
const promise = worker.generate({ width: 4000, height: 4000 }, { signal: controller.signal })
controller.abort() // rejects the promise with an AbortError
```

Built-in color functions (e.g. `trianglify.colorFunctions.sparkle(0.2)`) are automatically serialized and re-created inside the worker. Custom color functions cannot be transferred — patterns generated in the worker will fall back to the default `interpolateLinear` coloring.

**`worker.terminate()`**

Terminates the underlying Web Worker and rejects any pending `generate` promises.

# 🎨 Configuration

Trianglify is configured by an options object passed in as the only argument. The following option keys are supported, see below for a complete description of what each option does. Options are strictly validated: an unrecognized option key, or a malformed value, throws a `TypeError` with a message naming the offending option.

```js
const defaultOptions = {
  width: 600,
  height: 400,
  cellSize: 75,
  variance: 0.75,
  seed: null,
  xColors: 'random',
  yColors: 'match',
  fill: true,
  palette: trianglify.utils.colorbrewer,
  colorSpace: 'lab',
  colorOutput: 'rgb',
  colorQuantization: 'auto',
  colorFunction: trianglify.colorFunctions.interpolateLinear(0.5),
  strokeWidth: 0,
  strokeColor: null,
  points: null,
  pointGeneration: 'grid',
  shape: 'triangle',
  spiralDirection: 'ccw',
  spiralRatio: 'golden'
}
```

**`width`**

Integer, defaults to `600`. Specify the width in pixels of the pattern to generate.

**`height`**

Integer, defaults to `400`. Specify the height in pixels of the pattern to generate.

**`cellSize`**

Integer, defaults to `75`. Specify the size in pixels of the mesh used to generate triangles. Larger values will result in coarser patterns, smaller values will result in finer patterns. Note that very small values may dramatically increase the runtime of Trianglify.

As an allocation guard, combinations of `width`, `height`, `cellSize`, and `shape` that would allocate more than 1,000,000 points throw a `TypeError` (`invalid cellSize: … increase cellSize`). The estimate accounts for the geometry each shape emits — polygon and circle vertices per grid point, honeycomb row spacing, pentagonal-tiling density — not just the grid size. Supplying your own `points` bypasses the guard.

**`variance`**

Decimal value between 0 and 1 (inclusive), defaults to `0.75`. Specify the amount of randomness used when generating triangles. You may set this higher than 1, but doing so may result in patterns that include "gaps" at the edges.

**`seed`**

String or number, defaults to `null`. Seeds the random number generator to create repeatable patterns. When set to null, the RNG will be seeded with random values from the environment. An example usage would be passing in blog post titles as the seed to generate unique but consistient trianglify patterns for every post on a blog site.

**`xColors`**

String or array of CSS-formatted colors, default is `'random'`. Specify the color gradient used on the x axis.

Valid string values are 'random', or the name of a [colorbrewer palette](http://bl.ocks.org/mbostock/5577023) (i.e. 'YlGnBu' or 'RdBu'). When set to 'random', a gradient will be randomly selected from the colorbrewer library.

Valid array values should specify the color stops in any CSS format (i.e. `['#000000', '#4CAFE8', '#FFFFFF']`).

**`yColors`**

String or array of CSS-formatted colors, default is `'match'`. When set to 'match' the x-axis color gradient will be used on both axes. Otherwise, accepts the same options as xColors.

**`palette`**

The array of color combinations to pick from when using `random` for the xColors or yColors: a name→colors map or an array of color arrays. Every entry must be a non-empty array of CSS color strings — empty or malformed palettes throw a TypeError. See [`src/utils/colorbrewer.ts`](./src/utils/colorbrewer.ts) for the format of the built-in data.

**`colorSpace`**

String, defaults to `'lab'`. Set the color space used for generating gradients. Supported values are `rgb`, `hsv`, `hsl`, `hsi`, `lab`, `hcl`, `oklab`, and `oklch`. See this [blog post](https://vis4.net/blog/posts/avoid-equidistant-hsv-colors/) for some background on why this matters.

**`colorOutput`**

String, defaults to `'rgb'`. The format polygon colors are serialized in:

- `'rgb'` — 8-bit `rgb(r g b)` strings, gamut-mapped to sRGB (CSS Color 4 chroma reduction). Works everywhere.
- `'oklch'` — decimal-precision `oklch(…)` strings; browsers map them to the display's gamut.
- `'display-p3'` — `color(display-p3 …)` strings, gamut-mapped to P3 (CSS Color 4 chroma reduction), for wide-gamut displays.

Wide-gamut output renders in SVG and in browser canvas (`toCanvas()` requests a `display-p3` canvas automatically for `'display-p3'` patterns). node-canvas cannot parse CSS Color 4 strings, so `toCanvas()` throws in Node for non-`'rgb'` output — render via `toSVGTree()` instead.

**`colorQuantization`**

`'auto'` (default), `false`, or an integer number of steps. Scale lookups snap to a t-grid of this many steps and are cached, which speeds up generation substantially. `'auto'` picks 256 steps for `'rgb'` output and 1024 for wide-gamut formats, keeping the quantization error at or below the output format's own precision (within one 8-bit channel step for `'rgb'`). Set `false` for exact scale evaluation.

**`colorFunction`**

Specify a custom function for coloring polygons, defaults to `trianglify.colorFunctions.interpolateLinear(0.5)`. Accepts a function to override the standard gradient coloring, which is passed a variety of data about the pattern and each polygon — including the x/y color scales (`(t) => color`) — and must return a color object (as produced by the scales or `trianglify.utils.mix`), or a finished CSS color string to emit as-is.

The built-in color functions, all available on `trianglify.colorFunctions`:

- `interpolateLinear(bias = 0.5)` — the default; `bias` controls how prevalent the y axis is versus the x axis
- `sparkle(jitterFactor = 0.15)` — random noise in the gradients for higher cell contrast
- `shadows(shadowIntensity = 0.8)` — randomly darkens cells
- `radial(falloff = 1)` — colors by distance from center; `falloff` shapes the curve (`< 1` concentrates color near the center, `> 1` at the edges)
- `angular(offset = 0)` — colors by angle around the center, rotated by `offset` radians

Note: for `shape: 'circle'`, the color function receives empty `vertexIndices`/`vertices` arrays — circles carry no vertex geometry, so custom color functions should rely on `centroid` instead.

See [`examples/color-function-example.html`](./examples/color-function-example.html) and [`src/utils/colorFunctions.ts`](./src/utils/colorFunctions.ts) for more information about the built-in color functions, and how to write custom color functions.

**`fill`**

Boolean, defaults to `true`. Specifies whether the polygons generated by Trianglify should be filled in.

**`strokeWidth`**

Number, defaults to 0. Specify the width of the strokes used to outline the polygons. This can be used in conjunction with `fill: false` to generate weblike patterns.

**`strokeColor`**

String or null, defaults to `null`. Specify a CSS-formatted color to use for polygon strokes. When null, strokes use each polygon's fill color.

**`points`**

Array of points ([x, y]) to triangulate, defaults to null. When not specified an array of randomised points is generated filling the space. Coordinates are not clamped to the `width` × `height` canvas — points outside it are accepted and simply produce geometry that extends past the visible area, so keep them inside (or slightly beyond) the canvas for full coverage. Degenerate inputs (fewer than 3 points, or all-collinear points, with the default `triangle` shape) produce a pattern with no polygons rather than an error. Not supported with the pentagonal tiling shapes (`pentagon-cairo`, `pentagon-convex`, `pentagon-nonconvex`), which generate their own geometry — combining the two throws a TypeError. See [`examples/custom-points-example.html`](./examples/custom-points-example.html) for a demonstration of how this option can be used to generate circular trianglify patterns.

**`pointGeneration`**

String, defaults to `'grid'`. Selects the algorithm used to generate the pseudo-random point layout that the pattern is built on. Supported values:

- `'grid'` — a jittered square grid (the classic Trianglify look)
- `'poisson'` — Poisson-disc sampling via Bridson's algorithm, for an even, organic distribution
- `'bestCandidate'` — Mitchell's best-candidate sampling, similar to Poisson-disc with a softer look
- `'spiral'` — points along a Fermat (sunflower) spiral, see `spiralDirection` and `spiralRatio`
- `'sphere'` — an orthographic projection of points distributed on a sphere

Every mode emits the same number of points at a given `cellSize`, so modes can be swapped without changing the pattern density. This option is ignored when `points` is provided or when `shape` is one of the pentagonal tilings. See [`examples/shapes-and-layouts.html`](./examples/shapes-and-layouts.html) for a visual comparison.

**`shape`**

String, defaults to `'triangle'`. Selects the geometry the pattern is built from:

- `'triangle'` — Delaunay triangulation of the generated points (the classic behavior)
- `'pentagon'`, `'hexagon'`, `'heptagon'`, `'octagon'` — one regular polygon per generated point, with the gaps between polygons filled by triangles. With the default `'grid'` point generation, hexagons are arranged in an exact honeycomb tiling (gap-free at `variance: 0`).
- `'circle'` — one circle per generated point, with gap-filling triangles
- `'pentagon-cairo'` — the equilateral Cairo pentagonal tiling
- `'pentagon-convex'` — a type 5 convex pentagon tiling forming 6-fold rosettes
- `'pentagon-nonconvex'` — a non-convex pentagon tiling forming 12-fold star rosettes

The three `pentagon-*` values generate complete plane tilings directly from `cellSize`, so they ignore the `pointGeneration` and `variance` options — and throw a TypeError if custom `points` are supplied. See [`examples/shapes-and-layouts.html`](./examples/shapes-and-layouts.html) and [`examples/nonconvex-tiling.html`](./examples/nonconvex-tiling.html).

**`spiralDirection`**

String, `'cw'` or `'ccw'`, defaults to `'ccw'`. The winding direction of the spiral when `pointGeneration` is `'spiral'`. Has no effect with other point generation modes.

**`spiralRatio`**

The string `'golden'` or a positive number, defaults to `'golden'`. Controls the divergence angle between consecutive points when `pointGeneration` is `'spiral'`: for a ratio `r` the angle is `2π/r²`, and `'golden'` uses the golden ratio, producing the golden angle (~137.5°) seen in sunflower seed heads. Values near small rational numbers produce visible spiral arms instead of an even fill. Has no effect with other point generation modes.
