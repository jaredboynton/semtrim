// PreToolUse command-wrap path.
//
// Rewrites a Bash command so its output is piped through `semtrim filter`,
// which compresses it before the agent sees it. This is the reliable path:
// Claude/Codex honor PreToolUse `updatedInput`, whereas PostToolUse output
// replacement is unreliable for Bash on current Claude Code.
//
// Wrapped form (bash):
//   set -o pipefail; <command> 2>&1 | node "<abs>/semtrim.mjs" filter --cmd <b64>
//
// `pipefail` preserves the original command's exit code; base64 avoids any
// quoting hazard from the original command. We wrap CONSERVATIVELY: only a
// single simple command that semtrim has a dedicated filter for, never a
// compound/piped/redirected/backgrounded command, and never one already wrapped.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { detectProgram } from "./router.mjs";
import { lookupFilterKey } from "./registry.mjs";
import { FILTERS } from "./filters.mjs";

const HOOK_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "semtrim.mjs");

// Shell metacharacters whose presence means the command is compound, piped,
// redirected, backgrounded, or otherwise not a single simple command we can
// safely append a pipe to. Conservative: when any appear, we do not wrap.
const UNSAFE = /[|&;<>\n\r`]|\$\(|>>|\|\||&&/;

function hookPath() {
  const root = process.env.CLAUDE_PLUGIN_ROOT || process.env.PLUGIN_ROOT;
  return root ? join(root, "hooks", "semtrim.mjs") : HOOK_PATH;
}

// Returns true if `command` is a single simple command with a known filter and
// is safe to append a stdout pipe to.
export function isWrappable(command, cfg = {}) {
  const cmd = String(command ?? "").trim();
  if (!cmd) return false;
  if (cmd.includes("semtrim")) return false; // idempotency: already wrapped
  if (UNSAFE.test(cmd)) return false; // compound / piped / redirected / heredoc
  const detected = detectProgram(cmd);
  if (!detected) return false;
  const key = lookupFilterKey(detected.prog, detected.argv);
  if (!key || !FILTERS[key]) return false;
  if (cfg.filters && cfg.filters[key] === false) return false;
  return true;
}

// Returns the wrapped command string, or null if `command` is not wrappable.
export function wrapCommand(command, cfg = {}) {
  if (!isWrappable(command, cfg)) return null;
  const cmd = String(command).trim();
  const b64 = Buffer.from(cmd, "utf8").toString("base64");
  return `set -o pipefail; ${cmd} 2>&1 | node "${hookPath()}" filter --cmd ${b64}`;
}
