import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, SUMMARY_START, SUMMARY_END } from '../scripts/lib/markdown.mjs';

const digest = {
  date: '2026-08-31',
  sessions: [{ sessionId: 's1', cwd: '/proj', title: 'ログイン修正', start: '10:00', end: '11:00', prompts: 2 }],
  timeline: [
    { time: '10:00', sessionId: 's1', prompt: 'ログインを直して', edits: ['/proj/src/login.ts'], created: [{ path: '/proj/src/new.ts', lines: 3 }], commands: [{ command: 'npm test', description: 'テスト実行' }], reply: '直しました。', errors: 1 },
    { time: '11:00', sessionId: 's1', prompt: '次はテスト', edits: [], created: [], commands: [], reply: '', errors: 0 },
  ],
  files: [
    { path: '/proj/src/login.ts', writes: 0, edits: 1, lines: null },
    { path: '/proj/src/new.ts', writes: 1, edits: 0, lines: 3 },
  ],
  commands: [{ time: '10:00', command: 'npm test', description: 'テスト実行', count: 3 }],
  errors: [{ time: '10:00', tool: 'Bash', text: 'FAIL 1 test' }],
  stats: { sessions: 1, prompts: 2, toolUses: 4, subagentToolUses: 1, workMinutes: 75, skipped: 2 },
};

const expected = `# 作業ノート 2026-08-31

## 本日のまとめ

${SUMMARY_START}
（未記入）
${SUMMARY_END}

## セッション一覧

| 時間帯 | 作業ディレクトリ | 題名 | プロンプト数 |
|---|---|---|---|
| 10:00–11:00 | /proj | ログイン修正 | 2 |

## タイムライン

### 10:00 ログインを直して

- 編集: \`/proj/src/login.ts\`
- 生成物: \`/proj/src/new.ts\`（3 行）
- 実行: \`npm test\` — テスト実行
- エラー: 1 件
- 回答: 直しました。

### 11:00 次はテスト

- （操作なし）

## 作成・変更したファイル

- \`/proj/src/login.ts\`（Edit 1 回）
- \`/proj/src/new.ts\`（Write 3 行）

## 実行したコマンド

- 10:00 \`npm test\` — テスト実行（×3）

## エラー・失敗

- 10:00 Bash: FAIL 1 test

## 統計

セッション 1 / プロンプト 2 / ツール呼出 4（うちサブエージェント 1）/ 作業時間 約 1 時間 15 分（推定）

※ 解析できなかった行: 2
`;

test('renderMarkdown produces the note layout', () => {
  assert.equal(renderMarkdown(digest), expected);
});

test('empty sections render placeholders and skip the skipped note', () => {
  const md = renderMarkdown({ ...digest, timeline: [], files: [], commands: [], errors: [], stats: { ...digest.stats, skipped: 0, workMinutes: 5 } });
  assert.match(md, /## 作成・変更したファイル\n\n- なし\n/);
  assert.match(md, /## エラー・失敗\n\n- なし\n/);
  assert.match(md, /作業時間 約 5 分（推定）/);
  assert.doesNotMatch(md, /解析できなかった行/);
});

test('pipe characters in table cells are escaped', () => {
  const md = renderMarkdown({ ...digest, sessions: [{ ...digest.sessions[0], title: 'a|b' }] });
  assert.match(md, /\| a\\\|b \|/);
});
