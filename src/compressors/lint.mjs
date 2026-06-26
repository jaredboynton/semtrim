// Linters / type-checkers: eslint, ruff, mypy, pyright, flake8, tsc.
// Keeps problem lines (file:line, error/warning) and the summary; drops
// progress and clean-file chatter.

import { compressGeneric } from "./_generic.mjs";

const PROBLEM_RE = /(error|warning|\.\w+:\d+:\d+|:\d+:\d+:|problems?\b|\bproblem\b|Found \d+ error|All checks passed|no issues)/i;
const NOISE_RE = /^(Checking|Linting|Analyzing|Scanning|Processing|\s*\d+%|Success: no issues found in \d+ source)/i;

export function compressLint(text, ctx) {
  // Linters exit non-zero when they find issues; that is normal, not a crash.
  const lines = text.split("\n");
  const kept = [];
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (NOISE_RE.test(l) && !PROBLEM_RE.test(l)) continue;
    if (PROBLEM_RE.test(l)) kept.push(line);
  }
  if (!kept.length) return compressGeneric(text, ctx.cfg);
  return kept.join("\n");
}
