#!/usr/bin/env bash
# cleanup-traps: not-applicable -- static scanner; reads scripts, spawns no cleanup-bearing subprocess.
#
# Enforce that every committed shell script declares its cleanup posture: each
# *.sh under install/ and scripts/ MUST either install an EXIT/signal trap or
# carry the annotation `# cleanup-traps: not-applicable`. This keeps temp-file
# and background-process cleanup an explicit, reviewed decision rather than an
# accident waiting to leak.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

while IFS= read -r f; do
  if grep -Eq '^[[:space:]]*trap[[:space:]].*(EXIT|INT|TERM|HUP)' "$f"; then
    continue
  fi
  if grep -Eq '^#[[:space:]]*cleanup-traps:[[:space:]]*not-applicable' "$f"; then
    continue
  fi
  echo "FAIL: $f declares no cleanup posture (add a 'trap ... EXIT' or '# cleanup-traps: not-applicable')" >&2
  fail=1
done < <(find "$ROOT/install" "$ROOT/scripts" -name '*.sh' -type f | sort)

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "cleanup-traps: all shell scripts declare a cleanup posture"
