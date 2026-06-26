// Cursor adapter — DOCUMENTED NO-OP.
//
// Cursor's hook model does not allow rewriting tool output:
//   - afterShellExecution is observability-only (cannot modify output)
//   - there is no Read-file output-rewrite hook (beforeReadFile only allows
//     allow/deny, not content mutation)
//   - only afterMCPExecution supports output mutation/redaction
// (Cursor Hooks docs, verified 2026-06.)
//
// Because semtrim's value is rewriting shell/Read output, it cannot operate as
// a Cursor agent hook today. This adapter never matches, so on Cursor semtrim
// is a clean no-op rather than a broken integration. If Cursor later adds shell
// output mutation, implement match/extract/emit here.

export const name = "cursor";

export function match() {
  return false;
}

export function extract() {
  return null;
}

export function emit(_job, newText) {
  return { hookSpecificOutput: { updatedToolOutput: newText } };
}
