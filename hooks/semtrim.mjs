#!/usr/bin/env node
// semtrim entrypoint dispatcher.
//
//   semtrim.mjs filter --cmd <b64>   -> stdin/stdout output-compression filter
//                                        (used by the PreToolUse command wrap)
//   semtrim.mjs                       -> PostToolUse / PreToolUse hook mode
//                                        (reads the hook JSON payload on stdin)
//
// In hook mode: on any problem, exits 0 with no output so the original tool
// result passes through unchanged. Never blocks.

import { loadConfig } from "../src/config.mjs";
import { run, runPre } from "../src/engine.mjs";
import { runFilter } from "../src/cli.mjs";

const argv = process.argv.slice(2);

// No-op in Cursor agent (cannot rewrite output or commands there).
if (process.env.CURSOR_AGENT === "1") process.exit(0);

if (argv[0] === "filter") {
  runFilter(argv);
} else {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    try {
      const payload = JSON.parse(input);
      const cfg = loadConfig();
      const event = payload && payload.hook_event_name;
      const out = event === "PreToolUse" ? runPre(payload, cfg) : run(payload, cfg);
      if (out) process.stdout.write(JSON.stringify(out));
    } catch {
      // fall through to clean exit
    }
    process.exit(0);
  });
}
