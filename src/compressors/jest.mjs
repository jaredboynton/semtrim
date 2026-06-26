// jest / vitest. On green keeps the Tests/Test Suites/Time summary block; drops
// per-test PASS/✓ lines. On red, generic fallback keeps the failure section.

import { compressGeneric } from "./_generic.mjs";

const SUMMARY_RE = /^(Test Suites:|Tests:|Snapshots:|Time:|Ran all test|Test Files|Duration|✓ |PASS )/;
const FAIL_RE = /\b(FAIL|✗|✕|[1-9]\d* failed|●|Expected|Received|AssertionError)\b/;
const PASS_LINE_RE = /^\s*(✓|√|PASS|ok)\s/;

export function compressJest(text, ctx) {
  if (ctx.success === false || FAIL_RE.test(text)) return compressGeneric(text, ctx.cfg);

  const lines = text.split("\n");
  const kept = [];
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (PASS_LINE_RE.test(line) && !/^(Test|Tests:|Test Suites:)/.test(l)) continue;
    if (SUMMARY_RE.test(l) || /passed|total|failed|skipped/i.test(l)) kept.push(line);
  }
  if (!kept.length) return compressGeneric(text, ctx.cfg);
  return kept.join("\n");
}
