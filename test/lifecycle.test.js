const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const bundle = fs.readFileSync(path.join(__dirname, '../dist/swi.js'), 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const response = data => ({ ok: true, json: async () => data });
const records = count => Array.from({ length: count }, (_, i) => ({ name: `Item ${i + 1}`, stock: i }));

function environment(t, markup = '<input id="search" type="search"><button id="action" type="button">Search</button><div id="items">Original content</div><div id="pages"></div>') {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: 'https://example.test/', runScripts: 'outside-only'
  });
  const { window } = dom;
  const errors = [];
  window.console.error = (...args) => errors.push(args);
  window.fetch = async () => response(records(3));
  window.eval(bundle);
  const instances = [];
  t.after(() => {
    instances.forEach(instance => instance.destroy());
    window.SWIDeclarativeHandler.destroyAll();
    window.close();
  });
  const create = (options = {}) => {
    const instance = new window.SWI({
      container: '#items', data: records(3),
      itemTemplate: item => {
        const element = window.document.createElement('div');
        element.className = 'swi-item';
        element.textContent = item.name;
        return element;
      },
      ...options
    });
    instances.push(instance);
    return instance;
  };
  return { window, document: window.document, create, errors };
}

test('CommonJS import works without a browser and preserves the constructor export', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof require('../dist/swi.js'), 'function');
});

test('CDN globals agree, ready resolves to the instance, and loading is accessible', async t => {
  const { window, document, create } = environment(t);
  assert.equal(window.SWI, window.SenangWebsIndex);
  const instance = create();
  assert.equal(document.querySelector('#items').getAttribute('aria-busy'), 'true');
  assert.equal(document.querySelector('.swi-loading').getAttribute('role'), 'status');
  assert.equal(await instance.ready, instance);
  assert.equal(document.querySelector('#items').getAttribute('aria-busy'), 'false');
  assert.equal(document.querySelectorAll('.swi-item').length, 3);
});

test('invalid options do not replace existing content', t => {
  const { create, document } = environment(t);
  for (const options of [
    { itemTemplate: 'template' }, { data: {} }, { data: ' ' }, { data: [{}, null] },
    { data: [{}, 42] }, { data: [[]] }, { data: new Array(1) },
    ...[0, -1, 1.5, '5', NaN, Infinity, null].map(itemsPerPage => ({ pagination: { itemsPerPage } })),
    { search: { selector: '#missing' } }, { pagination: { selector: '#items' } }
  ]) {
    assert.throws(() => create(options), /SWI:/);
    assert.equal(document.querySelector('#items').textContent, 'Original content');
  }
});

test('DOM templates and error messages keep hostile data as text', async t => {
  const { create, document } = environment(t);
  const hostile = '<img src=x onerror="window.compromised=true">';
  const instance = create({ data: [{ name: hostile }] });
  await instance.ready;
  assert.equal(document.querySelector('.swi-item').textContent, hostile);
  assert.equal(document.querySelector('img'), null);
  instance.showError(hostile, hostile);
  instance.showError(hostile, hostile);
  assert.equal(document.querySelector('h3').textContent, hostile);
  assert.equal(document.querySelector('.swi-error-details').textContent, hostile);
  assert.equal(document.querySelector('img'), null);
  assert.equal(document.querySelector('[onclick]'), null);
  assert.equal(document.querySelector('.swi-error').getAttribute('role'), 'alert');
  assert.equal(instance.eventListeners.length, 1);
});

test('control targets cannot erase their own rendered container or lose a nested input', t => {
  const { create, document } = environment(t, '<section id="host"><div id="items"><input id="nested"></div></section>');
  const original = document.querySelector('#host').innerHTML;
  assert.throws(() => create({ pagination: { selector: '#host' } }), /outside/);
  assert.throws(() => create({ search: { selector: '#host' } }), /outside/);
  assert.equal(document.querySelector('#host').innerHTML, original);
});

test('trusted HTML strings remain supported; invalid outputs reject ready', async t => {
  const { create, document } = environment(t);
  const valid = create({ data: [{}], itemTemplate: () => '<!-- comment --><article class="swi-item">Trusted</article>' });
  await valid.ready;
  assert.equal(document.querySelector('article').textContent, 'Trusted');
  valid.destroy();
  for (const output of ['', ' ', null, 1, 'plain text', '<div></div><div></div>']) {
    const instance = create({ itemTemplate: () => output });
    await assert.rejects(instance.ready, /itemTemplate|root element/);
    assert.ok(document.querySelector('.swi-error'));
    instance.destroy();
  }
});

test('a failing public render preserves the previous view', async t => {
  const { create, document } = environment(t);
  const instance = create();
  await instance.ready;
  const original = document.querySelector('#items').innerHTML;
  instance.itemTemplate = item => item.stock === 1 ? null : '<div>Valid</div>';
  assert.throws(() => instance.render(), /itemTemplate/);
  assert.equal(document.querySelector('#items').innerHTML, original);
  const live = document.querySelector('.swi-item');
  instance.itemTemplate = item => item.stock === 1 ? null : live;
  assert.throws(() => instance.render(), /itemTemplate/);
  assert.equal(document.querySelector('#items').innerHTML, original);
});

test('table and list states retain valid child structures', async t => {
  for (const [markup, selector, tag] of [
    ['<table><thead><tr><th>Name</th><th>Stock</th></tr></thead><tbody id="items"></tbody></table>', '#items', 'tr'],
    ['<ul id="items"></ul>', '#items', 'li']
  ]) {
    const { create, document } = environment(t, markup);
    const instance = create({ container: selector, itemTemplate: item => tag === 'tr'
      ? `<tr class="swi-item"><td>${item.name}</td><td>${item.stock}</td></tr>` : `<li class="swi-item">${item.name}</li>` });
    const validChildren = () => assert.ok([...document.querySelector(selector).children].every(child => child.localName === tag));
    validChildren();
    await instance.ready;
    validChildren();
    instance.search('missing');
    validChildren();
    instance.showError('Error');
    validChildren();
  }
});

test('destroy inside a template callback cannot repopulate the owned view', async t => {
  const { create, document } = environment(t);
  const instance = create();
  await instance.ready;
  instance.itemTemplate = () => {
    instance.destroy();
    return '<div>Late content</div>';
  };
  instance.render();
  assert.equal(document.querySelector('#items').textContent, '');
});

test('collapsing pagination retains focus even without a search input', async t => {
  const { create, document } = environment(t);
  const instance = create({ pagination: { selector: '#pages', itemsPerPage: 1 } });
  await instance.ready;
  document.querySelector('[data-swi-focus="next"]').focus();
  instance.search('Item 2');
  assert.equal(document.activeElement, document.querySelector('#items'));
  instance.destroy();
  assert.equal(document.querySelector('#items').hasAttribute('tabindex'), false);
});

test('network, HTTP, JSON, and dataset errors reject ready and show an error state', async t => {
  const { window, create, document } = environment(t);
  const failures = [
    async () => { throw new Error('Network unavailable'); },
    async () => ({ ok: false, status: 503, statusText: 'Unavailable' }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } }),
    async () => response({ items: [] }),
    async () => response([{}, null]),
    async () => response([{}, 2])
  ];
  for (const fetch of failures) {
    window.fetch = fetch;
    const instance = create({ data: '/data.json' });
    await assert.rejects(instance.ready);
    assert.ok(document.querySelector('.swi-error-retry'));
    assert.equal(document.querySelector('#items').getAttribute('aria-busy'), 'false');
    instance.destroy();
  }
});

test('automatic initialization observes a rejected ready promise', async t => {
  const { window, create } = environment(t);
  window.fetch = async () => { throw new Error('Offline'); };
  const instance = create({ data: '/offline.json' });
  // Leave ready unattended through an event-loop turn; node:test also detects unhandled rejections.
  await pause(20);
  await assert.rejects(instance.ready, /Offline/);
});

test('retry fetches only this instance and replaces ready without duplicating bindings', async t => {
  const { window, document, create } = environment(t);
  let calls = 0;
  window.fetch = async () => {
    calls++;
    if (calls === 1) throw new Error('Offline');
    return response(records(3));
  };
  const instance = create({ data: '/retry.json', search: { selector: '#search' }, pagination: { selector: '#pages', itemsPerPage: 1 } });
  await assert.rejects(instance.ready);
  const previousReady = instance.ready;
  document.querySelector('.swi-error-retry').click();
  assert.notEqual(instance.ready, previousReady);
  await instance.ready;
  assert.equal(calls, 2);
  assert.equal(document.querySelectorAll('.swi-item').length, 1);
  assert.equal(instance.eventListeners.length, 2);
});

test('destroy cancels readiness even when a fetch ignores AbortSignal', async t => {
  const { window, document, create } = environment(t);
  let complete;
  let signal;
  window.fetch = (url, options) => {
    signal = options.signal;
    return new Promise(resolve => { complete = resolve; });
  };
  const instance = create({ data: '/slow.json', search: { selector: '#search' }, pagination: { selector: '#pages' } });
  instance.destroy();
  await assert.rejects(instance.ready, { name: 'AbortError' });
  assert.equal(signal.aborted, true);
  complete(response(records(3)));
  await pause(0);
  assert.equal(document.querySelector('#items').textContent, '');
  assert.equal(document.querySelector('#pages').textContent, '');
  assert.equal(instance.eventListeners.length, 0);
  assert.equal(instance.data.length, 0);
  for (const method of ['destroy', 'render', 'showLoading', 'hideLoading', 'showError', 'search', 'goToPage']) instance[method]();
  assert.equal(document.querySelector('#items').textContent, '');
});

test('destroy during JSON parsing prevents late data assignment', async t => {
  const { window, create } = environment(t);
  let complete;
  window.fetch = async () => ({ ok: true, json: () => new Promise(resolve => { complete = resolve; }) });
  const instance = create({ data: '/slow-json.json' });
  await pause(0);
  instance.destroy();
  await assert.rejects(instance.ready, { name: 'AbortError' });
  complete(records(2));
  await pause(0);
  assert.equal(instance.data.length, 0);
});

test('search is debounced and its action cancels the pending duplicate search', async t => {
  const { window, document, create } = environment(t);
  const instance = create({ search: { selector: '#search', actionElement: document.querySelector('#action') } });
  await instance.ready;
  const original = instance.search.bind(instance);
  let calls = 0;
  instance.search = (...args) => { calls++; original(...args); };
  const input = document.querySelector('#search');
  input.value = 'Item 2';
  input.dispatchEvent(new window.Event('input'));
  assert.equal(calls, 0);
  document.querySelector('#action').click();
  assert.equal(calls, 1);
  await pause(350);
  assert.equal(calls, 1);
  assert.equal(instance.filteredData.length, 1);
  input.value = 'Item 3';
  input.dispatchEvent(new window.Event('input'));
  await pause(350);
  assert.equal(calls, 2);
  assert.equal(instance.filteredData[0].name, 'Item 3');
});

test('destroy cancels debounce timers and removes input listeners', async t => {
  const { window, document, create } = environment(t);
  const instance = create({ search: { selector: '#search' } });
  await instance.ready;
  let calls = 0;
  instance.search = () => { calls++; };
  const input = document.querySelector('#search');
  input.value = 'Item 2';
  input.dispatchEvent(new window.Event('input'));
  instance.destroy();
  input.dispatchEvent(new window.Event('input'));
  await pause(350);
  assert.equal(calls, 0);
  assert.equal(instance._timers.size, 0);
});

test('pagination is bounded, delegated, accessible, and preserves focused navigation', async t => {
  const { document, create } = environment(t);
  const instance = create({ data: records(10000), pagination: { selector: '#pages', itemsPerPage: 1 } });
  await instance.ready;
  for (let i = 1; i <= 100; i++) instance.goToPage(i);
  assert.equal(instance.eventListeners.length, 1);
  assert.ok(document.querySelectorAll('#pages button').length <= 9);
  assert.equal(document.querySelectorAll('.swi-pagination-ellipsis').length, 2);
  assert.equal(document.querySelector('[aria-current="page"]').textContent, '100');
  const next = document.querySelector('[data-swi-focus="next"]');
  next.focus();
  next.click();
  assert.equal(instance.currentPage, 101);
  assert.equal(document.activeElement.dataset.swiFocus, 'next');
  instance.goToPage(10000);
  assert.equal(document.activeElement.getAttribute('aria-current'), 'page');
  assert.ok([...document.querySelectorAll('#pages button')].every(button => button.type === 'button'));
  for (const page of [0, -1, 1.5, NaN, Infinity, '2', 10001]) instance.goToPage(page);
  assert.equal(instance.currentPage, 10000);
});

test('empty datasets and zero search results clear pagination and announce status', async t => {
  const { create, document } = environment(t);
  const instance = create({ pagination: { selector: '#pages', itemsPerPage: 1 } });
  await instance.ready;
  instance.search('missing');
  assert.equal(document.querySelector('#pages').textContent, '');
  assert.match(document.querySelector('.swi-empty-state').textContent, /No results found/);
  assert.equal(document.querySelector('.swi-empty-state').getAttribute('role'), 'status');
  instance.search('');
  assert.equal(document.querySelectorAll('.swi-item').length, 1);
  instance.destroy();
  const empty = create({ data: [] });
  await empty.ready;
  assert.match(document.querySelector('.swi-empty-state').textContent, /No data available/);
});

function declarativeMarkup(id = 'products:one', direct = false) {
  const template = '<div data-swi-template="item" data-swi-value="item.name" style="display:none"></div>';
  return `<section data-swi-id="${id}" data-swi-source="/data.json" data-swi-page-size="1">
    <input type="search" data-swi-search-input><button type="button" data-swi-search-action>Search</button>
    ${direct ? template : `<div class="items">${template}</div>`}<div data-swi-pagination></div></section>`;
}

test('declarative init is idempotent, supports arbitrary IDs and root bindings, and can reinitialize after destroy', async t => {
  const { window, document } = environment(t, declarativeMarkup());
  const handler = window.SWIDeclarativeHandler;
  const host = document.querySelector('section');
  const instance = handler.createInstance(host);
  await instance.ready;
  handler.init();
  assert.equal(handler.createInstance(host), instance);
  assert.equal(handler.getInstance('products:one'), instance);
  assert.equal(document.querySelector('.swi-item').textContent, 'Item 1');
  assert.equal(document.querySelector('[data-swi-pagination]').id, '');
  assert.equal(instance.eventListeners.length, 3);
  instance.destroy();
  assert.equal(handler.getInstance('products:one'), undefined);
  assert.ok(document.querySelector('[data-swi-template]'));
  const replacement = handler.createInstance(host);
  await replacement.ready;
  assert.notEqual(replacement, instance);
  assert.equal(document.querySelector('.swi-item').textContent, 'Item 1');
});

test('direct-child declarative templates preserve surrounding controls on repeated initialization', async t => {
  const { window, document } = environment(t, declarativeMarkup('direct', true));
  const handler = window.SWIDeclarativeHandler;
  const host = document.querySelector('section');
  for (let i = 0; i < 3; i++) {
    const instance = handler.createInstance(host);
    await instance.ready;
    assert.equal(host.querySelectorAll('.swi-item-container').length, 1);
    assert.ok(host.querySelector('[data-swi-search-input]'));
    instance.destroy();
    assert.equal(host.querySelectorAll('.swi-item-container').length, 0);
    assert.ok(host.querySelector('[data-swi-template]'));
  }
});

test('duplicate declarative IDs are rejected without replacing the original instance', async t => {
  const { window, document } = environment(t, declarativeMarkup('same') + declarativeMarkup('same'));
  const handler = window.SWIDeclarativeHandler;
  const hosts = document.querySelectorAll('section');
  const original = handler.createInstance(hosts[0]);
  const originalMarkup = hosts[1].innerHTML;
  assert.throws(() => handler.createInstance(hosts[1]), /duplicate/);
  await original.ready;
  assert.equal(handler.getInstance('same'), original);
  assert.equal(hosts[1].innerHTML, originalMarkup);
});

test('invalid declarative page sizes are rejected before DOM changes', t => {
  const { window, document } = environment(t, declarativeMarkup());
  const host = document.querySelector('section');
  for (const size of ['0', '-1', '1.5', '10px', '', 'Infinity', '9007199254740992']) {
    host.setAttribute('data-swi-page-size', size);
    const markup = host.innerHTML;
    assert.throws(() => window.SWIDeclarativeHandler.createInstance(host), /itemsPerPage/);
    assert.equal(host.innerHTML, markup);
  }
});

test('nested declarative instances use their own templates and controls', async t => {
  const markup = declarativeMarkup('outer', true).replace('</section>', declarativeMarkup('inner') + '</section>');
  const { window, document } = environment(t, markup);
  window.SWIDeclarativeHandler.init();
  const outer = window.SWIDeclarativeHandler.getInstance('outer');
  const inner = window.SWIDeclarativeHandler.getInstance('inner');
  await Promise.all([outer.ready, inner.ready]);
  inner.search('Item 2');
  assert.equal(inner.filteredData.length, 1);
  assert.equal(outer.filteredData.length, 3);
  assert.equal(document.querySelectorAll('.swi-item').length, 2);
});
