---
name: senangwebs-index
description: Searchable and paginated HTML views from JSON data with multi-field search, templating, and state handling.
version: 1.0.2
package: senangwebs-index
---

# SenangWebs Index (SWI)

## Quick Reference

- **Purpose**: Transform JSON into searchable, paginated HTML views
- **Entry**: `dist/swi.js`
- **Dependencies**: none
- **Scripts**: `npm run build`, `npm run dev`, `npm run test`

## Workflow

Start in `C:\wamp64\www\sw-libraries\senangwebs-index`. Read `README.md`, `package.json`, and touched source files. Match existing patterns, CSS prefix `swi-`.

## HTML Data Attributes

| Attribute | Description |
|---|---|
| `data-swi-id` | Instance identifier |
| `data-swi-source` | URL to JSON data |
| `data-swi-page-size` | Items per page (number) |
| `data-swi-search-key` | Fields to search (comma-separated) |
| `data-swi-template` | HTML template for rendering items |
| `data-swi-value` | Template variable mappings |

## JavaScript API

```js
const index = new SenangWebsIndex({
  container: '#items',
  data,
  itemTemplate
})

index.search(term, keys)   // keys: string, comma-separated string, or array
index.goToPage(n)          // navigate to page
index.render()             // re-render current view
index.destroy()            // cleanup
index.showLoading()        // show loading state
index.hideLoading()        // hide loading state
index.showError(message)   // show error state
```

## Focus Areas

- JSON data fetching and caching
- Multi-field search with 300ms debounce
- Smart pagination with page controls
- Loading/empty/error state toggles
- Template rendering: bind JSON fields to HTML template markers
- CSS classes: all prefixed `swi-`

## Implementation Guidance

- Preserve backward compatibility for all attributes, method signatures, and CSS classes
- Handle fetch errors gracefully with `showError()`
- Debounce must not delay initial render
- Normalize search keys through `_normalizeSearchKeys()` so declarative and programmatic APIs stay consistent
- Test with large datasets for pagination performance

## Validation

```bash
npm run build
npm test
```
