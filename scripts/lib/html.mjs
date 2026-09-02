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
    const para = [];
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
`.trim();

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
