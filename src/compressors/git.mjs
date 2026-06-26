// git: status / log / diff. Light cleanup + budget-bounded; never drops
// structure aggressively since git output is usually already terse. Diffs are
// only salience-trimmed when very large.

import { compressGeneric } from "./_generic.mjs";
import { cleanTerminalNoise } from "../util/ansi.mjs";

export function compressGit(text, ctx) {
  const sub = (ctx.argv && ctx.argv[1]) || "";
  // status / short output: just clean noise, keep everything.
  if (sub === "status" || sub === "branch" || sub === "remote") {
    return cleanTerminalNoise(text);
  }
  // log / diff / show: can be large -> generic salience when over budget.
  return compressGeneric(text, ctx.cfg);
}
