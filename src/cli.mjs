// semtrim CLI: `filter` subcommand for the PreToolUse command-wrap path.
//
// Usage (as produced by src/wrap.mjs):
//   <command> 2>&1 | node semtrim.mjs filter --cmd <base64(command)>
//
// Reads the piped tool output on stdin, runs the same routeBash + redact
// pipeline used by the hook, and writes the (smaller) result to stdout. The
// original command is needed to pick the right filter; it is passed base64 so
// quoting never breaks. Always exits 0 and, on any error or non-shrinking
// result, emits the original stdin verbatim so a pipeline is never harmed.

import { loadConfig } from "./config.mjs";
import { routeBash } from "./router.mjs";
import { redact } from "./util/redact.mjs";

const MARKER = "[semtrim";

function decodeCmd(args) {
  const i = args.indexOf("--cmd");
  if (i < 0 || !args[i + 1]) return "";
  try {
    return Buffer.from(args[i + 1], "base64").toString("utf8");
  } catch {
    return "";
  }
}

function compressFilter(command, text, cfg) {
  if (text.includes(MARKER)) return text;
  let out = routeBash(command || "", text, { cfg });
  if (cfg.redact !== false) out = redact(out);
  // Never-grow: only use the compressed form if it actually saved bytes.
  if (typeof out !== "string" || out.length >= text.length) return text;
  return out;
}

// Reads stdin fully, then writes the filtered result. Resolves on completion.
export function runFilter(argv) {
  const command = decodeCmd(argv);
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    let output = input;
    try {
      const cfg = loadConfig();
      if (cfg.wrap?.enabled !== false) output = compressFilter(command, input, cfg);
    } catch {
      output = input; // pass through unchanged on any failure
    }
    process.stdout.write(output);
    process.exit(0);
  });
  // If stdin never opens (no pipe), exit cleanly without hanging forever.
  process.stdin.on("error", () => process.exit(0));
}
