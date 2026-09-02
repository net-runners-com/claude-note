// markdown.mjs — digest → Markdown ノート（純関数）

export const SUMMARY_START = '<!-- summary:start -->';
export const SUMMARY_END = '<!-- summary:end -->';
export const SUMMARY_PLACEHOLDER = '（未記入）';

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (s) => '`' + String(s).replace(/`/g, '´') + '`';

function duration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `約 ${h} 時間 ${m} 分` : `約 ${m} 分`;
}

function timelineEntry(t) {
  const lines = [];
  for (const p of t.edits) lines.push(`- 編集: ${code(p)}`);
  for (const c of t.created) lines.push(`- 生成物: ${code(c.path)}（${c.lines} 行）`);
  for (const c of t.commands) lines.push(`- 実行: ${code(c.command)}${c.description ? ` — ${c.description}` : ''}`);
  if (t.errors) lines.push(`- エラー: ${t.errors} 件`);
  if (t.reply) lines.push(`- 回答: ${t.reply.replace(/\n+/g, ' ')}`);
  if (!lines.length) lines.push('- （操作なし）');
  return [`### ${t.time} ${t.prompt.replace(/\n+/g, ' ')}`, '', ...lines].join('\n');
}

function fileLine(f) {
  const parts = [];
  if (f.writes) parts.push(`Write ${f.lines} 行`);
  if (f.edits) parts.push(`Edit ${f.edits} 回`);
  return `- ${code(f.path)}（${parts.join(' / ')}）`;
}

const listOr = (items, fn) => (items.length ? items.map(fn).join('\n') : '- なし');

export function renderMarkdown(d) {
  const s = d.stats;
  const sections = [
    `# 作業ノート ${d.date}`,
    `## 本日のまとめ\n\n${SUMMARY_START}\n${SUMMARY_PLACEHOLDER}\n${SUMMARY_END}`,
    `## セッション一覧\n\n| 時間帯 | 作業ディレクトリ | 題名 | プロンプト数 |\n|---|---|---|---|\n` +
      (d.sessions.length
        ? d.sessions.map((x) => `| ${x.start}–${x.end} | ${cell(x.cwd)} | ${cell(x.title)} | ${x.prompts} |`).join('\n')
        : '| – | – | 記録なし | 0 |'),
    `## タイムライン\n\n` + (d.timeline.length ? d.timeline.map(timelineEntry).join('\n\n') : '- なし'),
    `## 作成・変更したファイル\n\n` + listOr(d.files, fileLine),
    `## 実行したコマンド\n\n` + listOr(d.commands, (c) => `- ${c.time} ${code(c.command)}${c.description ? ` — ${c.description}` : ''}${c.count > 1 ? `（×${c.count}）` : ''}`),
    `## エラー・失敗\n\n` + listOr(d.errors, (e) => `- ${e.time} ${e.tool}: ${e.text.replace(/\n+/g, ' ')}`),
    `## 統計\n\nセッション ${s.sessions} / プロンプト ${s.prompts} / ツール呼出 ${s.toolUses}（うちサブエージェント ${s.subagentToolUses}）/ 作業時間 ${duration(s.workMinutes)}（推定）` +
      (s.skipped ? `\n\n※ 解析できなかった行: ${s.skipped}` : ''),
  ];
  return sections.join('\n\n') + '\n';
}
