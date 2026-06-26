#!/usr/bin/env bash
# Wire semtrim into Codex as a PostToolUse hook.
#
# Codex reads hooks from a plugin's .codex-plugin/hooks.json or from the Codex
# settings hooks block, depending on your setup. This script prints the entry to
# add; it does not edit Codex config in place (Codex config layouts vary).

set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_CMD="node \"${PLUGIN_ROOT}/hooks/semtrim.mjs\""

cat <<EOF
Add this PostToolUse hook to your Codex hooks config
(e.g. a .codex-plugin/hooks.json or your Codex settings):

  "PostToolUse": [
    {
      "matcher": "Bash|Shell|exec_command",
      "hooks": [
        { "type": "command", "command": "${HOOK_CMD}", "timeout": 10 }
      ]
    }
  ]

semtrim auto-detects Codex's bare-string shell tool_response shape.
EOF
