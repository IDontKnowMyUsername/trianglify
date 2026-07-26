# Trianglify examples

**Prerequisite:** every example loads the library from `../dist/`, so build it
first:

```
pnpm install
pnpm run build
```

The HTML examples can then be opened directly in a browser — except
`web-worker-example.html`, which must be served over HTTP (browsers refuse to
start workers from `file://` URLs):

```
npx serve .   # then open http://localhost:3000/examples/
```

## Browser (HTML)

| Example | Shows |
|---|---|
| [`basic-web-example.html`](./basic-web-example.html) | Minimal SVG + canvas rendering |
| [`destsvg-example.html`](./destsvg-example.html) | Rendering into an existing `<svg>` element (and safe re-rendering) |
| [`custom-points-example.html`](./custom-points-example.html) | Supplying your own point layout (circular patterns) |
| [`color-function-example.html`](./color-function-example.html) | Built-in color functions (`sparkle`, `interpolateLinear`, `shadows`, `radial`, `angular`) and writing a custom one |
| [`transparency-example.html`](./transparency-example.html) | Transparent / overlay SVG output |
| [`shapes-and-layouts.html`](./shapes-and-layouts.html) | Every `shape` and every `pointGeneration` mode, side by side |
| [`nonconvex-tiling.html`](./nonconvex-tiling.html) | The pentagonal tiling shapes |
| [`nonconvex-rosette.html`](./nonconvex-rosette.html) | Standalone interactive geometry editor for the nonconvex rosette |
| [`web-worker-example.html`](./web-worker-example.html) | Off-main-thread generation with `TrianglifyWorker` (HTTP only) |

## Node

| Example | Shows |
|---|---|
| [`save-as-svg.cjs`](./save-as-svg.cjs) | CommonJS: write a pattern to an SVG file |
| [`save-as-png.cjs`](./save-as-png.cjs) | CommonJS: PNG output via the optional `canvas` package |
| [`esm-node-example.mjs`](./esm-node-example.mjs) | Node ESM: `import trianglify from 'trianglify'` |

## TypeScript

| Example | Shows |
|---|---|
| [`typescript-example.ts`](./typescript-example.ts) | Typed options, a typed custom color function, and `toData()`/`fromData()` caching — compile-checked in CI |
