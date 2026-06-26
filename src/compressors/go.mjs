// go test / go build. Drops per-package "ok"/"? no test files" and PASS run
// lines on green; preserves FAIL, panic, and build errors via generic fallback.

import { compressGeneric } from "./_generic.mjs";

const OK_RE = /^ok\s+\S+\s+[\d.]+s/;
const NOTEST_RE = /^\?\s+\S+\s+\[no test files\]/;
const RUN_RE = /^(=== RUN|--- PASS|=== CONT|=== PAUSE|PASS$)/;
const FAIL_RE = /\b(FAIL|panic:|--- FAIL|build failed|cannot|undefined:|\.go:\d+:\d+:)\b/;

export function compressGo(text, ctx) {
  if (ctx.success === false || FAIL_RE.test(text)) return compressGeneric(text, ctx.cfg);

  const lines = text.split("\n");
  let okCount = 0;
  let noTest = 0;
  const kept = [];
  for (const line of lines) {
    if (OK_RE.test(line)) {
      okCount += 1;
      continue;
    }
    if (NOTEST_RE.test(line)) {
      noTest += 1;
      continue;
    }
    if (RUN_RE.test(line.trim())) continue;
    if (line.trim()) kept.push(line);
  }
  const summary = [`[semtrim] go: ${okCount} package(s) ok, ${noTest} without tests`];
  return [...summary, ...kept].join("\n");
}
