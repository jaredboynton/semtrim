// Exit/failure detection from command output text.
// Signal-first: trust structured exit codes; otherwise use high-precision
// anchored markers only. Never guess failure from bare "error"/"failed" words.
// Ported in spirit from the unifable parse_tool_result heuristics.

const EXIT_CODE_RE = /\bexit(?:ed)?(?: with)? (?:code|status) (\d+)\b/i;

const STRONG_FAILURE_RE = new RegExp(
  [
    "\\btraceback \\(most recent call last\\)",
    ": command not found",
    "\\bsegmentation fault\\b",
    "\\bcore dumped\\b",
    "\\bpanicked at\\b",
    "^fatal: ",
    "^fatal error:",
    "\\bexit (?:code|status) [1-9][0-9]*\\b",
    "\\bexited with code [1-9][0-9]*\\b",
    "\\b[1-9][0-9]*\\s+(?:tests?\\s+)?failed\\b",
    "\\b[1-9][0-9]*\\s+(?:previous\\s+)?errors?\\b",
  ].join("|"),
  "im",
);

const SUCCESS_RE = /\b(passed|success|succeeded|0 failed|0 errors?|build (?:completed|succeeded)|done|valid|ok)\b/i;

// Returns true (success), false (failure), or null (unknown).
// `structured` is an optional object that may carry exit_code/success fields
// (Claude Bash tool_response, etc.).
export function exitSuccess(text, structured) {
  if (structured && typeof structured === "object") {
    for (const key of ["success", "ok"]) {
      if (typeof structured[key] === "boolean") return structured[key];
    }
    for (const key of ["exit_code", "exitCode", "returncode", "status"]) {
      const v = structured[key];
      if (typeof v === "boolean") continue;
      if (typeof v === "number") return v === 0;
      if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v) === 0;
    }
    if (structured.interrupted === true) return false;
  }
  const t = String(text ?? "");
  const m = EXIT_CODE_RE.exec(t);
  if (m) return Number(m[1]) === 0;
  if (STRONG_FAILURE_RE.test(t)) return false;
  if (SUCCESS_RE.test(t)) return true;
  return null;
}

// Convenience: did this output show a failure (true only on positive evidence)?
export function looksFailed(text, structured) {
  return exitSuccess(text, structured) === false;
}
