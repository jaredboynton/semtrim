// Generic fallback compressor: ANSI/spinner strip, consecutive-line dedup,
// then salience filtering only when over budget. Lossless-ish on small output.

import { cleanTerminalNoise } from "../util/ansi.mjs";
import { dedupeConsecutiveLines } from "../util/budget.mjs";
import { salienceFilter } from "../util/salience.mjs";

export function compressGeneric(text, cfg) {
  let t = cleanTerminalNoise(text);
  t = dedupeConsecutiveLines(t);
  if (t.length > cfg.thresholdBytes) {
    t = salienceFilter(t, cfg.salienceBudgetBytes);
  }
  return t;
}
