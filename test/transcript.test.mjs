import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscript, dayOf } from '../scripts/lib/transcript.mjs';

const S = 'sess-1';
const base = { sessionId: S, cwd: '/proj', isSidechain: false };
const L = (o) => JSON.stringify(o);
const user = (content, extra = {}) =>
  L({ ...base, type: 'user', timestamp: '2026-08-31T01:00:00.000Z', message: { role: 'user', content }, ...extra });
const asst = (content, extra = {}) =>
  L({ ...base, type: 'assistant', timestamp: '2026-08-31T01:00:05.000Z', message: { role: 'assistant', content }, ...extra });

test('string user content becomes a prompt event', () => {
  const { events } = parseTranscript(user('テストして'));
  assert.deepEqual(events, [
    { kind: 'prompt', ts: '2026-08-31T01:00:00.000Z', sessionId: S, cwd: '/proj', text: 'テストして' },
  ]);
});

test('slash command prompt keeps only the command name', () => {
  const { events } = parseTranscript(user('<command-message>note</command-message>\n<command-name>/note</command-name>\n<command-args>2026-08-30</command-args>'));
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'command');
  assert.equal(events[0].name, '/note');
});

test('isMeta user lines and local-command-stdout are skipped', () => {
  const text = [
    user([{ type: 'text', text: 'injected' }], { isMeta: true }),
    user('<local-command-stdout>foo</local-command-stdout>'),
  ].join('\n');
  assert.deepEqual(parseTranscript(text).events, []);
});

test('assistant text and tool_use blocks become reply and tool_use events', () => {
  const { events } = parseTranscript(asst([
    { type: 'thinking', thinking: 'hmm' },
    { type: 'text', text: '直します。' },
    { type: 'tool_use', id: 'tu1', name: 'Edit', input: { file_path: '/proj/a.ts', old_string: 'x', new_string: 'y' } },
  ]));
  assert.deepEqual(events, [
    { kind: 'reply', ts: '2026-08-31T01:00:05.000Z', sessionId: S, cwd: '/proj', sidechain: false, text: '直します。' },
    { kind: 'tool_use', ts: '2026-08-31T01:00:05.000Z', sessionId: S, cwd: '/proj', sidechain: false, id: 'tu1', name: 'Edit', input: { file_path: '/proj/a.ts', old_string: 'x', new_string: 'y' } },
  ]);
});

test('tool_result blocks carry is_error and flattened text', () => {
  const { events } = parseTranscript(user([
    { type: 'tool_result', tool_use_id: 'tu1', is_error: true, content: [{ type: 'text', text: 'boom' }, { type: 'text', text: 'bang' }] },
  ]));
  assert.deepEqual(events, [
    { kind: 'tool_result', ts: '2026-08-31T01:00:00.000Z', sessionId: S, toolUseId: 'tu1', isError: true, text: 'boom\nbang' },
  ]);
});

test('ai-title line becomes a title event', () => {
  const { events } = parseTranscript(L({ type: 'ai-title', sessionId: S, aiTitle: 'ノート作成' }));
  assert.deepEqual(events, [{ kind: 'title', sessionId: S, title: 'ノート作成' }]);
});

test('sidechain assistant events are flagged', () => {
  const { events } = parseTranscript(asst([{ type: 'text', text: 'sub' }], { isSidechain: true }));
  assert.equal(events[0].sidechain, true);
});

test('sidechain user lines (subagent task prompts) are not prompts', () => {
  assert.deepEqual(parseTranscript(user('サブタスクをやって', { isSidechain: true })).events, []);
});

test('broken JSON and unknown types are skipped and counted', () => {
  const text = ['{not json', L({ type: 'file-history-snapshot' }), user('ok')].join('\n');
  const { events, skipped } = parseTranscript(text);
  assert.equal(events.length, 1);
  assert.equal(skipped, 1);
});

test('dayOf converts UTC timestamp to local date in the given time zone', () => {
  assert.equal(dayOf('2026-08-30T16:30:00.000Z', 'Asia/Tokyo'), '2026-08-31');
  assert.equal(dayOf('2026-08-30T14:30:00.000Z', 'Asia/Tokyo'), '2026-08-30');
});

test('system-injected tag prompts such as task-notification are skipped', () => {
  const { events } = parseTranscript(user('<task-notification>\n<task-id>x</task-id>\n</task-notification>'));
  assert.deepEqual(events, []);
});
