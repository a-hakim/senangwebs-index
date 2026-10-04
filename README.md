# SenangWebs Index (SWI)

A zero-runtime-dependency JavaScript library for searchable, paginated HTML views from JSON data.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Installation

```bash
npm install senangwebs-index
```

The npm entry point exports the constructor through CommonJS:

```javascript
const SenangWebsIndex = require('senangwebs-index');
// Or use the shorter constructor name:
const SWI = require('senangwebs-index');
```

For direct browser inclusion, load both assets. Pin the version you have validated instead of using `@latest` in production. Version 1.1.0 is the unreleased version in this repository; its CDN URLs become available after publication.

```html
<link rel="stylesheet" href="https://unpkg.com/senangwebs-index@1.1.0/dist/swi.css">
<script src="https://unpkg.com/senangwebs-index@1.1.0/dist/swi.js" defer></script>
```

The UMD bundle exposes `window.SenangWebsIndex`, its alias `window.SWI`, and `window.SWIDeclarativeHandler`. Importing the CommonJS constructor requires no DOM; creating an instance requires a browser DOM. Native ESM exports and TypeScript declarations are not included.

Use either `new SenangWebsIndex(options)` or `new SWI(options)` in the browser. Both names refer to the same constructor and accept the same options. The JavaScript source also exports `SWI` as a named alias for projects that bundle the source.

## Declarative quick start

Place a hidden template inside an item wrapper. Search and pagination controls belong outside that wrapper. Bindings insert text, including characters such as `<` and `&`, without interpreting it as HTML.

```html
<div data-swi-id="products" data-swi-source="./data.json"
     data-swi-page-size="10" data-swi-search-key="name,category">
  <label for="product-search">Search products</label>
  <input id="product-search" type="search" data-swi-search-input placeholder="Search...">
  <button type="button" data-swi-search-action>Search</button>
  <div class="swi-item-container swi-grid">
    <div data-swi-template="item" style="display: none;">
      <h3 data-swi-value="item.name"></h3>
      <p data-swi-value="item.description"></p>
    </div>
  </div>
  <div data-swi-pagination></div>
</div>
<script src="./dist/swi.js" defer></script>
```

Instances initialize at DOM readiness. Repeated calls to `SWIDeclarativeHandler.init()` reuse existing instances; call it after adding declarative markup dynamically. Identifiers must be unique. Nested instances must be outside their parent's item wrapper.

```javascript
SWIDeclarativeHandler.init();
const products = SWIDeclarativeHandler.getInstance('products');
products.ready.then(() => products.search('electronics')).catch(console.error);
// products.destroy() unregisters the instance and preserves its template for reinitialization.
// SWIDeclarativeHandler.destroyAll() destroys all registered instances.
```

## Programmatic quick start

Create controls before constructing the instance. `container` identifies only the area SWI may replace. This DOM template uses `textContent` to render untrusted data safely.

```html
<label for="catalog-search">Search products</label>
<input id="catalog-search" type="search">
<div id="catalog-items" class="swi-item-container"></div>
<div id="catalog-pages"></div>
```

```javascript
const catalog = new SWI({
  container: '#catalog-items',
  data: './data.json',
  itemTemplate(item) {
    const card = document.createElement('article');
    card.className = 'swi-item';
    const title = document.createElement('h3');
    title.textContent = item.name;
    const description = document.createElement('p');
    description.textContent = item.description;
    card.append(title, description);
    return card;
  },
  search: { selector: '#catalog-search', searchKey: ['name', 'category'] },
  pagination: { selector: '#catalog-pages', itemsPerPage: 10 }
});

catalog.ready.then(() => {
  catalog.search('electronics');
  catalog.goToPage(2);
}).catch(error => {
  console.error('Catalog initialization failed', error);
});
```

`ready` resolves to the initialized instance. Fetch, JSON, dataset, and initial template failures reject it and display an error state. The library observes rejection internally to prevent unattended initialization from producing an unhandled rejection; callers can still catch it. Clicking Retry reloads only this instance and replaces its `ready` promise. Destroying a pending instance rejects readiness with `AbortError` and prevents late rendering.

## Options

| Option | Accepted values | Behavior |
| --- | --- | --- |
| `container` | CSS selector or DOM `Element` | Required; rendered items and states replace its contents. |
| `data` | Array of non-null objects or nonempty JSON URL | Required; every record is validated. Arrays are shallow-copied. Remote responses must be successful and contain an array. |
| `itemTemplate` | Function returning an `Element` or HTML string | Required; return a separate element per item or a nonempty string with exactly one root element. |
| `search` | Boolean or configuration object | Disabled by default; an object enables it unless `enabled: false`. |
| `pagination` | Boolean or configuration object | Disabled by default; an object enables it unless `enabled: false`. |

Search configuration supports `selector` (an input or a wrapper containing a text/search input), `searchKey` (default `name`), `inputElement`, and optional `actionElement`. Search input events debounce for 300ms; action clicks search immediately and cancel the pending debounce. `search: true` alone does not create an input. Selectors and element references must resolve outside the rendered item container.

Pagination configuration supports `selector`, direct `containerElement`, and `itemsPerPage` (default 10). Page sizes must be positive safe integer numbers. `pagination: true` slices the dataset without creating controls; provide a target to display navigation. Navigation shows first/last pages and up to two neighbors on either side of the current page, with ellipses.

HTML strings are **trusted markup**. SWI does not sanitize them. Never interpolate untrusted JSON directly into strings; prefer DOM templates with `textContent`. Declarative bindings and library-generated messages always insert text.

## Methods and lifecycle

| Interface | Behavior |
| --- | --- |
| `ready` | Promise for the current initialization or retry. |
| `search(query, searchKey)` | Case-insensitive substring search across configured fields; resets the page to 1. Empty queries restore all records. Optional fields apply to that call. |
| `goToPage(page)` | Navigate to an integer page when pagination is enabled; invalid/out-of-range inputs are ignored. |
| `render()` | Rebuild the current view. Invalid template output throws before replacing the previous rendered view. |
| `destroy()` | Abort loading, cancel timers, remove listeners and declarative registration, and clear the owned view. Repeated calls are safe; later UI methods do nothing. |
| `showLoading()` / `hideLoading()` | Manually show/remove the loading state and update `aria-busy`. Call `render()` after manual loading to restore items. |
| `showError(message, details)` | Display text messages and an instance-local Retry button. |

Search fields accept a string, comma-separated string, or array. Whitespace around fields and empty field entries are ignored; an empty field list falls back to `name`. Missing/null values are skipped; zero and false remain searchable. Field names address top-level properties, not nested paths.

```javascript
catalog.search('0', ['stock']);
catalog.search('electronics', 'name, category');
```

## HTML attributes

| Attribute | Behavior |
| --- | --- |
| `data-swi-id` | Required unique instance identifier. |
| `data-swi-source` | Required JSON URL. |
| `data-swi-page-size` | Positive integer digits; omitted defaults to 10. |
| `data-swi-search-key` | Search fields; defaults to `name`. |
| `data-swi-template="item"` | Required hidden template element. |
| `data-swi-value="item.prop"` | Text binding on the template root or descendants; missing/null values become empty text. |
| `data-swi-search-input` | Optional input owned by this instance. |
| `data-swi-search-action` | Optional button for immediate search. |
| `data-swi-pagination` | Optional navigation target owned by this instance. |

## Styling and accessibility

All library CSS classes use the `swi-` prefix. Common classes include `.swi-item`, `.swi-item-container`, `.swi-grid`, `.swi-search-input`, `.swi-pagination-btn`, `.swi-active`, `.swi-loading`, `.swi-empty-state`, and `.swi-error`.

```css
.swi-item { border-radius: 8px; }
.swi-pagination-item.swi-active .swi-pagination-btn { background: #205a9b; }
```

SWI supplies busy indicators, status/error announcements, current-page semantics, navigation focus retention, and reduced-motion styling. Provide labels for your inputs and accessible content in custom templates. Keyboard users can navigate native buttons using Tab and activate them using Enter or Space.

## Browser support and examples

Target the latest two versions of Chrome, Firefox, Safari, and Edge. IE11 is unsupported. Serve examples over HTTP so JSON fetches work; `file://` is not a supported demo setup.

- [Complete demo](examples/demo.html)
- [Declarative example](examples/declarative.html)
- [Programmatic example](examples/programmatic.html)

## Development and release

Use Node.js 24 and the committed lockfile.

```bash
npm ci
npm run dev
npm run build
# Unit tests require explicit authorization under this workspace's AGENTS.md rule.
npm test
npm run verify:package
npm audit
```

Build output consists of `dist/swi.js` and `dist/swi.css`. `prepack` rebuilds the assets before packaging. Package verification inspects the actual tarball, CommonJS import, CDN globals, CSS, and both initialization modes using a development-only DOM environment; it requires the system `tar` command. CI checks tests, package contents, dependency advisories, and committed distribution consistency.

Before publishing, require passing CI and real-browser validation in Chrome, Firefox, Safari, and Edge, including keyboard navigation, error/retry, and teardown. DOM regression checks do not substitute for real-browser validation. See [RELEASE.md](RELEASE.md) for the checklist and [CHANGELOG.md](CHANGELOG.md) for 1.1.0 validation changes. Publishing is a separate authorized release action.

## License and contributions

MIT; see [LICENSE](LICENSE). Pull requests are welcome. Report issues through the [GitHub issue tracker](https://github.com/a-hakim/senangwebs-index/issues).
