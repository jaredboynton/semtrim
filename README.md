# semtrim

Command-aware semantic compression of agent tool output, applied as a
PostToolUse hook. Replaces blind head+tail truncation with per-command filters
(gh, docker, npm-family, go, cargo, bundlers, pytest/jest/vitest, git, linters)
plus a generic ANSI+dedup+salience fallback. Deterministic and cache-safe; it
never blocks and never grows output.

Inspired by [JFrog Boost](https://boost.jfrog.com/)'s command-aware filtering,
reimplemented clean-room as a hook.

## What it does

On each Read/Bash tool result, before the output enters the model's context:

- **Bash**: detects the program and routes to a compressor that rebuilds the
  output structurally - keeps the signal (package counts, vuln summary, build
  step/cache summary, test pass/fail counts, failing test blocks, lint
  problems), drops the noise (deprecation spam, progress bars, ANSI, per-module
  chatter, PASS run lines). Unknown commands get a generic ANSI-strip +
  consecutive-line dedup + salience pass, with truncation only when over budget.
- **Read**: line-aware head+tail windowing of large file content (keeps
  structure), instead of raw byte slicing.

### Example

```
# Before (~9,800 chars of install noise)
npm warn deprecated inflight@1.0.6 ...
npm notice New major version ...
added 1285 packages, and audited 1286 packages in 45s
211 packages are looking for funding
found 0 vulnerabilities

# After
added 1285 packages, and audited 1286 packages in 45s
found 0 vulnerabilities
```

## Scope boundary

semtrim is **compression-only**. A PostToolUse hook fires *after* a command
runs, so it cannot do Boost's command-result *caching* (skipping re-runs) - that
needs a CLI wrapper and is out of scope. semtrim captures the token win, not the
speed win.

## Safety properties

- **Never blocks**: any parse error, exception, or empty result exits 0 with no
  output, so the original tool result passes through unchanged.
- **Never grows**: output is emitted only if it is strictly smaller than the
  input; otherwise pass-through.
- **Cache-safe**: deterministic, idempotent (`f(f(x)) == f(x)`), injects no
  timestamps or volatile tokens. The rewritten output is what gets cached going
  forward, so it does not bust the prompt cache.
- **Failure-preserving**: on detected failure (non-zero exit / strong error
  markers), compressors keep the failing test, compiler error, or stack frame
  verbatim rather than summarizing it away.

## Install

### Claude Code (primary)

As a plugin: add this repo to a marketplace and enable it, or wire the hook
directly:

```bash
./install/claude.sh
```

This adds a PostToolUse hook (matcher `Read|Bash`) to your Claude settings,
backing up the file first and prompting before it writes. It also removes a
prior `posttooluse-trim.mjs` registration if present (semtrim supersedes it).

### Codex

```bash
./install/codex.sh   # prints the hook entry to add to your Codex hooks config
```

### Cursor

Not supported. Cursor's `afterShellExecution` hook is observability-only and
cannot modify tool output, and there is no Read-output rewrite hook. Use JFrog
Boost for Cursor token reduction instead. See `./install/cursor.sh`.

## Configuration

Defaults live in `config/defaults.json`. Override per-user at
`~/.config/semtrim/config.json` (or `$SEMTRIM_CONFIG`):

```json
{
  "thresholdBytes": 20480,
  "salienceBudgetBytes": 12288,
  "compressors": { "docker": false },
  "genericOnly": false
}
```

- `thresholdBytes` - size above which truncation/salience kicks in.
- `headBytes` / `tailBytes` - window sizes for truncation.
- `salienceBudgetBytes` - budget for the generic salience filter.
- `compressors.<name>` - set `false` to fall back to generic for that family.
- `genericOnly` - skip all per-command compressors.

## Architecture

```
stdin JSON -> adapter (claude|codex|cursor) -> extract job
           -> Read:  file windower
           -> Bash:  router (detect program) -> registry compressor
                                              -> generic fallback
           -> never-grow check -> adapter emit -> stdout
```

- `hooks/semtrim.mjs` - entrypoint (stdin/stdout, never throws).
- `src/engine.mjs` - adapter selection, dispatch, never-grow safety.
- `src/router.mjs` - shell program detection (env prefixes, `python -m`,
  `npx`/`poetry run` wrappers, operator splitting).
- `src/registry.mjs` - program -> compressor map.
- `src/compressors/*` - per-command filters + `_generic` + `_file`.
- `src/adapters/*` - host payload schemas.
- `src/util/*` - ansi, salience, budget, exit-detect.

## Development

```bash
node --test "test/**/*.test.mjs"
```

Tests cover: per-command compression behavior, failure preservation, program
detection, and the invariants (never-grow, idempotency, determinism, no volatile
markers) across all fixtures.

`reference/boost/` is a clone of JFrog Boost kept for behavioral reference only
(gitignored; Boost's filter source is not public - it ships as a compiled
binary, so semtrim is a clean-room reimplementation).
