#!/usr/bin/env node
// build-note.mjs — 対象日の Claude Code transcript からノート (.md) を生成し、digest を JSON で stdout に出す
//
//   node build-note.mjs [--date YYYY-MM-DD] [--projects-dir DIR] [--out DIR]
//
// 既定: date=今日(ローカル), projects-dir=~/.claude/projects, out=$CLAUDE_NOTE_DIR/notes or ~/.claude-note/notes
// exit 2: transcript ディレクトリが存在しない

import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseTranscript, dayOf } from './lib/transcript.mjs';
import { buildDigest } from './lib/digest.mjs';
import { renderMarkdown } from './lib/markdown.mjs';
import { compactDigest } from './lib/compact.mjs';

export function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) a[k.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return a;
}

export function defaultNoteDir() {
  return join(process.env.CLAUDE_NOTE_DIR || join(homedir(), '.claude-note'), 'notes');
}

/**
 * 対象日 00:00 (ローカル) 以降に更新された transcript を列挙
 *   <proj>/<session>.jsonl                      本体
 *   <proj>/<session>/subagents/agent-*.jsonl    サブエージェント (isSidechain)
 */
export function listTranscripts(projectsDir, date) {
  const since = new Date(`${date}T00:00:00`).getTime(); // ローカル解釈
  const files = [];
  const scan = (dir, depth) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) { if (depth < 3) scan(p, depth + 1); continue; }
      if (!ent.name.endsWith('.jsonl')) continue;
      try { if (statSync(p).mtimeMs >= since) files.push(p); } catch { /* 消えた場合は無視 */ }
    }
  };
  scan(projectsDir, 0);
  return files;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = typeof args.date === 'string' ? args.date : dayOf(new Date().toISOString(), timeZone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error(`日付の形式が不正: ${date}`); return 1; }
  const projectsDir = typeof args['projects-dir'] === 'string' ? args['projects-dir'] : join(homedir(), '.claude', 'projects');
  const outDir = typeof args.out === 'string' ? args.out : defaultNoteDir();

  if (!existsSync(projectsDir)) { console.error(`transcript ディレクトリがありません: ${projectsDir}`); return 2; }

  const events = [];
  let skipped = 0;
  for (const f of listTranscripts(projectsDir, date)) {
    const r = parseTranscript(readFileSync(f, 'utf8'));
    events.push(...r.events);
    skipped += r.skipped;
  }
  // CLAUDE_NOTE_EXCLUDE: cwd に含まれていたら除外する部分文字列 (カンマ区切り)。既定 ".claude-mem"
  const exclude = (process.env.CLAUDE_NOTE_EXCLUDE ?? '.claude-mem').split(',').map((x) => x.trim()).filter(Boolean);
  const digest = buildDigest(events, { date, timeZone, skipped, exclude, home: homedir() });
  if (digest.stats.sessions === 0) {
    process.stdout.write(JSON.stringify({ empty: true, date }) + '\n');
    return 0;
  }
  mkdirSync(outDir, { recursive: true });
  const notePath = join(outDir, `${date}.md`);
  writeFileSync(notePath, renderMarkdown(digest));
  process.stdout.write(JSON.stringify(compactDigest({ ...digest, notePath })) + '\n');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
