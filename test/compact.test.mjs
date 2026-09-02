import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactDigest } from '../scripts/lib/compact.mjs';

const entry = (i) => ({ time: '10:00', sessionId: 's', prompt: 'p'.repeat(150) + i, edits: ['/a', '/b'], created: [{ path: '/c', lines: 2 }], commands: [{ command: 'x', description: 'y' }], reply: 'r'.repeat(250), errors: 1 });
const digest = {
  date: '2026-08-31',
  sessions: [{ sessionId: 's', cwd: '/p', title: 't', start: '10:00', end: '11:00', prompts: 3 }],
  timeline: [entry(1), entry(2), entry(3)],
  files: [{ path: '/a', writes: 0, edits: 1, lines: null }],
  commands: [{ time: '10:00', command: 'x', description: 'y', count: 3 }],
  errors: [{ time: '10:00', tool: 'Bash', text: 'e'.repeat(180) }],
  stats: { sessions: 1, prompts: 3, toolUses: 9, subagentToolUses: 0, workMinutes: 60, skipped: 0 },
};

test('compact digest shortens texts and replaces lists with counts', () => {
  const c = compactDigest(digest, 100000);
  assert.equal(c.compact, true);
  assert.equal(c.timeline[0].prompt.length, 121);
  assert.equal(c.timeline[0].reply.length, 161);
  assert.deepEqual({ edits: c.timeline[0].edits, created: c.timeline[0].created, commands: c.timeline[0].commands }, { edits: 2, created: 1, commands: 1 });
  assert.deepEqual(c.files, ['/a']);
  assert.equal(c.commandCount, 3);
  assert.equal(c.errors[0].text.length, 101);
  assert.equal(c.errorCount, 1);
  assert.equal(c.fileCount, 1);
  assert.deepEqual(c.stats, digest.stats);
});

test('beyond level 1, errors are capped at 15 entries while errorCount keeps the total', () => {
  const many = { ...digest, errors: Array.from({ length: 20 }, (_, i) => ({ time: '10:00', tool: 'Bash', text: `e${i}` })) };
  const c = compactDigest(many, 1500);
  assert.equal(c.errors.length, 15);
  assert.equal(c.errorCount, 20);
});

test('over budget: replies are dropped, then prompts shortened, then timeline truncated with a note', () => {
  const noReply = compactDigest(digest, 1500);
  assert.ok(noReply.timeline.every((t) => !('reply' in t)));
  assert.equal(noReply.timeline.length, 3);
  assert.equal(noReply.timeline[0].prompt.length, 121);
  const short = compactDigest(digest, 900);
  assert.equal(short.timeline.length, 3);
  assert.deepEqual(Object.keys(short.timeline[0]), ['time', 'prompt', 'errors']);
  assert.equal(short.timeline[0].prompt.length, 61);
  assert.equal(short.errors[0].text.length, 61);
  const cut = compactDigest(digest, 500);
  assert.ok(cut.timeline.length < 3);
  assert.match(cut.truncated, /3 件中/);
});
