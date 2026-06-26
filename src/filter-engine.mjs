// Data-driven filter interpreter, faithful to observed JFrog Boost behavior
// (see docs/boost-derived-rules.md). A filter is a plain object:
//   {
//     name, matchCommand: RegExp,
//     select:  [RegExp],   // ACTIVATION GATE (not a keep-list): only transform
//                          // output that looks like what we expect.
//     keep:    [RegExp],   // true keep-allowlist, applied after `replace`
//                          // (only git-status uses this).
//     strip:   [RegExp],   // drop list - does all the reduction.
//     replace: [{ pattern: RegExp, replacement: string }],
//     stripAnsi: bool, onEmpty: string,
//     maxLines: number, truncateLinesAt: number,
//   }
//
// Pipeline (order matters and is derived from Boost's embedded fixtures):
//   strip_ansi
//   -> gate: if `select` exists and output is non-empty but matches no select
//            regex, pass through UNCHANGED (never mangle unrecognized output)
//   -> replace
//   -> keep   (only lines matching `keep`, when present)
//   -> strip  (drop lines matching `strip`)
//   -> truncate_lines_at / max_lines caps
//   -> on_empty (if everything was removed)
//
// Blank lines are removed only when an explicit `^\s*$` rule is in `strip`;
// they are never auto-collapsed. Pure and deterministic.

import { cleanTerminalNoise } from "./util/ansi.mjs";

function anyMatch(res, line) {
  for (const re of res) if (re.test(line)) return true;
  return false;
}

// Returns the transformed string, or null when the filter's activation gate
// fails (output does not look like this command's output at all). On gate
// failure the caller falls back to the generic compressor, which preserves
// unrecognized output. When the gate passes, the (possibly unchanged) cleaned
// text is returned.
export function applyFilter(text, filter) {
  let t = String(text ?? "");
  if (filter.stripAnsi !== false) t = cleanTerminalNoise(t);

  const trimmed = t.trim();

  // Activation gate. Empty/whitespace output still "applies" so on_empty can
  // supply a clean summary (e.g. a lint run with no findings).
  if (filter.select && filter.select.length && trimmed !== "") {
    const recognized = t.split("\n").some((line) => anyMatch(filter.select, line));
    if (!recognized) return null;
  }

  let lines = t.split("\n");

  if (filter.replace && filter.replace.length) {
    lines = lines.map((line) => {
      let out = line;
      for (const { pattern, replacement } of filter.replace) {
        out = out.replace(pattern, replacement);
      }
      return out;
    });
  }

  // True keep-allowlist (rare). Applied after replace so synthesized lines
  // (e.g. git-status letter form) survive.
  if (filter.keep && filter.keep.length) {
    lines = lines.filter((line) => anyMatch(filter.keep, line));
  }

  // Drop list - the main reduction.
  if (filter.strip && filter.strip.length) {
    lines = lines.filter((line) => !anyMatch(filter.strip, line));
  }

  if (filter.truncateLinesAt && filter.truncateLinesAt > 0) {
    lines = lines.map((line) =>
      line.length > filter.truncateLinesAt ? line.slice(0, filter.truncateLinesAt) + "..." : line,
    );
  }

  if (filter.maxLines && lines.length > filter.maxLines) {
    const dropped = lines.length - filter.maxLines;
    lines = lines.slice(0, filter.maxLines);
    lines.push(`[semtrim: ... ${dropped} more lines ...]`);
  }

  // Strip leading/trailing blank lines but preserve internal structure.
  const result = lines.join("\n").replace(/^\n+|\n+$/g, "");
  if (result.trim() === "") return filter.onEmpty ?? "";
  return result;
}
