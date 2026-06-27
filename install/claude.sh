#!/usr/bin/env bash
# Wire semtrim into Claude Code.
#
# semtrim uses two layers:
#   - PreToolUse (Bash): rewrites known commands to pipe output through the
#     semtrim filter. This is the RELIABLE path (PostToolUse output replacement
#     is unreliable for Bash on current Claude Code).
#   - PostToolUse (Read|Bash): best-effort structured output replacement, used
#     where the platform honors it (notably Read).
#
# By default this targets the settings file at $CLAUDE_CONFIG_DIR (or ~/.claude).
# It prints the proposed change and asks before writing. It will optionally
# replace an existing posttooluse-trim.mjs registration, whose blind truncation
# semtrim supersedes.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETTINGS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
HOOK_CMD="node \"${PLUGIN_ROOT}/hooks/semtrim.mjs\""

echo "semtrim plugin root : ${PLUGIN_ROOT}"
echo "Claude settings file: ${SETTINGS}"
echo
echo "Proposed hooks:"
echo "    PreToolUse  (matcher \"Bash\")      : ${HOOK_CMD}"
echo "    PostToolUse (matcher \"Read|Bash\") : ${HOOK_CMD}"
echo

if ! command -v jq >/dev/null 2>&1; then
  cat <<EOF
jq is not installed, so this script will not edit settings automatically.
Add these to ${SETTINGS} manually:

  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "${HOOK_CMD}", "timeout": 10 }] }
    ],
    "PostToolUse": [
      { "matcher": "Read|Bash",
        "hooks": [{ "type": "command", "command": "${HOOK_CMD}", "timeout": 10 }] }
    ]
  }
EOF
  exit 0
fi

if [ ! -f "${SETTINGS}" ]; then
  echo "No settings file found at ${SETTINGS}."
  echo "Create it with the hooks? [y/N]"
  read -r ans
  [ "${ans}" = "y" ] || { echo "Aborted."; exit 0; }
  mkdir -p "$(dirname "${SETTINGS}")"
  echo '{}' > "${SETTINGS}"
fi

echo "This will:"
echo "  1. (optional) remove any existing posttooluse-trim.mjs / semtrim entries"
echo "  2. add the semtrim PreToolUse and PostToolUse entries"
echo "A backup will be written to ${SETTINGS}.semtrim.bak"
echo "Proceed? [y/N]"
read -r ans
[ "${ans}" = "y" ] || { echo "Aborted."; exit 0; }

cp "${SETTINGS}" "${SETTINGS}.semtrim.bak"

tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT
jq --arg cmd "${HOOK_CMD}" '
  .hooks //= {} |
  .hooks.PreToolUse //= [] |
  .hooks.PostToolUse //= [] |
  # drop prior posttooluse-trim.mjs and any prior semtrim entries
  .hooks.PreToolUse |= map(select(
    ([.hooks[]?.command] | any(test("posttooluse-trim\\.mjs|semtrim\\.mjs"))) | not
  )) |
  .hooks.PostToolUse |= map(select(
    ([.hooks[]?.command] | any(test("posttooluse-trim\\.mjs|semtrim\\.mjs"))) | not
  )) |
  .hooks.PreToolUse += [{
    "matcher": "Bash",
    "hooks": [{ "type": "command", "command": $cmd, "timeout": 10 }]
  }] |
  .hooks.PostToolUse += [{
    "matcher": "Read|Bash",
    "hooks": [{ "type": "command", "command": $cmd, "timeout": 10 }]
  }]
' "${SETTINGS}" > "${tmp}"

mv "${tmp}" "${SETTINGS}"
echo "Done. Restart Claude Code to load the hooks."
