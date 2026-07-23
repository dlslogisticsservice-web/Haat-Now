// Website Studio rendering — XSS hardening. The public site body is injected via
// dangerouslySetInnerHTML from the string renderer, so every user field must be escaped
// and every generated href scheme-restricted. These pin both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, safeUrl } from '../rendering/renderer';

test('escapeHtml neutralises the HTML metacharacters', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml(`" onmouseover="x`), '&quot; onmouseover=&quot;x');
  assert.equal(escapeHtml("it's & <b>"), 'it&#39;s &amp; &lt;b&gt;');
});

test('safeUrl blocks javascript: and other executable schemes', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('JavaScript:alert(1)'), '#', 'case-insensitive');
  assert.equal(safeUrl('vbscript:msgbox(1)'), '#');
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '#');
});

test('safeUrl defeats whitespace/control-char obfuscation of the scheme', () => {
  assert.equal(safeUrl('java\tscript:alert(1)'), '#');
  assert.equal(safeUrl(' javascript:alert(1)'), '#');
  assert.equal(safeUrl('java\nscript:alert(1)'), '#');
});

test('safeUrl passes legitimate links unchanged', () => {
  for (const ok of ['https://haatnow.app', 'http://x.test/p?q=1', 'mailto:help@haatnow.app', 'tel:+201000000000', '/about', '#section', 'about']) {
    assert.equal(safeUrl(ok), ok, `${ok} should pass`);
  }
});
