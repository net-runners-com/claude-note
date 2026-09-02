# claude-note

Claude Code でその日に何をしたかを、日本語の作業ノート（Markdown / HTML）にまとめる Claude Code プラグイン。

Claude Code が常時保存している transcript（`~/.claude/projects/**/*.jsonl`）だけを読むので、hooks も API キーも不要。

## 必要なもの

- Claude Code
- Node.js 18 以上（`node --version` で確認）

## インストール

Claude Code の中で 2 コマンド:

```
/plugin marketplace add net-runners-com/claude-note
/plugin install claude-note@claude-note
```

ターミナルからなら:

```bash
claude plugin marketplace add net-runners-com/claude-note
claude plugin install claude-note@claude-note
```

アップデートは `/plugin marketplace update claude-note`。

開発中のローカル版を試す場合は `claude --plugin-dir /path/to/claude-note`。

## 使い方

Claude Code の中で:

```
/note              # 今日のノート
/note 2026-08-30   # 日付指定
```

`/note` が見つからない場合はプラグイン名付きで `/claude-note:note`（headless の `claude -p` ではこちらが必要）。

生成先:

```
~/.claude-note/notes/YYYY-MM-DD.md
~/.claude-note/notes/YYYY-MM-DD.html   # ブラウザで開ける単体ファイル
```

`/note` は次のことをする:

1. `scripts/build-note.mjs` が対象日の transcript を集計して Markdown を作る
2. Claude が集計結果（短縮版 digest）を読んで「本日のまとめ」を 3〜6 行で書き込む
3. 基本は **Artifact として公開**（要約 / ログの 2 タブ、URL で共有可能）。Artifact が使えない環境では `scripts/render-html.mjs` がローカル HTML を作って開く

## ノートの内容

- 本日のまとめ（Claude が執筆）
- セッション一覧（時間帯 / 作業ディレクトリ / 題名 / プロンプト数）
- タイムライン（各プロンプト → 編集ファイル・実行コマンド・生成物・エラー・回答）
- 作成・変更したファイル
- 実行したコマンド（同一コマンドは回数で集約）
- エラー・失敗
- 統計（セッション数 / プロンプト数 / ツール呼出数 / 作業時間の推定）

## 秘密情報のマスク

コマンドや返答に含まれる `XXX_KEY=...`、`Authorization: Bearer ...`、`sk-` / `ghp_` / `AKIA` などの既知トークン、40 桁以上の hex は `•••` に置換する。
取りこぼしはあり得るので、お客様に渡す前に目を通すこと。

## 設定（環境変数）

| 変数 | 既定 | 意味 |
|---|---|---|
| `CLAUDE_NOTE_DIR` | `~/.claude-note` | 出力ルート（`notes/` 配下に生成） |
| `CLAUDE_NOTE_EXCLUDE` | `.claude-mem` | この文字列を cwd に含むセッションを除外（カンマ区切り） |

## 除外されるもの

- プロンプトが 1 つもないセッション（フックだけが動いたもの等）
- サブエージェントのタスク文（ツール呼出数には「うちサブエージェント」として計上）
- `<task-notification>` などシステムが注入した擬似プロンプト

## 手動実行

```bash
node scripts/build-note.mjs --date 2026-08-31 [--projects-dir DIR] [--out DIR]
node scripts/render-html.mjs 2026-08-31 [--out DIR]
```

## 開発

```bash
npm test
```

設計: `docs/superpowers/specs/2026-08-31-claude-note-design.md`
