// Claude Code PostToolUse adapter.
// Read:  tool_response = { type: "text", file: { content, ... } }
// Bash:  tool_response = "<string>"  OR  { stdout, stderr, interrupted, ... }

export const name = "claude";

export function match(payload) {
  // Claude payloads carry tool_name + tool_response and a hook_event_name.
  return Boolean(payload && payload.tool_name && "tool_response" in payload);
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
  // Bash: output schema is a plain string.
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      updatedToolOutput: newText,
    },
  };
}
