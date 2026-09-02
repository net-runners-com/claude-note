// html.mjs — ノート用の最小 Markdown → HTML 変換（依存ゼロ）
// 対応: 見出し / 箇条書き / 表 / 段落 / インラインコード / HTML コメント除去

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  // インラインコードは中身をエスケープ、それ以外もエスケープ
  return s
    .split(/(`[^`]*`)/)
    .map((p) => (p.startsWith('`') && p.endsWith('`') && p.length >= 2 ? `<code>${esc(p.slice(1, -1))}</code>` : esc(p)))
    .join('');
}

const splitRow = (line) =>
  line.replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

export function markdownToHtml(md) {
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(`<li>${inline(lines[i].slice(2))}</li>`), i++;
      out.push(`<ul>\n${items.join('\n')}\n</ul>`);
      continue;
    }
    if (line.startsWith('|') && i + 1 < lines.length && /^\|?\s*-{3,}/.test(lines[i + 1])) {
      const head = splitRow(line).map((c) => `<th>${inline(c)}</th>`).join('');
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].startsWith('|')) body.push(`<tr>${splitRow(lines[i]).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`), i++;
      out.push(`<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body.join('\n')}\n</tbody>\n</table>`);
      continue;
    }
    // どの構文にも当たらなかった行は段落として必ず 1 行以上消費する（無限ループ防止）
    const para = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !/^(#|- |\|)/.test(lines[i])) para.push(lines[i]), i++;
    out.push(`<p>${inline(para.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }
  return out.join('\n');
}

const CSS = `
:root{color-scheme:light dark;--fg:#1f2328;--bg:#fff;--muted:#59636e;--line:#d1d9e0;--code:#f6f8fa}
@media(prefers-color-scheme:dark){:root{--fg:#e6edf3;--bg:#0d1117;--muted:#9198a1;--line:#3d444d;--code:#161b22}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.7 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:1.7em;border-bottom:1px solid var(--line);padding-bottom:.3em}
h2{font-size:1.25em;margin-top:2em;border-bottom:1px solid var(--line);padding-bottom:.2em}
h3{font-size:1.05em;margin-top:1.4em}
code{background:var(--code);padding:.1em .35em;border-radius:4px;font-size:.9em;word-break:break-all}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;white-space:nowrap}
ul{padding-left:1.4em}li{margin:.2em 0}
p{white-space:pre-wrap}
footer{margin-top:3em;color:var(--muted);font-size:.85em}
[hidden]{display:none!important}
.tabs{display:flex;gap:8px;margin:20px 0 4px;border-bottom:1px solid var(--line)}
.tabs button{appearance:none;border:1px solid var(--line);border-bottom:none;border-radius:8px 8px 0 0;background:var(--code);color:var(--muted);font:inherit;padding:8px 22px;cursor:pointer}
.tabs button.active{background:var(--bg);color:var(--fg);font-weight:600;position:relative;top:1px}
`.trim();

const SUMMARY_SECTIONS = new Set(['本日のまとめ', 'セッション一覧', '統計']);

/** Markdown を「要約」「ログ」の 2 タブ構成のページにする。未知の h2 セクションはログ側 */
export function renderNotePage(title, md) {
  const parts = md.split(/^(?=## )/m); // 先頭チャンク (h1 等) + h2 セクション群
  let head = '', summary = '', log = '';
  for (const p of parts) {
    const m = /^## (.+)$/m.exec(p);
    if (!m) head += p;
    else if (SUMMARY_SECTIONS.has(m[1].trim())) summary += p;
    else log += p;
  }
  const body = `${markdownToHtml(head)}
<nav class="tabs">
<button data-tab="summary" class="active">要約</button>
<button data-tab="log">ログ</button>
</nav>
<section id="tab-summary">
${markdownToHtml(summary)}
</section>
<section id="tab-log" hidden>
${markdownToHtml(log)}
</section>
<script>
for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => {
  for (const x of document.querySelectorAll('.tabs button')) x.classList.toggle('active', x === b);
  document.getElementById('tab-summary').hidden = b.dataset.tab !== 'summary';
  document.getElementById('tab-log').hidden = b.dataset.tab !== 'log';
});
</script>`;
  return renderPage(title, body);
}

export function renderPage(title, bodyHtml) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
${bodyHtml}
<footer>claude-note で生成</footer>
</main>
</body>
</html>
`;
}
