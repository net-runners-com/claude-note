---
description: その日の Claude Code 作業ノート（Markdown/HTML）を生成する
argument-hint: "[YYYY-MM-DD]"
allowed-tools: Bash(node:*), Bash(open:*), Read, Edit
---

その日に Claude Code で何をしたかの作業ノートを作る。引数: `$ARGUMENTS`（空なら今日）。

手順どおりに進め、余計な調査はしない。

1. 次を実行する（引数があれば `--date` に渡す）:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-note.mjs" --date <日付>`
   - 出力が `{"empty":true,...}` なら「その日の記録はありません」と伝えて終了。
   - exit 2 なら表示されたエラーをそのまま伝えて終了。
   - それ以外は JSON の digest。`notePath` が生成した Markdown のパス。
2. digest を読み、「本日のまとめ」を日本語で書く。
   - 3〜6 行。お客様（非エンジニアの場合もある）が読んで「今日は何が進んだか」が分かる文にする。
   - 何を頼まれ（prompt）、何を作り／直し（files, commands）、結果どうなったか（errors, reply）の順。
   - 数字は digest にあるものだけ使う。推測で補わない。
3. `notePath` の Markdown 内の `<!-- summary:start -->` と `<!-- summary:end -->` の間にある `（未記入）` を、書いたまとめに Edit で置き換える。
4. **Artifact ツールが使える場合（基本こちら）**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/render-artifact.mjs" <日付>` を実行し、stdout のファイルを Artifact として公開する（title: `作業ノート <日付>`、favicon: 📝。同じ日付の再生成は同じファイルパスなので同一 URL に再公開される）。最後に Artifact URL と Markdown のパスを表示する。
5. **Artifact ツールがない場合**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/render-html.mjs" <日付>` を実行し、macOS なら `open <HTMLパス>` で開く。Markdown と HTML のパスを表示する。
