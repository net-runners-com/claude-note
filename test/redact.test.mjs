import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact } from '../scripts/lib/redact.mjs';

test('KEY=value style assignments are masked', () => {
  assert.equal(redact('export RESEND_KEY=re_FAKEFAKE_0000000000000000000000FAKE; curl x'), 'export RESEND_KEY=•••; curl x');
  assert.equal(redact('DB_PASSWORD="hunter2" node app'), 'DB_PASSWORD=•••; node app'.replace('; node', ' node'));
  assert.equal(redact('API_TOKEN: abc123def456'), 'API_TOKEN: •••');
});

test('Authorization headers and well-known token prefixes are masked', () => {
  assert.equal(redact('-H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def"'), '-H "Authorization: Bearer •••"');
  assert.equal(redact('key sk-proj-abcdefghijklmnopqrstuvwxyz0123456789'), 'key •••');
  assert.equal(redact('token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456'), 'token •••');
  assert.equal(redact('AKIAIOSFODNN7EXAMPLE'), '•••');
});

test('long opaque hex or base64 strings are masked, ordinary text is not', () => {
  assert.equal(redact('id 3cd9af8a59b2c4f93cd9af8a59b2c4f93cd9af8a'), 'id •••');
  assert.equal(redact('npm test -- --reporter=dot'), 'npm test -- --reporter=dot');
  assert.equal(redact('/Users/me/projects/claude-note/scripts/build-note.mjs'), '/Users/me/projects/claude-note/scripts/build-note.mjs');
  assert.equal(redact('請求書_2026-08_ご縁FES.pdf を読んで'), '請求書_2026-08_ご縁FES.pdf を読んで');
});
