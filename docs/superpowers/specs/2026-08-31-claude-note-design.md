# claude-note 設計

日付: 2026-08-31
状態: 承認済み設計（実装前）

## 目的

AI コンサルのレッスンで Claude Code を使って「その日何をしたか」を、
お客様に渡せる日本語ノートとして自動生成する。
お客様の端末に Claude Code プラグインとして配布する。

## 方針

- **常時記録**: Claude Code 自身が書く transcript
  (`~/.claude/projects/<proj>/<session>.jsonl`) を唯一のデータ源とする。
  hooks は使わない（ツール呼出ごとのコスト・記録漏れ・返答文が取れない問題を避ける）。
- **`/note [YYYY-MM-DD]`** で対象日のノートを生成。省略時は今日（ローカル時刻）。
- **LLM を使うのは「本日のまとめ」1 箇所だけ**。実行中の Claude が書く。API キー不要。
- 依存は Node 18+ のみ。npm パッケージなし。

transcript 形式が変わった場合のフォールバックとして hooks 方式（JSONL 追記）を将来候補に残す。

## 構成

```
.claude-plugin/plugin.json
commands/note.md            /note [date]
scripts/build-note.mjs      transcript → digest(JSON, stdout) + ~/.claude-note/notes/<date>.md
scripts/render-html.mjs     .md → 単体 .html
scripts/lib/transcript.mjs  transcript 読み取り・正規化（純関数、テスト対象）
scripts/lib/digest.mjs      正規化イベント → digest 構造体（純関数、テスト対象）
scripts/lib/markdown.mjs    digest → Markdown（純関数、テスト対象）
test/fixtures/*.jsonl       固定 transcript サンプル
test/*.test.mjs             node:test
```

出力先: `~/.claude-note/notes/YYYY-MM-DD.md`, `.html`（環境変数 `CLAUDE_NOTE_DIR` で変更可）。

## transcript 形式（2026-08-31 時点、Claude Code 2.1.251 で確認）

1 行 1 JSON。使うフィールド:

| type | 判定 | 使う値 |
|---|---|---|
| `user`, `message.content` が string | ユーザーのプロンプト | `message.content`, `timestamp`, `cwd`, `sessionId` |
| `user`, content[] に `tool_result` | ツール結果 | `tool_use_id`, `content`, `is_error`, `toolUseResult` |
| `assistant`, content[] に `text` | Claude の返答 | `text` |
| `assistant`, content[] に `tool_use` | ツール呼出 | `id`, `name`, `input` |
| `ai-title` | セッション題名 | `aiTitle` |
| その他 (`system`, `attachment`, `file-history-snapshot`, `thinking` 等) | 無視 | — |

除外ルール:
- `isSidechain: true`（サブエージェント）は統計にのみ計上し、タイムラインには出さない
- `isMeta: true` の user 行は除外
- プロンプトが `<command-name>` / `<local-command-stdout>` 等のタグで始まる行はスラッシュコマンド実行として扱い、コマンド名だけ残す
- `timestamp` は UTC。対象日の判定はローカルタイムゾーンで行う

対象ファイルの絞り込み: `~/.claude/projects/**/*.jsonl` のうち mtime が対象日 00:00 ローカル以降のもの。
各行の `timestamp` で対象日のみ採用（日をまたいだセッションは両日に分割される）。

## ノート構成（Markdown、日本語）

```
# 作業ノート 2026-08-31

## 本日のまとめ
<!-- summary:start -->
（Claude が /note 実行時に 3〜6 行で執筆）
<!-- summary:end -->

## セッション一覧
| 時間帯 | 作業ディレクトリ | 題名 | プロンプト数 |

## タイムライン
### 10:05 <プロンプト先頭 200 字>
- 編集: path/to/file.ts
- 実行: `npm test` — テスト実行
- 生成物: path/to/new.md（42 行）
- 回答: <Claude の最終返答 先頭 300 字>

## 作成・変更したファイル
- path (Write 42 行 / Edit 3 回)

## 実行したコマンド
- `command 先頭 120 字` — description

## エラー・失敗
- HH:MM ToolName: エラー先頭 200 字

## 統計
セッション N / プロンプト N / ツール呼出 N（うちサブエージェント N）/ 作業時間 約 H 時間 M 分
```

作業時間 = 各セッション内で隣接イベント間隔が 30 分以内の区間の合計（推定と明記）。

## digest（stdout、Claude が読む）

JSON。トークン上限の目安 3k。プロンプトは先頭 200 字、返答は先頭 300 字、
コマンドは先頭 120 字に切る。構造は Markdown のセクションと同じ。

## フロー（`/note`）

1. `node ${CLAUDE_PLUGIN_ROOT}/scripts/build-note.mjs --date D` を実行
   - digest を stdout に出力し、`notes/D.md` を summary 空で保存
   - 対象日の記録がなければ `{"empty":true}` を出力して終了。Claude は「記録なし」と報告して終える
2. Claude が digest を読み「本日のまとめ」を書き、`<!-- summary:start/end -->` の間に Edit で挿入
3. `node .../render-html.mjs D` で `.html` 生成
4. md/html のパスを表示し、macOS なら `open` で html を開く

## エラー処理

- JSON パースできない行はスキップし、件数を digest の `skipped` と md 末尾に注記
- transcript ディレクトリがなければ明示エラーで終了（exit 2）
- 未知の `type` は無視（形式変更に対する耐性）

## テスト

`node --test test/`。fixtures に以下を含む transcript サンプルを置く:
- 通常プロンプト → tool_use(Write/Edit/Bash) → tool_result → text 返答
- is_error の tool_result
- isMeta / isSidechain / スラッシュコマンド行
- 日をまたぐ timestamp
- 壊れた JSON 行

検証項目: 日付フィルタ、除外ルール、ファイル集計、コマンド集計、エラー抽出、作業時間、Markdown 出力の固定比較（スナップショット）。

## 配布

プラグインとして `claude plugin install`（marketplace または `--plugin-dir`）。
README に Node 18+ 要件と `/note` の使い方を記す。

## スコープ外（v1 でやらない）

- hooks による記録
- 複数日のまとめ（週報）
- Artifact（claude.ai）への自動公開
- ノートの note.com 投稿
