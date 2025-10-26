# SenangWebs Index (SWI)

A lightweight and versatile JavaScript library designed to effortlessly parse JSON data and render it into a searchable and paginated HTML view.

## Features

- **Two Initialization Methods**: Declarative HTML attributes or programmatic JavaScript
- **Built-in Search**: Real-time filtering of data
- **Pagination**: Automatic pagination for large datasets
- **Customizable**: Easy to style and extend
- **Zero Dependencies**: Pure JavaScript (ES6+)
- **Universal Support**: Works in all modern browsers

## Installation

### Via NPM

```bash
npm install senangwebs-index
```

### Via CDN

```html
<link rel="stylesheet" href="path/to/dist/swi.css" />
<script src="path/to/dist/swi.js"></script>
```

## Quick Start

### Declarative Initialization (HTML Attributes)

The simplest way to get started - no JavaScript required!

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <link rel="stylesheet" href="dist/swi.css" />
  </head>
  <body>
    <div
      data-swi-id="products"
      data-swi-source="./data.json"
      data-swi-page-size="10"
      data-swi-search-key="name"
    >
      <!-- Search -->
      <div>
        <input type="text" data-swi-search-input placeholder="Search..." />
        <button data-swi-search-action>Search</button>
      </div>

      <!-- Items Container -->
      <div class="swi-item-container">
        <!-- Template (hidden, will be cloned for each item) -->
        <div data-swi-template="item" style="display: none;">
          <h3 data-swi-value="item.name"></h3>
          <p data-swi-value="item.description"></p>
          <span data-swi-value="item.price"></span>
        </div>
      </div>

      <!-- Pagination -->
      <div data-swi-pagination></div>
    </div>

    <script src="dist/swi.js"></script>
  </body>
</html>
```

### Programmatic Initialization (JavaScript)

For more control and dynamic setups:

```javascript
import SenangWebsIndex from "senangwebs-index";

const swi = new SenangWebsIndex({
  container: "#my-container",
  data: "./data.json", // or an array of objects
  itemTemplate: (item) => `
    <div class="swi-item">
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <span>$${item.price}</span>
    </div>
  `,
  search: {
    enabled: true,
    selector: "#search-container",
    searchKey: "name",
  },
  pagination: {
    enabled: true,
    selector: "#pagination-container",
    itemsPerPage: 10,
  },
});
```

## API Reference

### Constructor Options

| Option         | Type           | Required | Description                              |
| -------------- | -------------- | -------- | ---------------------------------------- |
| `container`    | String         | Yes      | CSS selector for the container element   |
| `data`         | Array/String   | Yes      | Data array or URL to JSON file           |
| `itemTemplate` | Function       | Yes      | Function that returns HTML for each item |
| `search`       | Object/Boolean | No       | Search configuration                     |
| `pagination`   | Object/Boolean | No       | Pagination configuration                 |

### Search Configuration

```javascript
search: {
  enabled: true,
  selector: '#search-input',
  searchKey: 'name' // Property to search in
}
```

### Pagination Configuration

```javascript
pagination: {
  enabled: true,
  selector: '#pagination',
  itemsPerPage: 10
}
```

### Methods

- `render()` - Manually trigger a re-render
- `search(query)` - Programmatically search
- `goToPage(pageNumber)` - Navigate to a specific page
- `destroy()` - Clean up and remove all event listeners

## HTML Attributes Reference

### Container Attributes

- `data-swi-id="unique-id"` - **Required**: Unique identifier
- `data-swi-source="./data.json"` - **Required**: JSON data source URL
- `data-swi-page-size="10"` - Items per page (default: 10)
- `data-swi-search-key="name"` - Property to search (default: 'name')

### Component Attributes

- `data-swi-template="item"` - Marks the template element
- `data-swi-value="item.property"` - Binds data to element text
- `data-swi-search-input` - Designates search input field
- `data-swi-search-action` - Designates search button
- `data-swi-pagination` - Designates pagination container

## Examples

### Example 1: Product Catalog

```html
<div
  data-swi-id="catalog"
  data-swi-source="./products.json"
  data-swi-page-size="12"
>
  <input type="text" data-swi-search-input placeholder="Search products..." />

  <div class="swi-item-container swi-grid">
    <div data-swi-template="item" style="display: none;">
      <img data-swi-value="item.image" alt="" />
      <h3 data-swi-value="item.name"></h3>
      <p data-swi-value="item.price"></p>
    </div>
  </div>

  <div data-swi-pagination></div>
</div>
```

### Example 2: Data Table

```javascript
const table = new SenangWebsIndex({
  container: "#data-table",
  data: [
    { id: 1, name: "John Doe", email: "john@example.com", role: "Admin" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", role: "User" },
  ],
  itemTemplate: (item) => `
    <tr class="swi-item">
      <td>${item.id}</td>
      <td>${item.name}</td>
      <td>${item.email}</td>
      <td>${item.role}</td>
    </tr>
  `,
  pagination: {
    enabled: true,
    selector: "#pagination",
    itemsPerPage: 20,
  },
});
```

## Styling

SWI comes with default styles that you can customize. All classes use the `swi-` prefix:

- `.swi-container` - Main container
- `.swi-item` - Individual items
- `.swi-item-container` - Items wrapper
- `.swi-pagination-list` - Pagination list
- `.swi-pagination-btn` - Pagination buttons
- `.swi-active` - Active pagination button

### Custom Styling

```css
/* Override default styles */
.swi-item {
  background: #f5f5f5;
  padding: 20px;
  margin: 10px 0;
}

.swi-pagination-btn {
  background: #007bff;
  color: white;
}
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- No IE11 support (uses ES6+ features)

## Build from Source

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build
```

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.
