// redact.mjs — ノートに載せる前に秘密情報らしき文字列をマスクする（純関数）
// 対象: KEY=value 形式の代入、Authorization ヘッダ、既知のトークン接頭辞、長い hex/base64 文字列
// 取りこぼしはあり得るので、ノートを外部に渡す前の目視確認は別途必要

export const MASK = '•••';

const VALUE = String.raw`(?:"[^"]*"|'[^']*'|[^\s;&|"']+)`;

const RULES = [
  // Authorization: Bearer xxx / Basic xxx / Token xxx
  [/((?:Authorization|Proxy-Authorization)\s*:\s*(?:Bearer|Basic|Token)\s+)[^\s"']+/gi, `$1${MASK}`],
  // 大文字の環境変数名に KEY/TOKEN/SECRET/PASS/AUTH/CREDENTIAL を含む代入
  [new RegExp(String.raw`\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASS|PASSWD|PASSWORD|AUTH|CREDENTIAL)S?[A-Z0-9_]*)(\s*[=:]\s*)${VALUE}`, 'g'), `$1$2${MASK}`],
  // 小文字の典型的な名前 (password: x, api_key=x, client_secret=x ...)
  [new RegExp(String.raw`\b(password|passwd|secret|token|api[_-]?key|apikey|access[_-]?token|client[_-]?secret|private[_-]?key)(\s*[=:]\s*)${VALUE}`, 'gi'), `$1$2${MASK}`],
  // 既知のトークン接頭辞 (OpenAI/Anthropic sk-, GitHub ghp_/gho_/github_pat_, Slack xox*, AWS AKIA, Resend re_, Google AIza, JWT)
  [/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|re_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/g, MASK],
  // 40 桁以上の hex、48 桁以上の英数字（大小英字と数字を全て含む）
  [/\b[0-9a-f]{40,}\b/gi, MASK],
  [/\b(?=[A-Za-z0-9+/=]{48,}\b)(?=[^\s]*[a-z])(?=[^\s]*[A-Z])(?=[^\s]*[0-9])[A-Za-z0-9+/=]{48,}\b/g, MASK],
];

export function redact(text) {
  let s = String(text ?? '');
  for (const [re, rep] of RULES) s = s.replace(re, rep);
  return s;
}
