import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const S = 'sess-fixture';
const base = { sessionId: S, cwd: '/proj', isSidechain: false, type: 'user' };
const rows = [
  { type: 'ai-title', sessionId: S, aiTitle: 'フィクスチャ' },
  { ...base, timestamp: '2026-08-31T01:00:00Z', message: { role: 'user', content: 'READMEを書いて' } },
  { ...base, type: 'assistant', timestamp: '2026-08-31T01:00:05Z', message: { role: 'assistant', content: [
    { type: 'tool_use', id: 't1', name: 'Write', input: { file_path: '/proj/README.md', content: '# hi\nbody' } } ] } },
  { ...base, timestamp: '2026-08-31T01:00:06Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } },
  { ...base, type: 'assistant', timestamp: '2026-08-31T01:00:10Z', message: { role: 'assistant', content: [{ type: 'text', text: '書きました。' }] } },
];

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'claude-note-'));
  const proj = join(root, 'projects', '-proj');
  mkdirSync(proj, { recursive: true });
  writeFileSync(join(proj, `${S}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n{broken\n');
  const sub = join(proj, S, 'subagents');
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, 'agent-1.jsonl'), [
    { ...base, isSidechain: true, timestamp: '2026-08-31T01:00:07Z', message: { role: 'user', content: 'サブタスク' } },
    { ...base, isSidechain: true, type: 'assistant', timestamp: '2026-08-31T01:00:08Z', message: { role: 'assistant', content: [
      { type: 'tool_use', id: 'st1', name: 'Read', input: { file_path: '/proj/x' } } ] } },
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');
  return { root, projects: join(root, 'projects'), out: join(root, 'notes') };
}

function run(args, env = {}) {
  return execFileSync('node', ['scripts/build-note.mjs', ...args], { encoding: 'utf8', env: { ...process.env, TZ: 'Asia/Tokyo', ...env } });
}

test('writes the note and prints the digest for the target day', () => {
  const { projects, out } = setup();
  const stdout = run(['--date', '2026-08-31', '--projects-dir', projects, '--out', out]);
  const digest = JSON.parse(stdout);
  assert.equal(digest.stats.prompts, 1);
  assert.equal(digest.stats.skipped, 1);
  assert.equal(digest.stats.toolUses, 2);
  assert.equal(digest.stats.subagentToolUses, 1);
  assert.equal(digest.sessions[0].title, 'フィクスチャ');
  assert.equal(digest.notePath, join(out, '2026-08-31.md'));
  assert.equal(digest.compact, true);
  assert.equal(digest.files[0], '/proj/README.md');
  const md = readFileSync(join(out, '2026-08-31.md'), 'utf8');
  assert.match(md, /^# 作業ノート 2026-08-31/);
  assert.match(md, /生成物: `\/proj\/README.md`（2 行）/);
});

test('reports empty when the day has no records', () => {
  const { projects, out } = setup();
  const digest = JSON.parse(run(['--date', '2026-01-01', '--projects-dir', projects, '--out', out]));
  assert.deepEqual(digest, { empty: true, date: '2026-01-01' });
  assert.equal(existsSync(join(out, '2026-01-01.md')), false);
});

test('CLAUDE_NOTE_DIR env sets the output directory', () => {
  const { projects, root } = setup();
  const digest = JSON.parse(run(['--date', '2026-08-31', '--projects-dir', projects], { CLAUDE_NOTE_DIR: join(root, 'envout') }));
  assert.equal(digest.notePath, join(root, 'envout', 'notes', '2026-08-31.md'));
});

test('missing projects dir exits with code 2', () => {
  assert.throws(() => run(['--date', '2026-08-31', '--projects-dir', '/nonexistent/xyz']), (e) => e.status === 2);
});

test('CLAUDE_NOTE_EXCLUDE drops sessions by cwd substring', () => {
  const { projects, out } = setup();
  const digest = JSON.parse(run(['--date', '2026-08-31', '--projects-dir', projects, '--out', out], { CLAUDE_NOTE_EXCLUDE: '/proj' }));
  assert.deepEqual(digest, { empty: true, date: '2026-08-31' });
});
