// pytest. On green keeps the summary line(s) and warnings count; drops the
// per-test progress dots / PASSED lines. On red, generic fallback keeps the
// full failure section.

import { compressGeneric } from "./_generic.mjs";

const SUMMARY_RE = /(\d+ passed|\d+ failed|\d+ error|\d+ skipped|\d+ warning|=+ .* =+|short test summary)/i;
const FAIL_RE = /\b(FAILED|ERROR|[1-9]\d* (?:failed|error)|assert|Traceback|=+ FAILURES =+)\b/;
const PROGRESS_RE = /^[\s.FsxX%\d\[\]]+$|PASSED|::.*PASSED/;

export function compressPytest(text, ctx) {
  if (ctx.success === false || FAIL_RE.test(text)) return compressGeneric(text, ctx.cfg);

  const lines = text.split("\n");
  const kept = [];
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (SUMMARY_RE.test(l)) {
      kept.push(line);
      continue;
    }
    if (PROGRESS_RE.test(l)) continue;
  }
  if (!kept.length) return compressGeneric(text, ctx.cfg);
  return kept.join("\n");
}
