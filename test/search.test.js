const test = require('node:test');
const assert = require('node:assert/strict');
const SenangWebsIndex = require('../dist/swi.js');

function createSearchContext(searchKey = 'name') {
  return {
    data: [
      { name: 'Wireless Headphones', category: 'Electronics', stock: 0 },
      { name: 'Laptop Stand', category: 'Accessories', stock: 12 }
    ],
    filteredData: [],
    currentPage: 2,
    searchConfig: { searchKey },
    renderCalls: 0,
    _normalizeSearchKeys: SenangWebsIndex.prototype._normalizeSearchKeys,
    render() {
      this.renderCalls += 1;
    }
  };
}

test('search supports comma-separated keys with whitespace', () => {
  const context = createSearchContext('name, category');

  SenangWebsIndex.prototype.search.call(context, 'electronics');

  assert.deepEqual(context.filteredData, [context.data[0]]);
  assert.equal(context.currentPage, 1);
  assert.equal(context.renderCalls, 1);
});

test('search accepts an array override and includes falsy values', () => {
  const context = createSearchContext();

  SenangWebsIndex.prototype.search.call(context, '0', ['stock']);

  assert.deepEqual(context.filteredData, [context.data[0]]);
});

test('empty search keys fall back to name', () => {
  const context = createSearchContext(' , ');

  SenangWebsIndex.prototype.search.call(context, 'laptop');

  assert.deepEqual(context.filteredData, [context.data[1]]);
});
