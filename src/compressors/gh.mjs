// GitHub CLI (gh). Strips table chrome / blank padding from list-style output
// and keeps row content; on log/checks output keeps failing lines + summary.

import { compressGeneric } from "./_generic.mjs";

const FAIL_RE = /\b(fail|failed|failing|error|X |✗|cancelled|timed out)\b/i;

export function compressGh(text, ctx) {
  const sub = (ctx.argv && ctx.argv[1]) || "";

  // Log-style output: lean on generic salience (keeps failures + summary).
  if (sub === "run" || /--log\b/.test((ctx.argv || []).join(" "))) {
    return compressGeneric(text, ctx.cfg);
  }

  const lines = text.split("\n");
  const kept = [];
  for (const line of lines) {
    const l = line.replace(/\s+$/, "");
    if (!l.trim()) continue;
    // Drop "Showing N of M" preamble noise but keep failures.
    if (/^Showing \d+ of \d+/.test(l.trim()) && !FAIL_RE.test(l)) continue;
    kept.push(l);
  }
  if (!kept.length) return compressGeneric(text, ctx.cfg);
  return kept.join("\n");
}
