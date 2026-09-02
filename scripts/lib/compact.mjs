// compact.mjs — Claude が「本日のまとめ」を書くために読む、短縮版 digest
// 予算 (文字数) を超える場合は 返答を落とす → タイムラインを切り詰める の順で縮める

const cut = (s, n) => (s = String(s ?? ''), s.length > n ? s.slice(0, n) + '…' : s);

// level 1: 返答あり / 2: 返答なし / 3: プロンプト 60 字 + エラー数のみ
function base(d, level) {
  return {
    compact: true,
    date: d.date,
    notePath: d.notePath,
    sessions: d.sessions,
    timeline: d.timeline.map((t) => {
      if (level >= 3) return { time: t.time, prompt: cut(t.prompt, 60), errors: t.errors };
      const e = { time: t.time, prompt: cut(t.prompt, 120), edits: t.edits.length, created: t.created.length, commands: t.commands.length, errors: t.errors };
      if (level === 1 && t.reply) e.reply = cut(t.reply, 160);
      return e;
    }),
    files: level >= 2 ? d.files.slice(0, 40).map((f) => f.path) : d.files.map((f) => f.path),
    fileCount: d.files.length,
    commandCount: d.commands.reduce((a, c) => a + c.count, 0),
    errors: (level >= 2 ? d.errors.slice(0, 15) : d.errors).map((e) => ({ time: e.time, tool: e.tool, text: cut(e.text, level >= 2 ? 60 : 100) })),
    errorCount: d.errors.length,
    stats: d.stats,
  };
}

const size = (o) => JSON.stringify(o).length;

export function compactDigest(d, budget = 12000) {
  let c;
  for (const level of [1, 2, 3]) {
    c = base(d, level);
    if (size(c) <= budget) return c;
  }
  const total = c.timeline.length;
  while (c.timeline.length > 1 && size(c) > budget) {
    c.timeline = c.timeline.slice(0, Math.ceil(c.timeline.length / 2));
    c.truncated = `タイムラインは ${total} 件中 ${c.timeline.length} 件のみ。全文は notePath の Markdown を参照`;
  }
  return c;
}
