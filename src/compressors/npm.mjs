// npm / pnpm / yarn / bun install + ci + run.
// Drops deprecation warnings, funding notices, and audit prose; keeps the
// package-count line, vulnerability summary, and any error block.

import { compressGeneric } from "./_generic.mjs";

const NOISE_RE = /^(npm warn deprecated|npm warn EBADENGINE|npm notice|npm warn cleanup|warning |\s*\d+ packages are looking for funding|\s*run `npm fund`|To address (?:all )?issues|Some issues need review|Run `npm audit`|npm warn |info |\s*"|peer )/i;
const KEEP_RE = /(added|removed|changed|audited)\s+\d+|(\d+)\s+(?:vulnerabilit|package)|found 0 vulnerabilities|^\+ |packages? in \d|Saved lockfile|installed|up to date|Resolved/i;
const ERROR_RE = /\b(error|err!|failed|cannot|ELIFECYCLE|ENOENT|ERESOLVE|exit code [1-9])\b/i;

export function compressNpm(text, ctx) {
  if (ctx.success === false) return compressGeneric(text, ctx.cfg);

  const lines = text.split("\n");
  const kept = [];
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (ERROR_RE.test(l)) {
      kept.push(line);
      continue;
    }
    if (NOISE_RE.test(l)) continue;
    if (KEEP_RE.test(l)) kept.push(line);
  }
  if (!kept.length) return compressGeneric(text, ctx.cfg);
  return kept.join("\n");
}
