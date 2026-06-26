#!/usr/bin/env bash
# Host-contract smoke test for Claude Code payloads.
#
# Feeds real PreToolUse / PostToolUse JSON payloads into the hook entrypoint and
# asserts the emitted JSON matches the documented Claude shapes. This verifies
# OUR side of the contract without a live agent. Whether the running Claude Code
# version actually honors PostToolUse output replacement can only be confirmed
# manually in a live session (see README); PreToolUse wrap is the reliable path.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/hooks/semtrim.mjs"
fail() { echo "FAIL: $1" >&2; exit 1; }

# 1. PreToolUse Bash with a known command -> allow + wrapped updatedInput
pre=$(printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"npm ci"}}' | node "$HOOK")
echo "$pre" | grep -qF '"permissionDecision":"allow"' || fail "PreToolUse: missing allow"
echo "$pre" | grep -qF 'filter --cmd' || fail "PreToolUse: command not wrapped"
echo "$pre" | grep -qF 'set -o pipefail' || fail "PreToolUse: missing pipefail"
echo "PASS: PreToolUse Bash wrap"

# 2. PreToolUse unknown command -> no output (normal flow)
pre2=$(printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo hi"}}' | node "$HOOK")
[ -z "$pre2" ] || fail "PreToolUse: should not wrap 'echo hi'"
echo "PASS: PreToolUse passthrough"

# 3. PostToolUse Bash (structured) -> structured updatedToolOutput
big=$(printf 'npm warn deprecated x\n%.0s' $(seq 1 40)); big="$big"$'added 9 packages\nfound 0 vulnerabilities\n'
payload=$(node -e 'const b=process.argv[1];process.stdout.write(JSON.stringify({hook_event_name:"PostToolUse",tool_name:"Bash",tool_input:{command:"npm ci"},tool_response:{stdout:b,stderr:"",interrupted:false,isImage:false}}))' "$big")
post=$(printf '%s' "$payload" | node "$HOOK")
echo "$post" | grep -qF '"updatedToolOutput":{"stdout"' || fail "PostToolUse: not a structured envelope"
echo "$post" | grep -qF '"isImage":false' || fail "PostToolUse: missing isImage"
echo "PASS: PostToolUse Bash structured envelope"

echo "ALL CLAUDE SMOKE CHECKS PASSED"
