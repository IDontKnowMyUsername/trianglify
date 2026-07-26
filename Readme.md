# Trianglify


Trianglify is a library that I wrote to generate nice SVG background images like this one:

![](https://cloud.githubusercontent.com/assets/347189/6771063/f8b0af46-d090-11e4-8d4c-6c7ef5bd9d37.png)

# Contents
[📦 Getting Trianglify](#-getting-trianglify)  
[🏎 Quickstart](#-quickstart)  
[⚖️ Licensing](#%EF%B8%8F-licensing)  
[📖 API](#-api)  
[🎨 Configuration](#-configuration)

# 📦 Getting Trianglify

You can grab Trianglify with pnpm (recommended):

```
pnpm add trianglify
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
| `import trianglify from 'trianglify'` (bundlers) | `dist/trianglify.browser.mjs` | ESM for Vite/webpack/etc., `chroma-js` deduped by your bundler |
| `import trianglify from 'trianglify'` (Node ESM) | `dist/trianglify.mjs` | ESM for Node |
| `require('trianglify')` | `dist/trianglify.cjs` | CommonJS for Node |
| `<script src=…>` | `dist/trianglify.bundle.js` | Minified UMD with all dependencies included (`.bundle.debug.js` is the unminified variant) |
| `'trianglify/worker'` | `dist/trianglify.worker.js` | Web Worker script, see [TrianglifyWorker](#trianglifyworker) |

TypeScript definitions are bundled — `dist/trianglify.d.ts` for ESM consumers and `dist/trianglify.d.cts` for CommonJS — so no `@types` package is needed, and option/result types are importable:

```ts
import trianglify, { type TrianglifyOptions } from 'trianglify'
```

Node >= 18 is required. `chroma-js` is a regular dependency; `canvas` is an optional peer dependency needed only for `toCanvas()`/PNG output in Node.

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

Note: `toCanvas()` in Node requires the optional [node-canvas](https://github.com/Automattic/node-canvas) peer dependency (`pnpm add canvas`). SVG output via `toSVG()`/`toSVGTree()` works without it.

You can see the [`examples/`](./examples) folder for more usage examples, and the [`docs/`](./docs) folder for design notes (including the exact pentagonal-tiling geometry derivations).

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

Object containing the options used to generate the pattern.


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

`pattern.toData()` serializes the pattern to a plain object (colors become CSS strings) that survives `JSON.stringify` or `postMessage`. `trianglify.Pattern.fromData(data)` reconstructs a renderable `Pattern` from that data. This is useful for caching generated patterns, and it is how the Web Worker support (below) transfers patterns between threads.

**`trianglify.defaultOptions`**

The (frozen) default options object — see [Configuration](#-configuration).

**`trianglify.utils.mix`** / **`trianglify.utils.colorbrewer`**

Re-exports of chroma-js's `mix()` and the built-in colorbrewer palette map, handy when writing custom palettes and color functions.

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

Trianglify is configured by an options object passed in as the only argument. The following option keys are supported, see below for a complete description of what each option does.

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

The array of color combinations to pick from when using `random` for the xColors or yColors. See [`src/utils/colorbrewer.ts`](./src/utils/colorbrewer.ts) for the format of this data.

**`colorSpace`**

String, defaults to `'lab'`. Set the color space used for generating gradients. Supported values are rgb, hsv, hsl, hsi, lab and hcl. See this [blog post](https://vis4.net/blog/posts/avoid-equidistant-hsv-colors/) for some background on why this matters.

**`colorFunction`**

Specify a custom function for coloring polygons, defaults to `trianglify.colorFunctions.interpolateLinear(0.5)`. Accepts a function to override the standard gradient coloring, which is passed a variety of data about the pattern and each polygon and must return a Chroma.js color object.

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

Array of points ([x, y]) to triangulate, defaults to null. When not specified an array randomised points is generated filling the space. Points must be within the coordinate space defined by `width` and `height`. Not supported with the pentagonal tiling shapes (`pentagon-cairo`, `pentagon-convex`, `pentagon-nonconvex`), which generate their own geometry — combining the two throws a TypeError. See [`examples/custom-points-example.html`](./examples/custom-points-example.html) for a demonstration of how this option can be used to generate circular trianglify patterns.

**`pointGeneration`**

String, defaults to `'grid'`. Selects the algorithm used to generate the pseudo-random point layout that the pattern is built on. Supported values:

- `'grid'` — a jittered square grid (the classic Trianglify look)
- `'poisson'` — Poisson-disc sampling via Bridson's algorithm, for an even, organic distribution
- `'bestCandidate'` — Mitchell's best-candidate sampling, similar to Poisson-disc with a softer look
- `'spiral'` — points along a Fermat (sunflower) spiral, see `spiralDirection` and `spiralRatio`
- `'sphere'` — an orthographic projection of points distributed on a sphere

This option is ignored when `points` is provided or when `shape` is one of the pentagonal tilings. See [`examples/shapes-and-layouts.html`](./examples/shapes-and-layouts.html) for a visual comparison.

**`shape`**

String, defaults to `'triangle'`. Selects the geometry the pattern is built from:

- `'triangle'` — Delaunay triangulation of the generated points (the classic behavior)
- `'pentagon'`, `'hexagon'`, `'heptagon'`, `'octagon'` — one regular polygon per generated point, with the gaps between polygons filled by triangles. With the default `'grid'` point generation, hexagons are arranged in an offset honeycomb layout.
- `'circle'` — one circle per generated point, with gap-filling triangles
- `'pentagon-cairo'` — the equilateral Cairo pentagonal tiling
- `'pentagon-convex'` — a type 5 convex pentagon tiling forming 6-fold rosettes
- `'pentagon-nonconvex'` — a non-convex pentagon tiling forming 12-fold star rosettes

The three `pentagon-*` values generate complete plane tilings directly from `cellSize`, so they ignore the `pointGeneration` and `variance` options — and throw a TypeError if custom `points` are supplied. See [`examples/shapes-and-layouts.html`](./examples/shapes-and-layouts.html) and [`examples/nonconvex-tiling.html`](./examples/nonconvex-tiling.html).

**`spiralDirection`**

String, `'cw'` or `'ccw'`, defaults to `'ccw'`. The winding direction of the spiral when `pointGeneration` is `'spiral'`. Has no effect with other point generation modes.

**`spiralRatio`**

The string `'golden'` or a positive number, defaults to `'golden'`. Controls the divergence angle between consecutive points when `pointGeneration` is `'spiral'`: for a ratio `r` the angle is `2π/r²`, and `'golden'` uses the golden ratio, producing the golden angle (~137.5°) seen in sunflower seed heads. Values near small rational numbers produce visible spiral arms instead of an even fill. Has no effect with other point generation modes.
