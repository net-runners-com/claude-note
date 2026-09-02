#!/usr/bin/env node
// render-artifact.mjs — notes/<date>.md → notes/<date>.artifact.html（Artifact 公開用: doctype なし）
//   node render-artifact.mjs [YYYY-MM-DD] [--out DIR]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderArtifact } from './lib/html.mjs';
import { parseArgs, defaultNoteDir } from './build-note.mjs';
import { dayOf } from './lib/transcript.mjs';

const args = parseArgs(process.argv.slice(2));
const positional = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const date = positional || dayOf(new Date().toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone);
const dir = typeof args.out === 'string' ? args.out : defaultNoteDir();
const mdPath = join(dir, `${date}.md`);
if (!existsSync(mdPath)) { console.error(`ノートがありません: ${mdPath}`); process.exit(1); }
const outPath = join(dir, `${date}.artifact.html`);
writeFileSync(outPath, renderArtifact(`作業ノート ${date}`, readFileSync(mdPath, 'utf8')));
process.stdout.write(outPath + '\n');
