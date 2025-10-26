# SenangWebs Index (SWI) - AI Agent Instructions

## Project Overview
SWI is a zero-dependency JavaScript library (~15KB) that transforms JSON data into searchable, paginated HTML views. It supports **two distinct initialization methods** that share the same underlying architecture.

## Critical Architecture Pattern: Dual Initialization System

### 1. Programmatic API (`SenangWebsIndex` class)
- Direct JavaScript instantiation with template functions
- Container accepts **both CSS selectors AND DOM elements** (important for inheritance)
- Example: `new SenangWebsIndex({ container: '#app', data: './data.json', itemTemplate: (item) => '...' })`

### 2. Declarative HTML (`SWIDeclarativeHandler` + `SWIDeclarativeInstance`)
- Zero JavaScript needed - uses `data-swi-*` attributes
- `SWIDeclarativeHandler.init()` scans DOM on `DOMContentLoaded` for `[data-swi-id]` elements
- Creates `SWIDeclarativeInstance` (extends `SenangWebsIndex`) with auto-generated template functions from `[data-swi-template="item"]` elements
- Template uses `[data-swi-value="item.propertyName"]` for data binding via `textContent`

**Key Inheritance Detail**: `SWIDeclarativeInstance` extends `SenangWebsIndex` and overrides `_init()` to handle declarative-specific search setup. The parent constructor must accept DOM elements directly (not just selectors) because declarative mode passes pre-selected elements.

## Build System & Commands

```bash
npm run build    # Production: Webpack + Babel + Terser (minified, no LICENSE.txt)
npm run dev      # Development: Watch mode with --mode development
```

**Critical**: `webpack.config.js` has `optimization.minimizer` configured with `extractComments: false` to prevent `swi.js.LICENSE.txt` generation. Don't remove this or you'll create unwanted license files.

**UMD Export Pattern**: Entry exports `default SenangWebsIndex` but also exposes:
- `window.SenangWebsIndex` (full class)
- `window.SWI` (shorthand)
- `window.SWIDeclarativeHandler` (for accessing instances by ID)

## State Management Pattern
Each instance maintains:
- `this.data` - Original dataset (immutable after load)
- `this.filteredData` - Current filtered view (modified by search)
- `this.currentPage` - Pagination state
- `this.eventListeners` - Array of `{element, event, handler}` for cleanup in `destroy()`

**Search flow**: `search(query)` → filters `this.data` into `this.filteredData` → resets `currentPage` to 1 → calls `render()`

**Pagination flow**: `goToPage(n)` → updates `currentPage` → calls `render()` → `_getPaginatedData()` slices `filteredData`

## Template System

### Programmatic
User provides function: `itemTemplate: (item) => '<div>...' + item.name + '...</div>'`

### Declarative
`SWIDeclarativeHandler.createTemplateFunction()` generates a function that:
1. Clones the `[data-swi-template="item"]` element
2. Finds all `[data-swi-value]` descendants
3. Extracts property path (e.g., `"item.name"` → `"name"`)
4. Sets `element.textContent = item[propertyName]`
5. Returns `clone.outerHTML`

## CSS Convention
All classes use `swi-` prefix: `.swi-item`, `.swi-pagination-btn`, `.swi-active`, `.swi-disabled`

Source: `src/css/swi.css` - includes responsive breakpoints at 768px

## Testing Strategy
No formal test framework - uses manual browser tests:
- `examples/test.html` - Automated test suite with visual results
- Tests cover: library loading, programmatic API, declarative init, search, pagination, cleanup
- Uses pattern: `try { /* test */ recordTest(name, true) } catch(e) { recordTest(name, false, e.message) }`

## Common Pitfalls

1. **Container Resolution**: When extending `SenangWebsIndex`, always ensure the parent constructor receives either a selector string OR a DOM element, never undefined. Check `typeof options.container`.

2. **Event Listener Cleanup**: Always push to `this.eventListeners` array when adding listeners. Pattern:
   ```javascript
   element.addEventListener(event, handler);
   this.eventListeners.push({ element, event, handler });
   ```

3. **Async Init**: `_init()` and `_loadData()` are async. If overriding in subclass, maintain async/await pattern and proper error handling.

4. **Template Element Visibility**: Declarative templates MUST have `style="display: none;"` or they'll show before processing. The library sets `display: ''` on clones.

5. **Data Source Types**: `options.data` accepts Array OR String (URL). Check with `Array.isArray()` and `typeof === 'string'`.

## File Structure
- `src/js/swi.js` - Single-file library (585 lines): `SenangWebsIndex` → `SWIDeclarativeHandler` → `SWIDeclarativeInstance` → auto-init code
- `src/css/swi.css` - Complete styles including utilities (`.swi-hidden`, `.swi-grid`)
- `examples/` - Five demos: `index.html` (landing), `demo.html` (interactive), `declarative.html`, `programmatic.html`, `test.html`
- `spec.md` - Authoritative specification (reference for feature disputes)

## Debugging
Use browser console:
```javascript
SWIDeclarativeHandler.getInstance('products') // Get declarative instance by ID
instance.data // View original dataset
instance.filteredData // View current filtered data
instance.search('test') // Programmatic search
instance.goToPage(2) // Navigate
```

## Philosophy
"Senang" (Malay for "easy") - prioritize simplicity. Declarative mode should need zero JavaScript knowledge. Programmatic mode should be obvious for JS developers. No dependencies, clean class-based architecture.
