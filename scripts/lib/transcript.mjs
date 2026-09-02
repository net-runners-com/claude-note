// transcript.mjs — Claude Code transcript (JSONL) を正規化イベントに変換する純関数群
// 確認済みフォーマット: Claude Code 2.1.251 (2026-08-31)

const SYSTEM_TAG = /^\s*<[a-z][a-z0-9-]*[\s>]/i;

function blockText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

function commandName(text) {
  const m = /<command-name>([^<]+)<\/command-name>/.exec(text);
  return m ? m[1].trim() : null;
}

function userEvents(o) {
  // isMeta: システム注入。isSidechain: サブエージェントへのタスク文なので「プロンプト」ではない
  if (o.isMeta || o.isSidechain) return [];
  const { message, timestamp: ts, sessionId, cwd } = o;
  const content = message?.content;
  if (typeof content === 'string') {
    if (content.startsWith('<command-')) {
      const name = commandName(content);
      return name ? [{ kind: 'command', ts, sessionId, cwd, name }] : [];
    }
    // <task-notification> / <local-command-stdout> など、タグで始まる行はシステム注入なので除外
    if (SYSTEM_TAG.test(content)) return [];
    return [{ kind: 'prompt', ts, sessionId, cwd, text: content }];
  }
  if (!Array.isArray(content)) return [];
  const out = [];
  for (const b of content) {
    if (!b) continue;
    if (b.type === 'tool_result') {
      out.push({ kind: 'tool_result', ts, sessionId, toolUseId: b.tool_use_id, isError: !!b.is_error, text: blockText(b.content) });
    }
  }
  const text = blockText(content);
  if (text && !content.some((b) => b?.type === 'tool_result')) {
    out.push({ kind: 'prompt', ts, sessionId, cwd, text });
  }
  return out;
}

function assistantEvents(o) {
  const { message, timestamp: ts, sessionId, cwd } = o;
  const sidechain = !!o.isSidechain;
  const content = Array.isArray(message?.content) ? message.content : [];
  const out = [];
  const text = blockText(content);
  if (text) out.push({ kind: 'reply', ts, sessionId, cwd, sidechain, text });
  for (const b of content) {
    if (b?.type === 'tool_use') {
      out.push({ kind: 'tool_use', ts, sessionId, cwd, sidechain, id: b.id, name: b.name, input: b.input ?? {} });
    }
  }
  return out;
}

/** JSONL 文字列 → { events, skipped } */
export function parseTranscript(text) {
  const events = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    if (!o || typeof o !== 'object') { skipped++; continue; }
    switch (o.type) {
      case 'user': events.push(...userEvents(o)); break;
      case 'assistant': events.push(...assistantEvents(o)); break;
      case 'ai-title':
        if (o.aiTitle) events.push({ kind: 'title', sessionId: o.sessionId, title: o.aiTitle });
        break;
      default: break; // 未知/不要な type は無視（形式変更耐性）
    }
  }
  return { events, skipped };
}

/** UTC ISO timestamp → 指定タイムゾーンの YYYY-MM-DD */
export function dayOf(ts, timeZone) {
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** UTC ISO timestamp → 指定タイムゾーンの HH:MM */
export function timeOf(ts, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts));
}
