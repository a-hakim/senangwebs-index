# SenangWebs Index maintainer instructions

SWI is a browser library with zero runtime dependencies. Preserve its documented 1.x API, `data-swi-*` attributes, `swi-` classes, UMD globals, and CommonJS constructor export.

## Architecture

- `src/js/swi.js` contains the constructor and declarative handler. Both initialization styles share readiness, data loading, search, pagination, and cleanup.
- `instance.ready` resolves after initial rendering or rejects on failure. Observe failures internally without changing the promise exposed to callers.
- Loads use an operation token and AbortController. Destruction must cancel readiness and prevent late data assignment, listener attachment, or rendering, even if a fetch implementation ignores cancellation.
- All listener registrations go through `_listen()` and are removed by `_clearBindings()`. Debounce timers are cancellable. Pagination uses one delegated listener.
- Declarative templates are retained independently of rendering and restored on destruction. Container registrations are idempotent; identifiers must be unique. Nested instances own their own controls.
- Validate required options and local data before DOM changes. Validate every remote record. Page sizes are positive safe integers.

## Rendering and accessibility

- Prefer DOM `Element` templates with `textContent` for untrusted data. HTML string templates remain trusted markup with exactly one root element.
- Library messages and declarative root/descendant bindings always use text insertion.
- Build the next item view before replacing the current one. Preserve table/list child structure for generated states.
- Keep bounded pagination, accessible busy/status/current-page semantics, keyboard focus retention, explicit button types, and reduced-motion styling.
- Retry uses a registered handler to reload the current instance, with no inline script or page reload.

## Build and packaging

Use Node.js 24 and `npm ci` with the committed lockfile. Webpack builds CSS and JavaScript together into `dist/swi.js` and `dist/swi.css`, removing stale assets. Keep Terser's `extractComments: false`; do not produce an extra `styles.js` UMD bundle. Browser targets match the README; IE11 is unsupported.

Package version metadata is authoritative. Update `package.json`, `package-lock.json`, `SKILLS.md`, README examples, and release notes together. `prepack` builds before packing; the file allowlist defines the distributable contents.

## Validation

**Ask before running any unit tests unless the current session already authorizes them.** Tests use `node:test` and development-only jsdom, including the actual bundle and example scripts. `npm test` rebuilds first. `npm run verify:package` checks the actual tarball, CommonJS import, CDN globals, CSS, and both initialization modes. CI checks reproducible installation, tests, package contents, dependency advisories, and committed distribution consistency.

DOM simulation does not prove browser or screen-reader behavior. Complete and record the real-browser checks in `RELEASE.md` before publishing. Publishing requires separate authorization.
