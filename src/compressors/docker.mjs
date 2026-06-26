// docker build. Collapses per-step layer chatter into a step + cache summary;
// keeps any build error verbatim via the generic fallback on failure.

import { compressGeneric } from "./_generic.mjs";

const STEP_RE = /^(?:Step (\d+)\/(\d+)|#\d+)\s/;
const CACHE_RE = /(Using cache|CACHED|cache hit)/i;
const SUCCESS_RE = /Successfully (built|tagged)|exporting to image|writing image|naming to/i;
const ERROR_RE = /\b(error|failed|cannot|no such|not found)\b/i;

export function compressDocker(text, ctx) {
  if (ctx.success === false || ERROR_RE.test(text)) return compressGeneric(text, ctx.cfg);

  const lines = text.split("\n");
  let lastStep = null;
  let totalSteps = null;
  let stepCount = 0;
  let cached = 0;
  const finals = [];

  for (const line of lines) {
    const m = STEP_RE.exec(line.trim());
    if (m) {
      stepCount += 1;
      if (m[1]) lastStep = Number(m[1]);
      if (m[2]) totalSteps = Number(m[2]);
      if (CACHE_RE.test(line)) cached += 1;
      continue;
    }
    if (CACHE_RE.test(line)) cached += 1;
    if (SUCCESS_RE.test(line)) finals.push(line.trim());
  }

  if (!stepCount && !finals.length) return compressGeneric(text, ctx.cfg);

  const stepLabel = totalSteps ?? lastStep ?? stepCount;
  const summary = [`[semtrim] docker build: ${stepLabel} steps, ${cached} cached`];
  for (const f of finals) summary.push(f);
  return summary.join("\n");
}
