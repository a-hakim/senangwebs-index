const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const bundle = fs.readFileSync(path.join(__dirname, '../dist/swi.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/data.json'), 'utf8'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

for (const filename of ['declarative.html', 'programmatic.html', 'demo.html']) {
  test(`${filename} initializes and wires up its real search input`, async t => {
    const html = fs.readFileSync(path.join(__dirname, '../examples', filename), 'utf8');
    const dom = new JSDOM(html, { url: `https://example.test/examples/${filename}`, runScripts: 'outside-only' });
    const { window } = dom;
    const errors = [];
    window.console.error = (...args) => errors.push(args);
    window.console.log = () => {};
    window.alert = () => {};
    window.fetch = async () => ({ ok: true, json: async () => data });
    t.after(() => {
      if (window.demoDestroy) window.demoDestroy();
      window.SWIDeclarativeHandler.destroyAll();
      window.close();
    });
    for (const script of window.document.querySelectorAll('script')) {
      if (script.src.endsWith('/dist/swi.js')) window.eval(bundle);
      else if (!script.src) window.eval(script.textContent);
    }
    window.SWIDeclarativeHandler.init();
    await Promise.all([...window.SWIDeclarativeHandler.instances.values()].map(instance => instance.ready));
    await pause(0);
    assert.equal(errors.length, 0);
    const input = window.document.querySelector(filename === 'declarative.html'
      ? '[data-swi-search-input]' : filename === 'programmatic.html' ? '#product-search' : '#prog-search-input');
    input.value = 'Laptop Stand';
    input.dispatchEvent(new window.Event('input'));
    await pause(350);
    const target = window.document.querySelector(filename === 'declarative.html'
      ? '.swi-item-container' : filename === 'programmatic.html' ? '#data-container' : '#prog-data');
    assert.match(target.textContent, /Laptop Stand/);
    assert.doesNotMatch(target.textContent, /Wireless Headphones/);
    if (filename === 'demo.html') {
      window.demoReinit();
      window.demoReinit();
      await pause(0);
      assert.equal(window.document.querySelectorAll('#prog-search input').length, 1);
      assert.match(target.textContent, /Wireless Headphones/);
    }
  });
}
