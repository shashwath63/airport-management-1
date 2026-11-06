import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateHost, safeUrl, htmlToText, decodeEntities, findInfoLinks } from '../src/scrape.js';

test('isPrivateHost blocks local, private and internal hosts', () => {
  for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '[::1]', '::ffff:127.0.0.1', 'fd00::1', 'printer.local', 'db.internal', 'intranet']) {
    assert.equal(isPrivateHost(h), true, h);
  }
  for (const h of ['example.com', '8.8.8.8', 'brightsmile.co.uk']) assert.equal(isPrivateHost(h), false, h);
});

test('safeUrl adds https, rejects non-http and private targets', () => {
  assert.equal(safeUrl('example.com').href, 'https://example.com/');
  assert.throws(() => safeUrl('ftp://example.com'), /only http/);
  assert.throws(() => safeUrl('http://127.0.0.1:3000'), /not allowed/);
  assert.throws(() => safeUrl(''), /required/);
});

test('htmlToText keeps content, drops scripts/nav/footer, decodes entities, dedupes', () => {
  const html = `<html><head><style>.x{}</style><script>alert(1)</script></head><body>
    <nav><a href="/">Home</a></nav>
    <h1>Bright Smile &amp; Co</h1><p>Cleaning: $99&nbsp;today</p><p>Cleaning: $99&nbsp;today</p>
    <ul><li>Open Mon&#8211;Fri</li></ul><footer>© 2026 footer stuff</footer></body></html>`;
  const text = htmlToText(html);
  assert.match(text, /Bright Smile & Co/);
  assert.match(text, /Cleaning: \$99 today/);
  assert.match(text, /Open Mon–Fri/);
  assert.doesNotMatch(text, /alert|Home|footer stuff|\.x\{/);
  assert.equal(text.split('\n').filter((l) => l.startsWith('Cleaning')).length, 1);
});

test('decodeEntities handles named and numeric entities', () => {
  assert.equal(decodeEntities('&lt;b&gt; &#39;hi&#x27; &unknown;'), "<b> 'hi' &unknown;");
});

test('findInfoLinks returns same-origin info pages only', () => {
  const html = `<a href="/services">Services</a><a href="/pricing">x</a><a href="https://other.com/about">About</a>
    <a href="/blog/post">Blog</a><a href="/menu.pdf">Menu</a><a href="/contact-us">Contact</a>`;
  assert.deepEqual(findInfoLinks(html, 'https://shop.example/'), [
    'https://shop.example/services', 'https://shop.example/pricing', 'https://shop.example/contact-us',
  ]);
});
