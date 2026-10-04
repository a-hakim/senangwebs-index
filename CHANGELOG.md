# Changelog

## 1.1.0

- Add `instance.ready` to await initialization; failures reject with an observed promise and render a safe error state. Destruction during initialization rejects with `AbortError`.
- Accept DOM `Element` results from item templates. HTML strings remain supported as trusted markup and must contain one root element.
- Render error messages and declarative bindings as text. Retry reloads the instance's data without inline handlers or a page reload.
- Cancel pending loads and debounce timers during destruction. Remove listeners and declarative registrations; allow clean reinitialization.
- Bound pagination controls, retain keyboard focus, announce states, and respect reduced-motion preferences.
- Ship only the intended npm/CDN assets, retain UMD/CommonJS exports, and add reproducible build, regression, and package checks.

### Validation changes

- Templates must be functions and return a nonempty single-root HTML string or a separate `Element` per item.
- Data must be an array of non-null objects or a nonempty JSON URL. Every loaded record is validated; primitives, nulls, arrays as records, and sparse arrays are rejected.
- Programmatic page sizes must be positive safe integer numbers. Declarative page-size attributes must contain positive integer digits. Omitted sizes default to 10; invalid sizes now throw rather than falling back.
- `goToPage()` ignores noninteger, nonnumeric, and out-of-range values.
- Explicit search/pagination targets must exist outside the rendered item container. Create controls before constructing an instance.
- Duplicate declarative identifiers are rejected. Repeated initialization of the same container returns its existing instance.

## 1.0.2

- Normalize multi-field search keys and preserve falsy searchable values such as zero.
