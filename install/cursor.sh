#!/usr/bin/env bash
# cleanup-traps: not-applicable -- prints help text via a cat heredoc; spawns no subprocess.
# semtrim + Cursor: NOT SUPPORTED (informational).
#
# Cursor's agent hooks cannot rewrite tool output:
#   - afterShellExecution is observability-only (cannot modify output)
#   - beforeReadFile only allows allow/deny, not content mutation
#   - only afterMCPExecution supports output mutation
# (Cursor Hooks docs, verified 2026-06.)
#
# semtrim's value is rewriting shell/Read output, so it cannot run as a Cursor
# agent hook today. This script exists to explain that, not to install anything.

cat <<'EOF'
semtrim does not support Cursor.

Cursor's afterShellExecution hook is observability-only and cannot modify the
command output the model sees, and there is no Read-output rewrite hook. Until
Cursor adds shell-output mutation, semtrim has nothing to rewrite there.

For Cursor token reduction today, use JFrog Boost (a CLI wrapper that compresses
output before it reaches the agent) instead.
EOF
