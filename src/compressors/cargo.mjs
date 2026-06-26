// cargo build / test. On green, keeps the Compiling/Finished summary and test
// result line, drops the rest. On failure, generic fallback preserves errors.

import { compressGeneric } from "./_generic.mjs";

const KEEP_RE = /^(?:\s*(?:Finished|Compiling|Running|test result:|\s+Doc-tests))/;
const FAIL_RE = /\b(error\[?E?\d*\]?:|warning:|test result: FAILED|panicked|could not compile|[1-9]\d* failed)\b/;

export function compressCargo(text, ctx) {
  if (ctx.success === false || FAIL_RE.test(text)) return compressGeneric(text, ctx.cfg);

  const lines = text.split("\n");
  const kept = [];
  let compiling = 0;
  for (const line of lines) {
    if (/^\s*Compiling\s/.test(line)) {
      compiling += 1;
      continue;
    }
    if (KEEP_RE.test(line)) kept.push(line.trim());
  }
  if (!kept.length) return compressGeneric(text, ctx.cfg);
  return [`[semtrim] cargo: compiled ${compiling} crate(s)`, ...kept].join("\n");
}
