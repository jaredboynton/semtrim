// Codex PostToolUse adapter.
// Codex surfaces shell tool calls (tool_name often "Bash"/"Shell"/"exec_command")
// with a tool_response that is usually a bare output string. Read-equivalent
// content tools are passed through (Codex has no Read-file rewrite envelope).

export const name = "codex";

const SHELL_TOOLS = new Set(["Bash", "Shell", "exec_command", "REPL"]);

export function match(payload) {
  // Distinguish from Claude: Codex shell results are bare strings and the tool
  // is a shell tool. We only claim Bash-like calls here.
  if (!payload || !payload.tool_name) return false;
  if (!SHELL_TOOLS.has(payload.tool_name)) return false;
  return "tool_response" in payload;
}

function commandFrom(ti) {
  if (!ti || typeof ti !== "object") return "";
  for (const key of ["command", "cmd", "script"]) {
    if (typeof ti[key] === "string") return ti[key];
  }
  return "";
}

function textFrom(response) {
  if (typeof response === "string") return { text: response, structured: null };
  if (response && typeof response === "object") {
    const text =
      typeof response.stdout === "string"
        ? response.stdout + (response.stderr ? "\n" + response.stderr : "")
        : typeof response.output === "string"
          ? response.output
          : typeof response.content === "string"
            ? response.content
            : "";
    return { text, structured: response };
  }
  return { text: "", structured: null };
}

export function extract(payload) {
  const command = commandFrom(payload.tool_input);
  const { text, structured } = textFrom(payload.tool_response);
  if (!text) return null;
  return { tool: "Bash", command, text, structured };
}

export function emit(job, newText) {
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      updatedToolOutput: newText,
    },
  };
}
