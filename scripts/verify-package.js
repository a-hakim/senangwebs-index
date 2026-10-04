// Verify the actual npm tarball, including prepack, rather than just the working tree.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { JSDOM } = require('jsdom');

async function main() {
  const root = path.resolve(__dirname, '..');
  const cache = path.join(root, '.cache');
  fs.mkdirSync(cache, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(cache, 'package-'));
  try {
    assert.ok(process.env.npm_execpath, 'Run this check with npm run verify:package');
    const output = execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--json',
      '--pack-destination', temporary, '--cache', path.join(cache, 'npm')], { cwd: root, encoding: 'utf8' });
    // Lifecycle tools may write build logs before npm's final JSON report.
    const jsonStart = output.search(/^\s*\[\s*\{/m);
    assert.ok(jsonStart >= 0, 'npm pack did not return a JSON package report');
    const [packed] = JSON.parse(output.slice(jsonStart));
    assert.deepEqual(packed.files.map(file => file.path).sort(),
      ['CHANGELOG.md', 'LICENSE', 'README.md', 'RELEASE.md', 'dist/swi.css', 'dist/swi.js', 'package.json'].sort());
    execFileSync('tar', ['-xf', path.join(temporary, packed.filename), '-C', temporary]);
    const directory = path.join(temporary, 'package');
    const metadata = require(path.join(directory, 'package.json'));
    assert.equal(metadata.version, require('../package.json').version);
    assert.ok(!metadata.dependencies || Object.keys(metadata.dependencies).length === 0);
    assert.equal(typeof require(directory), 'function');
    const css = fs.readFileSync(path.join(directory, 'dist/swi.css'), 'utf8');
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /swi-pagination-btn/);
    const bundle = fs.readFileSync(path.join(directory, 'dist/swi.js'), 'utf8');
    const dom = new JSDOM('<!doctype html><div id="items"></div><section data-swi-id="declarative" data-swi-source="/data.json"><div><div data-swi-template="item"><span data-swi-value="item.name"></span></div></div></section>',
      { runScripts: 'outside-only', url: 'https://example.test/' });
    try {
      dom.window.fetch = async () => ({ ok: true, json: async () => [{ name: '<safe>' }] });
      dom.window.eval(bundle);
      assert.equal(dom.window.SWI, dom.window.SenangWebsIndex);
      const instance = new dom.window.SWI({ container: '#items', data: [{}], itemTemplate: () => '<article>Packaged</article>' });
      await instance.ready;
      assert.equal(dom.window.document.querySelector('article').textContent, 'Packaged');
      dom.window.SWIDeclarativeHandler.init();
      await dom.window.SWIDeclarativeHandler.getInstance('declarative').ready;
      assert.equal(dom.window.document.querySelector('.swi-item span').textContent, '<safe>');
      instance.destroy();
      dom.window.SWIDeclarativeHandler.destroyAll();
    } finally { dom.window.close(); }
    console.log(`Verified ${packed.filename}: allowed files, CommonJS, CDN globals, CSS, and both initialization modes.`);
  } finally {
    // Delete only the unique verification directory created beneath this repo's cache.
    assert.equal(path.dirname(temporary), cache);
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
