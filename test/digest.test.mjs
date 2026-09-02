import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest } from '../scripts/lib/digest.mjs';

const TZ = 'Asia/Tokyo';
const S = 'sess-1';
const ev = (kind, ts, extra) => ({ kind, ts, sessionId: S, cwd: '/proj', ...extra });
const tu = (ts, id, name, input, sidechain = false) => ev('tool_use', ts, { id, name, input, sidechain });

const sample = [
  { kind: 'title', sessionId: S, title: 'ログイン修正' },
  ev('prompt', '2026-08-31T01:00:00Z', { text: 'ログインを直して' }),
  ev('reply', '2026-08-31T01:00:05Z', { sidechain: false, text: '見ます。' }),
  tu('2026-08-31T01:00:10Z', 't1', 'Edit', { file_path: '/proj/src/login.ts', old_string: 'a', new_string: 'b' }),
  ev('tool_result', '2026-08-31T01:00:11Z', { toolUseId: 't1', isError: false, text: 'ok' }),
  tu('2026-08-31T01:00:20Z', 't2', 'Bash', { command: 'npm test -- --reporter=dot', description: 'テスト実行' }),
  ev('tool_result', '2026-08-31T01:00:25Z', { toolUseId: 't2', isError: true, text: 'FAIL 1 test' }),
  tu('2026-08-31T01:00:30Z', 't3', 'Write', { file_path: '/proj/src/new.ts', content: 'a\nb\nc' }),
  ev('tool_result', '2026-08-31T01:00:31Z', { toolUseId: 't3', isError: false, text: 'ok' }),
  tu('2026-08-31T01:00:40Z', 't4', 'Read', { file_path: '/proj/x' }, true),
  ev('reply', '2026-08-31T01:00:50Z', { sidechain: false, text: '直しました。' }),
  ev('prompt', '2026-08-31T02:00:00Z', { text: '次はテスト' }),
  ev('reply', '2026-08-31T02:00:10Z', { sidechain: false, text: '追加します。' }),
  ev('prompt', '2026-08-30T01:00:00Z', { text: '前日の作業' }),
];

const d = buildDigest(sample, { date: '2026-08-31', timeZone: TZ, skipped: 2 });

test('events outside the target day are excluded', () => {
  assert.equal(d.stats.prompts, 2);
});

test('sessions carry title, cwd, time range and prompt count', () => {
  assert.deepEqual(d.sessions, [
    { sessionId: S, cwd: '/proj', title: 'ログイン修正', start: '10:00', end: '11:00', prompts: 2 },
  ]);
});

test('timeline groups tool use and final reply under each prompt', () => {
  assert.equal(d.timeline.length, 2);
  const t = d.timeline[0];
  assert.equal(t.time, '10:00');
  assert.equal(t.prompt, 'ログインを直して');
  assert.deepEqual(t.edits, ['/proj/src/login.ts']);
  assert.deepEqual(t.created, [{ path: '/proj/src/new.ts', lines: 3 }]);
  assert.deepEqual(t.commands, [{ command: 'npm test -- --reporter=dot', description: 'テスト実行' }]);
  assert.equal(t.reply, '直しました。');
  assert.equal(t.errors, 1);
});

test('files aggregate writes, edits and line counts', () => {
  assert.deepEqual(d.files, [
    { path: '/proj/src/login.ts', writes: 0, edits: 1, lines: null },
    { path: '/proj/src/new.ts', writes: 1, edits: 0, lines: 3 },
  ]);
});

test('commands and errors are listed with local time', () => {
  assert.deepEqual(d.commands, [{ time: '10:00', command: 'npm test -- --reporter=dot', description: 'テスト実行', count: 1 }]);
  assert.deepEqual(d.errors, [{ time: '10:00', tool: 'Bash', text: 'FAIL 1 test' }]);
});

test('stats count tool uses, subagent tool uses and estimated work minutes', () => {
  // 10:00:00-10:00:50 は連続 (≈1分), 11:00:00-11:00:10 は 60 分空くので別区間
  assert.deepEqual(d.stats, { sessions: 1, prompts: 2, toolUses: 4, subagentToolUses: 1, workMinutes: 1, skipped: 2 });
});

test('long texts are truncated', () => {
  const long = 'x'.repeat(500);
  const dd = buildDigest([ev('prompt', '2026-08-31T01:00:00Z', { text: long })], { date: '2026-08-31', timeZone: TZ });
  assert.equal(dd.timeline[0].prompt.length, 201); // 200 + '…'
});

test('sessions without prompts are dropped together with their tool uses', () => {
  const noise = [
    { kind: 'tool_use', ts: '2026-08-31T03:00:00Z', sessionId: 'obs', cwd: '/x', sidechain: false, id: 'n1', name: 'Bash', input: { command: 'ls' } },
    { kind: 'reply', ts: '2026-08-31T03:00:01Z', sessionId: 'obs', cwd: '/x', sidechain: false, text: 'hi' },
  ];
  const dd = buildDigest([...sample, ...noise], { date: '2026-08-31', timeZone: TZ });
  assert.equal(dd.stats.sessions, 1);
  assert.equal(dd.stats.toolUses, 4);
  assert.equal(dd.commands.length, 1);
});

test('sessions whose cwd matches an exclude pattern are dropped', () => {
  const memo = [ev('prompt', '2026-08-31T03:00:00Z', { sessionId: 'm', cwd: '/home/u/.claude-mem/observer-sessions', text: 'observe' })];
  const dd = buildDigest([...sample, ...memo], { date: '2026-08-31', timeZone: TZ, exclude: ['.claude-mem'] });
  assert.equal(dd.stats.sessions, 1);
  assert.equal(dd.stats.prompts, 2);
});

test('identical commands are merged with a count', () => {
  const twice = [...sample,
    tu('2026-08-31T01:00:21Z', 't9', 'Bash', { command: 'npm test -- --reporter=dot', description: 'テスト実行' })];
  const dd = buildDigest(twice, { date: '2026-08-31', timeZone: TZ });
  assert.deepEqual(dd.commands, [{ time: '10:00', command: 'npm test -- --reporter=dot', description: 'テスト実行', count: 2 }]);
});

test('work minutes are the union across parallel sessions, not the sum', () => {
  const parallel = [...sample,
    ev('prompt', '2026-08-31T01:00:00Z', { sessionId: 'p2', text: 'a' }),
    ev('reply', '2026-08-31T01:00:50Z', { sessionId: 'p2', sidechain: false, text: 'b' })];
  assert.equal(buildDigest(parallel, { date: '2026-08-31', timeZone: TZ }).stats.workMinutes, 1);
});

test('multi-line commands are flattened to one line', () => {
  const heredoc = [ev('prompt', '2026-08-31T01:00:00Z', { text: 'x' }),
    tu('2026-08-31T01:00:01Z', 'h1', 'Bash', { command: "cat > a.md <<'EOF'\n# title\n\nbody\nEOF", description: 'write' })];
  const dd = buildDigest(heredoc, { date: '2026-08-31', timeZone: TZ });
  assert.equal(dd.commands[0].command, "cat > a.md <<'EOF' # title body EOF");
});

test('secrets in prompts, commands, replies and errors are redacted', () => {
  const leaky = [ev('prompt', '2026-08-31T01:00:00Z', { text: 'use API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz012345' }),
    tu('2026-08-31T01:00:01Z', 'l1', 'Bash', { command: 'export TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456; ls', description: 'ls' }),
    ev('tool_result', '2026-08-31T01:00:02Z', { toolUseId: 'l1', isError: true, text: 'bad token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456' }),
    ev('reply', '2026-08-31T01:00:03Z', { sidechain: false, text: 'set SECRET=abc123 done' })];
  const dd = buildDigest(leaky, { date: '2026-08-31', timeZone: TZ });
  assert.equal(dd.timeline[0].prompt, 'use API_KEY=•••');
  assert.equal(dd.commands[0].command, 'export TOKEN=•••; ls');
  assert.equal(dd.errors[0].text, 'bad token •••');
  assert.equal(dd.timeline[0].reply, 'set SECRET=••• done');
});

test('home directory is shortened to ~ in cwd and file paths', () => {
  const home = [ev('prompt', '2026-08-31T01:00:00Z', { cwd: '/Users/me/proj', text: 'x' }),
    tu('2026-08-31T01:00:01Z', 'w1', 'Write', { file_path: '/Users/me/proj/a.md', content: 'a' })];
  const dd = buildDigest(home, { date: '2026-08-31', timeZone: TZ, home: '/Users/me' });
  assert.equal(dd.sessions[0].cwd, '~/proj');
  assert.equal(dd.files[0].path, '~/proj/a.md');
  assert.deepEqual(dd.timeline[0].created, [{ path: '~/proj/a.md', lines: 1 }]);
});
