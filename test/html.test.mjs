import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml, renderPage } from '../scripts/lib/html.mjs';

test('headings, lists, inline code and paragraphs are converted', () => {
  const html = markdownToHtml('# 見出し\n\n## 小見出し\n\n- 編集: `a.ts`\n- 実行\n\n段落 <b>');
  assert.match(html, /<h1>見出し<\/h1>/);
  assert.match(html, /<h2>小見出し<\/h2>/);
  assert.match(html, /<ul>\n<li>編集: <code>a.ts<\/code><\/li>\n<li>実行<\/li>\n<\/ul>/);
  assert.match(html, /<p>段落 &lt;b&gt;<\/p>/);
});

test('tables are converted with header row', () => {
  const html = markdownToHtml('| a | b |\n|---|---|\n| 1 | x\\|y |');
  assert.match(html, /<table>\n<thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead>\n<tbody>\n<tr><td>1<\/td><td>x\|y<\/td><\/tr>\n<\/tbody>\n<\/table>/);
});

test('html comments are dropped', () => {
  assert.doesNotMatch(markdownToHtml('<!-- summary:start -->\nまとめ\n<!-- summary:end -->'), /summary:start/);
});

test('renderPage wraps body with title and inline css', () => {
  const page = renderPage('作業ノート 2026-08-31', '<p>x</p>');
  assert.match(page, /<title>作業ノート 2026-08-31<\/title>/);
  assert.match(page, /<style>/);
  assert.match(page, /<p>x<\/p>/);
});
