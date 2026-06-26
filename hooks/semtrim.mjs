#!/usr/bin/env node
// semtrim PostToolUse hook entrypoint.
// Reads the hook JSON payload on stdin, compresses tool output, and writes an
// updatedToolOutput object on stdout. On any problem, exits 0 with no output so
// the original tool result passes through unchanged. Never blocks.

import { loadConfig } from "../src/config.mjs";
import { run } from "../src/engine.mjs";

// No-op in Cursor agent (cannot rewrite output there).
if (process.env.CURSOR_AGENT === "1") process.exit(0);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(input);
    const cfg = loadConfig();
    const out = run(payload, cfg);
    if (out) process.stdout.write(JSON.stringify(out));
  } catch {
    // fall through to clean exit
  }
  process.exit(0);
});
