// Secret redaction pass, modeled on Boost's documented redaction classes
// (*_TOKEN, *_SECRET, AWS_*, DATABASE_URL, api keys, bearer tokens). Applied
// before emit so secrets never enter context. Line-wise, preserves structure.

const PATTERNS = [
  // KEY=value / KEY: value where KEY looks secret (separator preserved)
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|APIKEY|API_KEY|PRIVATE_KEY|ACCESS_KEY|CREDENTIAL)[A-Z0-9_]*)(\s*[:=]\s*)([^\s'"]+)/gi,
  // AWS_* env values
  /\b(AWS_[A-Z0-9_]+)(\s*[:=]\s*)([^\s'"]+)/g,
  // DATABASE_URL / connection strings
  /\b([A-Z0-9_]*(?:DATABASE_URL|CONNECTION_STRING|DB_URL)[A-Z0-9_]*)(\s*[:=]\s*)([^\s'"]+)/gi,
  // Bearer tokens
  /\b(Authorization:\s*Bearer)\s+\S+/gi,
  // AWS access key IDs
  /\bAKIA[0-9A-Z]{16}\b/g,
  // GitHub tokens
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  // credentials embedded in a URL: <scheme>://user:<secret>@host
  /([a-z][a-z0-9+.-]*:\/\/[^:@\s/]+:)[^@\s/]+(@)/gi,
];

const REPL = "[REDACTED]";

export function redact(text) {
  let t = String(text ?? "");
  t = t.replace(PATTERNS[0], (_m, k, sep) => `${k}${sep}${REPL}`);
  t = t.replace(PATTERNS[1], (_m, k, sep) => `${k}${sep}${REPL}`);
  t = t.replace(PATTERNS[2], (_m, k, sep) => `${k}${sep}${REPL}`);
  t = t.replace(PATTERNS[3], (_m, k) => `${k} ${REPL}`);
  t = t.replace(PATTERNS[4], REPL);
  t = t.replace(PATTERNS[5], REPL);
  t = t.replace(PATTERNS[6], (_m, pre, at) => `${pre}${REPL}${at}`);
  return t;
}
