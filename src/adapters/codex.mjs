// Codex adapter.
//
// PostToolUse output replacement is NOT supported by Codex (updatedMCPToolOutput
// and suppressOutput are parsed-but-unsupported; only additionalContext / block
// feedback exist, which can't shrink output). So semtrim does NOT rewrite Codex
// tool output via PostToolUse - that path is a documented no-op here.
//
// Codex DOES support PreToolUse `updatedInput` with permissionDecision "allow"
// for Bash (`tool_input.command`), so the command-wrap path works. That is how
// semtrim compresses output on Codex.

export const name = "codex";

const SHELL_TOOLS = new Set(["Bash", "Shell", "exec_command", "REPL"]);

// PostToolUse: never match. Output replacement is unsupported on Codex.
export function match() {
  return false;
}

export function extract() {
  return null;
}

export function emit() {
  return null;
}

// PreToolUse: shell command with a `command` field, before execution.
export function matchPre(payload) {
  if (!payload || !payload.tool_name) return false;
  if (!SHELL_TOOLS.has(payload.tool_name)) return false;
  const ti = payload.tool_input;
  return Boolean(ti && typeof ti.command === "string");
}

export function extractPre(payload) {
  return payload.tool_input.command;
}

// updatedInput for Codex Bash must include a string `command`. Replaces input.
export function emitPre(payload, newCommand) {
  const ti = payload.tool_input || {};
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: { ...ti, command: newCommand },
    },
  };
}
