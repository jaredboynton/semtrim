#!/usr/bin/env bash
# cleanup-traps: not-applicable -- prints help text via a cat heredoc; spawns no subprocess.
# Wire semtrim into Codex.
#
# Codex does NOT support PostToolUse output replacement, so semtrim compresses
# via the PreToolUse command-wrap path only: it rewrites known shell commands to
# pipe their output through the semtrim filter before the model sees it.
#
# Codex reads hooks from ~/.codex/hooks.json (or a repo .codex/hooks.json, or a
# plugin's hooks/hooks.json). This script prints the entry to add; it does not
# edit Codex config in place (Codex config layouts vary).

set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_CMD="node \"${PLUGIN_ROOT}/hooks/semtrim.mjs\""

cat <<EOF
Add this PreToolUse hook to your Codex hooks config
(e.g. ~/.codex/hooks.json):

  "PreToolUse": [
    {
      "matcher": "Bash|Shell|exec_command",
      "hooks": [
        { "type": "command", "command": "${HOOK_CMD}", "timeout": 10 }
      ]
    }
  ]

Notes:
  - semtrim rewrites recognized commands (npm, pytest, docker build, ...) to
    pipe through its filter; unrecognized/compound commands pass through.
  - Codex's PreToolUse currently intercepts simple shell calls only; richer
    unified_exec interception is incomplete upstream.
  - PostToolUse output replacement is unsupported on Codex, so there is no
    PostToolUse entry.
EOF
