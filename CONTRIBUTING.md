# Contributing Guidelines

Pull requests and issues are welcome! For all contributions, please:

1. Read the [Readme](Readme.md)
2. Search the existing [issues](https://github.com/qrohlf/trianglify/issues?q=is%3Aissue+) and [pull requests](https://github.com/qrohlf/trianglify/pulls?q=is%3Apr) to make sure your contribution isn't a duplicate

## Issues

If you're submitting a bug, please include the environment (browser/node) and relevant environment version(s) that you have encountered the bug in.

## Pull Requests

*Important: if you are submitting a pull request that does not address an open issue in the issue tracker, it would be a very good idea to create an issue to discuss your proposed changes/additions before working on them.*

1. Fork the repo on GitHub.
2. Use Node 22 (`.nvmrc`) — any Node >= 20 works; CI tests 20/22/24.
3. Install dependencies with `pnpm install` (the pnpm version is pinned via `packageManager`).
4. Create a topic branch and make your changes.
5. Run `pnpm run ci` to typecheck, lint, build, validate packaging, and test your code.
6. Submit a pull request to merge your topic branch into `master`.

## Development notes

- **Build before testing.** The test suites load the built bundles from `dist/`, not the source — run `pnpm run build` first (`pnpm test` will refuse to run against a stale or missing build). `pnpm run ci` sequences everything correctly.
- **Coverage thresholds are enforced.** Coverage is measured against `src/` (bundle coverage is mapped back through source maps) and `pnpm run test:coverage` fails if it drops below the thresholds in `package.json` — add tests along with new code.
- **Packaging is validated.** `pnpm run lint:package` runs [publint](https://publint.dev) and [arethetypeswrong](https://arethetypeswrong.github.io) against the built package; it runs as part of `ci`.
- `pnpm run dev` rebuilds the bundles on change (watch mode).
- To view the HTML examples in `examples/`, build first, then serve the repo root over HTTP (e.g. `npx serve .`) — the worker example in particular can't run from `file://`.
- Design notes live in [`docs/`](docs/), including the exact geometry derivations for the pentagonal tilings.
