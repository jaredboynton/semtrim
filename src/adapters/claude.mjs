// Claude Code PostToolUse adapter.
// Read:  tool_response = { type: "text", file: { content, ... } }
// Bash:  tool_response = "<string>"  OR  { stdout, stderr, interrupted, ... }

export const name = "claude";

export function match(payload) {
  // Claude payloads carry tool_name + tool_response and a hook_event_name.
  return Boolean(payload && payload.tool_name && "tool_response" in payload);
}

// PreToolUse: Bash tool call with a command, before execution (no tool_response).
export function matchPre(payload) {
  return Boolean(
    payload &&
      payload.tool_name === "Bash" &&
      payload.tool_input &&
      typeof payload.tool_input.command === "string",
  );
}

export function extractPre(payload) {
  return payload.tool_input.command;
}

function bashText(response) {
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
  const tool = payload.tool_name;
  const response = payload.tool_response;
  const ti = payload.tool_input || {};

  if (tool === "Read") {
    if (response && response.type === "text" && response.file && typeof response.file.content === "string") {
      return { tool: "Read", text: response.file.content, file: response.file, structured: null };
    }
    return null;
  }

  if (tool === "Bash") {
    const command = typeof ti.command === "string" ? ti.command : "";
    const { text, structured } = bashText(response);
    if (!text) return null;
    return { tool: "Bash", command, text, structured };
  }

  return null;
}

export function emit(job, newText) {
  if (job.tool === "Read") {
    const lines = newText.split("\n").length;
    const file = job.file;
    return {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        updatedToolOutput: {
          type: "text",
          file: {
            filePath: file.filePath,
            content: newText,
            numLines: lines,
            startLine: file.startLine ?? 1,
            totalLines: file.totalLines ?? lines,
            ...(file.truncatedByTokenCap !== undefined && {
              truncatedByTokenCap: file.truncatedByTokenCap,
            }),
          },
        },
      },
    };
  }
  // Bash: the value MUST match the tool's output shape or Claude ignores it and
  // keeps the original. Bash returns { stdout, stderr, interrupted, isImage }.
  // When the original response was that object, return the same shape with the
  // compressed text in stdout; otherwise the response was a bare string.
  const s = job.structured;
  if (s && typeof s === "object" && typeof s.stdout === "string") {
    return {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        updatedToolOutput: {
          stdout: newText,
          stderr: typeof s.stderr === "string" ? s.stderr : "",
          interrupted: Boolean(s.interrupted),
          isImage: Boolean(s.isImage),
        },
      },
    };
  }
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      updatedToolOutput: newText,
    },
  };
}

// PreToolUse: rewrite the Bash command via updatedInput. updatedInput replaces
// the ENTIRE input object, so echo back every original field and change only
// `command`. Pair with permissionDecision "allow" so it is not re-prompted.
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
