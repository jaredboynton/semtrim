#!/usr/bin/env bash
# cleanup-traps: not-applicable -- runs node hooks in-process; creates no temp files or background jobs.
# Host-contract smoke test for Codex payloads.
#
# Codex compresses via the PreToolUse command-wrap path only; PostToolUse output
# replacement is unsupported on Codex, so semtrim is a no-op there by design.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/hooks/semtrim.mjs"
fail() { echo "FAIL: $1" >&2; exit 1; }

# 1. PreToolUse shell command -> allow + wrapped updatedInput
pre=$(printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Shell","tool_input":{"command":"go test ./..."}}' | node "$HOOK")
echo "$pre" | grep -qF '"permissionDecision":"allow"' || fail "PreToolUse: missing allow"
echo "$pre" | grep -qF 'filter --cmd' || fail "PreToolUse: command not wrapped"
echo "PASS: Codex PreToolUse Shell wrap"

# 2. PostToolUse shell -> no output (documented no-op on Codex)
post=$(printf '%s' '{"hook_event_name":"PostToolUse","tool_name":"Shell","tool_input":{"command":"go test ./..."},"tool_response":"ok\nok\nok\n"}' | node "$HOOK")
[ -z "$post" ] || fail "PostToolUse: Codex should be a no-op"
echo "PASS: Codex PostToolUse no-op"

echo "ALL CODEX SMOKE CHECKS PASSED"
