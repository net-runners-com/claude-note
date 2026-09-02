// digest.mjs — 正規化イベント → digest 構造体（純関数）
import { dayOf, timeOf } from './transcript.mjs';
import { redact } from './redact.mjs';

const LIMITS = { prompt: 200, reply: 300, command: 120, error: 200 };
const GAP_MS = 30 * 60 * 1000; // 作業時間推定: この間隔以内なら連続とみなす

// 秘密情報をマスク → 空白・改行を 1 つに畳む → 上限で切る
const cut = (s, n) => (s = redact(String(s ?? '')).replace(/\s+/g, ' ').trim(), s.length > n ? s.slice(0, n) + '…' : s);
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'NotebookEdit']);

function classify(tu, short) {
  const i = tu.input || {};
  if (tu.name === 'Write' && i.file_path) {
    return { kind: 'write', path: short(i.file_path), lines: String(i.content ?? '').split('\n').length };
  }
  if (EDIT_TOOLS.has(tu.name) && (i.file_path || i.notebook_path)) {
    return { kind: 'edit', path: short(i.file_path || i.notebook_path) };
  }
  if (tu.name === 'Bash' && i.command) {
    return { kind: 'command', command: cut(i.command, LIMITS.command), description: cut(i.description, 80) };
  }
  return { kind: 'other' };
}

/** 全イベントの時刻を合成し、GAP_MS 以内の連続区間を合計（並行セッションは重複させない） */
function workMinutes(events) {
  const times = events.map((e) => Date.parse(e.ts)).sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap <= GAP_MS) total += gap;
  }
  return Math.round(total / 60000);
}

/**
 * events → digest
 * - 対象日 (timeZone 基準) 以外の ts 付きイベントは除外
 * - プロンプトが 1 つもないセッション、cwd が exclude のいずれかを含むセッションは除外
 * - home を渡すと cwd / ファイルパスの先頭を ~ に短縮
 */
export function buildDigest(events, { date, timeZone, skipped = 0, exclude = [], home = '' }) {
  const day = events.filter((e) => !e.ts || dayOf(e.ts, timeZone) === date);
  const t = (ts) => timeOf(ts, timeZone);
  const short = (p) => (home && typeof p === 'string' && p.startsWith(home) ? '~' + p.slice(home.length) : p);

  const titles = new Map();
  for (const e of day) if (e.kind === 'title') titles.set(e.sessionId, e.title);
  const errorsById = new Map();
  for (const e of day) if (e.kind === 'tool_result' && e.isError) errorsById.set(e.toolUseId, e);

  // セッション集計 → 除外判定
  const sessions = new Map();
  for (const e of day) {
    if (!e.ts) continue;
    let s = sessions.get(e.sessionId);
    if (!s) sessions.set(e.sessionId, (s = { sessionId: e.sessionId, cwd: e.cwd ?? '', title: titles.get(e.sessionId) ?? '', first: e.ts, last: e.ts, prompts: 0 }));
    if (!s.cwd && e.cwd) s.cwd = e.cwd;
    if (e.ts < s.first) s.first = e.ts;
    if (e.ts > s.last) s.last = e.ts;
    if (e.kind === 'prompt') s.prompts++;
  }
  for (const [id, s] of sessions) {
    if (s.prompts === 0 || exclude.some((p) => p && s.cwd.includes(p))) sessions.delete(id);
  }
  const kept = day.filter((e) => e.ts && sessions.has(e.sessionId)).sort((a, b) => a.ts.localeCompare(b.ts));

  // タイムライン: prompt ごとに、同セッションの次 prompt までの tool_use / reply を束ねる
  const timeline = [];
  const current = new Map(); // sessionId → timeline entry
  const files = new Map();
  const commands = new Map(); // command+description → entry
  const errors = [];
  let toolUses = 0, subagentToolUses = 0;

  for (const e of kept) {
    if (e.kind === 'prompt') {
      const entry = { time: t(e.ts), sessionId: e.sessionId, prompt: cut(e.text, LIMITS.prompt), edits: [], created: [], commands: [], reply: '', errors: 0 };
      timeline.push(entry);
      current.set(e.sessionId, entry);
      continue;
    }
    if (e.kind === 'tool_use') {
      toolUses++;
      if (e.sidechain) { subagentToolUses++; continue; }
      const entry = current.get(e.sessionId);
      const c = classify(e, short);
      const err = errorsById.get(e.id);
      if (err) {
        errors.push({ time: t(e.ts), tool: e.name, text: cut(err.text, LIMITS.error) });
        if (entry) entry.errors++;
      }
      if (c.kind === 'write' || c.kind === 'edit') {
        let f = files.get(c.path);
        if (!f) files.set(c.path, (f = { path: c.path, writes: 0, edits: 0, lines: null }));
        if (c.kind === 'write') { f.writes++; f.lines = c.lines; if (entry) entry.created.push({ path: c.path, lines: c.lines }); }
        else { f.edits++; if (entry && !entry.edits.includes(c.path)) entry.edits.push(c.path); }
      } else if (c.kind === 'command') {
        const key = `${c.command} ${c.description}`;
        const found = commands.get(key);
        if (found) found.count++;
        else commands.set(key, { time: t(e.ts), command: c.command, description: c.description, count: 1 });
        if (entry) entry.commands.push({ command: c.command, description: c.description });
      }
      continue;
    }
    if (e.kind === 'reply' && !e.sidechain) {
      const entry = current.get(e.sessionId);
      if (entry) entry.reply = cut(e.text, LIMITS.reply);
    }
  }

  return {
    date,
    sessions: [...sessions.values()]
      .sort((a, b) => a.first.localeCompare(b.first))
      .map(({ first, last, ...s }) => ({ ...s, cwd: short(s.cwd), start: t(first), end: t(last) })),
    timeline,
    files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)),
    commands: [...commands.values()],
    errors,
    stats: { sessions: sessions.size, prompts: timeline.length, toolUses, subagentToolUses, workMinutes: workMinutes(kept), skipped },
  };
}
