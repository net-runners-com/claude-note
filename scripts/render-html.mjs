#!/usr/bin/env node
// render-html.mjs — notes/<date>.md → notes/<date>.html
//   node render-html.mjs [YYYY-MM-DD] [--out DIR]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderNotePage } from './lib/html.mjs';
import { parseArgs, defaultNoteDir } from './build-note.mjs';
import { dayOf } from './lib/transcript.mjs';

const args = parseArgs(process.argv.slice(2));
const positional = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const date = positional || dayOf(new Date().toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone);
const dir = typeof args.out === 'string' ? args.out : defaultNoteDir();
const mdPath = join(dir, `${date}.md`);
if (!existsSync(mdPath)) { console.error(`ノートがありません: ${mdPath}`); process.exit(1); }
const md = readFileSync(mdPath, 'utf8');
const htmlPath = join(dir, `${date}.html`);
writeFileSync(htmlPath, renderNotePage(`作業ノート ${date}`, md));
process.stdout.write(htmlPath + '\n');
