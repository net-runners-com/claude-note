import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml, renderPage, renderNotePage, renderArtifact } from '../scripts/lib/html.mjs';

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

test('a table row without a separator line terminates as a paragraph', () => {
  assert.match(markdownToHtml('| a |\n\nx'), /<p>\| a \|<\/p>/);
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

test('renderNotePage splits sections into summary and log tabs', () => {
  const md = ['# 作業ノート 2026-09-02', '## 本日のまとめ', 'まとめ文', '## セッション一覧', '| a |\n|---|\n| 1 |',
    '## タイムライン', '### 10:00 x', '- 編集: `a`', '## 作成・変更したファイル', '- なし',
    '## 実行したコマンド', '- なし', '## エラー・失敗', '- なし', '## 統計', 'セッション 1'].join('\n\n');
  const page = renderNotePage('作業ノート 2026-09-02', md);
  const summary = /<section id="tab-summary"[^>]*>([\s\S]*?)<\/section>/.exec(page)[1];
  const log = /<section id="tab-log"[^>]*>([\s\S]*?)<\/section>/.exec(page)[1];
  assert.match(page, /<button[^>]*data-tab="summary"[^>]*>要約<\/button>/);
  assert.match(page, /<button[^>]*data-tab="log"[^>]*>ログ<\/button>/);
  for (const h of ['本日のまとめ', 'セッション一覧', '統計']) assert.match(summary, new RegExp(`<h2>${h}</h2>`));
  for (const h of ['タイムライン', '作成・変更したファイル', '実行したコマンド', 'エラー・失敗']) assert.match(log, new RegExp(`<h2>${h}</h2>`));
  assert.match(page, /<section id="tab-log" hidden>/);
  assert.match(page, /<section id="tab-summary">/);
});

test('renderArtifact emits title, style and tabs without a doctype skeleton', () => {
  const md = '# 作業ノート 2026-09-02\n\n## 本日のまとめ\n\nx\n\n## タイムライン\n\n- y';
  const art = renderArtifact('作業ノート 2026-09-02', md);
  assert.match(art, /^<title>作業ノート 2026-09-02<\/title>/);
  assert.match(art, /<style>/);
  assert.match(art, /data-tab="log"/);
  assert.doesNotMatch(art, /<!doctype|<html|<head>|<body>/i);
});
