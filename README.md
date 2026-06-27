# semtrim

[![CI](https://github.com/jaredboynton/semtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/jaredboynton/semtrim/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

Command-aware semantic compression of agent tool output. Replaces blind
head+tail truncation with a **data-driven filter engine**: one declarative rule
set per command family (npm, pnpm, pip, docker, go, cargo, tsc, next, vitest,
jest, pytest, git status/push, eslint, ruff, mypy, golangci-lint, gcc, prettier,
black, rubocop, rspec, biome, turbo, nx) plus a generic ANSI+dedup+salience
fallback, and a secret-redaction pass. Deterministic and cache-safe; it never
blocks and never grows output.

The filter rules and a golden test corpus were derived by analyzing
[JFrog Boost](https://boost.jfrog.com/)'s behavior and its embedded test
fixtures (Boost's filter logic ships in a compiled Go binary; this is a
clean-room reimplementation in Node). See `docs/boost-derived-rules.md`.

## Two layers

Claude Code's `PostToolUse` output replacement is **unreliable for Bash** on
current versions: per the hooks reference the replacement must match the tool's
structured shape, and even then Bash replacement is reported dropped
([anthropics/claude-code#65122](https://github.com/anthropics/claude-code/issues/65122),
[#54196](https://github.com/anthropics/claude-code/issues/54196)). semtrim
therefore uses two layers:

1. **PreToolUse command-wrap (reliable default).** Before a recognized Bash
   command runs, semtrim rewrites it to pipe its own output through the semtrim
   filter:

   ```
   npm ci
   # becomes
   set -o pipefail; npm ci 2>&1 | node <semtrim>/hooks/semtrim.mjs filter --cmd <b64>
   ```

   `pipefail` preserves the original exit code; the wrapped command's stdout is
   what the agent sees, so this sidesteps output replacement entirely. This is
   the documented, working `updatedInput` path on both Claude Code and Codex.

2. **PostToolUse output replacement (best-effort).** semtrim also emits a
   correctly-shaped `updatedToolOutput` (structured `{stdout,stderr,interrupted,
   isImage}` for Bash; the file envelope for Read). This is honored where the
   platform supports it, notably **Read** (which has no command to wrap).

## What it does

- **Bash**: detects the program and routes to a declarative filter. Each filter
  has an *activation gate* (only transform output that looks like that command),
  a *strip list* of known-noise line patterns to drop, optional *replace* rules
  and an *on_empty* fallback message. Signal (errors, tracebacks, test
  pass/fail tallies, lint diagnostics, ref updates) is preserved; noise
  (progress bars, ANSI, per-module/per-test scaffolding, digests, vuln/PR
  chatter) is dropped. Unknown/compound commands are left alone.
- **Read**: line-aware head+tail windowing of large file content (keeps
  structure), instead of raw byte slicing. (PostToolUse path only.)
- **Redaction**: a final pass scrubs secrets (`*_TOKEN`/`*_SECRET`/`AWS_*`/
  `DATABASE_URL`/bearer tokens/`AKIA…`/`ghp_…`/URL credentials) from output
  before it reaches the model, preserving the original `:`/`=` separator.
- **Manual CLI**: `somecmd 2>&1 | node hooks/semtrim.mjs filter --cmd <b64>` (or
  use the wrap form) works as a Boost/chop-style manual filter.

### Example

```
# Before (git push noise)
Enumerating objects: 12, done.
Writing objects: 100% (7/7), 1.2 KiB | 1.2 MiB/s, done.
remote: Create a pull request for 'main' on GitHub by visiting:
remote:   https://github.com/acme/app/pull/new/main
To github.com:acme/app.git
   abc1234..def5678  main -> main

# After
To github.com:acme/app.git
   abc1234..def5678  main -> main
```

## Scope boundary

semtrim is **compression-only**. It does not do Boost's command-result *caching*
(skipping re-runs) - that needs a persistent CLI wrapper and is out of scope.
semtrim captures the token win, not the speed win.

## Safety properties

- **Never blocks**: any parse error, exception, or empty result exits 0 with no
  output, so the original tool result/command passes through unchanged. The
  filter CLI passes stdin through verbatim on any error.
- **Never grows**: output is emitted only if strictly smaller than the input;
  otherwise pass-through.
- **Cache-safe**: hooks never invalidate the prompt-cache prefix; the rewrite is
  deterministic, idempotent (`f(f(x)) == f(x)`, including re-wrapping an
  already-wrapped command), and injects no timestamps or volatile tokens.
- **Failure-preserving**: filters only ever drop known-noise lines, never error
  markers, so failing tests, compiler errors, tracebacks, and lint diagnostics
  survive verbatim. `pipefail` preserves the command's exit code. If a filter's
  activation gate does not recognize the output, it is passed through unchanged.
- **Conservative wrapping**: only single, pipe-safe commands with a known filter
  are wrapped; compound/piped/redirected/heredoc/backgrounded commands and
  already-wrapped commands are left untouched.

## Install

### Claude Code (primary)

```bash
./install/claude.sh
```

Registers a **PreToolUse** hook (matcher `Bash`) and a **PostToolUse** hook
(matcher `Read|Bash`), backing up the settings file first and prompting before
it writes. It also removes a prior `posttooluse-trim.mjs` registration if
present (semtrim supersedes it). As a plugin, `hooks/hooks.json` registers both
events automatically.

### Codex

```bash
./install/codex.sh   # prints the PreToolUse entry to add
```

Codex uses the **PreToolUse wrap path only** (it does not support PostToolUse
output replacement). Codex currently intercepts simple shell calls only.

### Cursor

Not supported. Cursor's `afterShellExecution` hook is observability-only and
cannot modify tool output or commands, and there is no Read-output rewrite hook.
Use JFrog Boost for Cursor token reduction instead. See `./install/cursor.sh`.

### Verifying it works

```bash
npm test                 # unit + contract + corpus tests
scripts/smoke-claude.sh  # assert Claude PreToolUse/PostToolUse envelope shapes
scripts/smoke-codex.sh   # assert Codex PreToolUse wrap + PostToolUse no-op
```

The smoke scripts verify *our* side of the host contract. Whether a given Claude
Code version actually honors PostToolUse replacement can only be confirmed in a
live session: run a noisy command (e.g. `npm ci`) and check the transcript shows
the compressed output. The PreToolUse wrap path does not depend on that.

## Configuration

Defaults live in `config/defaults.json`. Override per-user at
`~/.config/semtrim/config.json` (or `$SEMTRIM_CONFIG`):

```json
{
  "thresholdBytes": 20480,
  "salienceBudgetBytes": 12288,
  "filters": { "docker-build": false },
  "redact": true,
  "genericOnly": false,
  "wrap": { "enabled": true },
  "post": { "enabled": true }
}
```

- `thresholdBytes` - size above which truncation/salience kicks in.
- `headBytes` / `tailBytes` - window sizes for Read truncation.
- `salienceBudgetBytes` - budget for the generic salience filter.
- `filters.<key>` - set `false` to skip wrapping/compressing that family
  (keys match `src/filters.mjs`, e.g. `npm`, `docker-build`, `git-status`).
- `redact` - set `false` to disable the secret-redaction pass.
- `genericOnly` - skip all per-command filters.
- `wrap.enabled` - set `false` to disable the PreToolUse command-wrap layer.
- `post.enabled` - set `false` to disable the PostToolUse rewrite layer.

## Architecture

```
PreToolUse  -> selectPreAdapter -> wrapCommand (known + pipe-safe?)
                                 -> permissionDecision:allow + updatedInput
wrapped cmd -> "<cmd> 2>&1 | semtrim filter" -> filter mode:
                 routeBash -> filter-engine -> redact -> never-grow -> stdout

PostToolUse -> selectAdapter -> extract job
                 Read: file windower / Bash: routeBash -> filter-engine
                 -> redact -> never-grow -> structured updatedToolOutput
```

- `hooks/semtrim.mjs` - entrypoint dispatcher (`filter` subcommand vs hook mode).
- `src/cli.mjs` - filter mode (stdin output -> compressed stdout).
- `src/wrap.mjs` - PreToolUse command-wrap (wrappability + wrapped form).
- `src/engine.mjs` - adapter selection, `run` (PostToolUse) / `runPre`
  (PreToolUse), redaction, never-grow safety.
- `src/router.mjs` - shell program detection (env prefixes, `python -m`,
  `npx`/`poetry run` wrappers, operator splitting).
- `src/registry.mjs` - program (+subcommand) -> filter key map.
- `src/filters.mjs` - declarative filter table (one entry per family).
- `src/filter-engine.mjs` - generic interpreter (gate -> replace -> keep ->
  strip -> caps -> on_empty).
- `src/compressors/{_generic,_file}.mjs` - generic fallback + Read windower.
- `src/adapters/*` - host payload schemas + emit shapes (Claude structured Bash
  envelope + PreToolUse `updatedInput`; Codex PreToolUse-only; Cursor no-op).
- `src/util/*` - ansi, salience, budget, redact.

## Development

```bash
npm test       # node --test "test/**/*.test.mjs"
just test      # same, via the task runner
just smoke     # both host-contract smoke scripts
just lint      # node --check sources + shellcheck shell scripts
just precommit # run all pre-commit hooks
```

CI (`.github/workflows/ci.yml`) runs the test suite on Node 20 and 22, both
smoke scripts, the version-sync gate, and a lint job (actionlint, shellcheck,
gitleaks) on every push and PR.

Tests cover: the declarative filters against a **golden corpus** of fixtures
derived from Boost (`test/corpus/`), per-command behavior, program detection,
host-contract envelope shapes (`test/contract.test.mjs`), redaction fidelity,
and the invariants (never-grow, idempotency, determinism, no volatile markers).

`reference/` (gitignored) holds the Boost binary and the mined filter/fixture
extracts used to derive the rules; it is reference-only provenance. Boost's
filter logic is not published as source (compiled Go binary), so semtrim's
filters are a clean-room reimplementation validated against the recovered
input/expected fixtures.

## Releasing

semtrim is distributed as a Claude Code / Codex plugin (not published to npm).
The version string lives in `package.json` and every plugin manifest; bump them
in one pass and tag:

```bash
just version patch      # or: just version 0.2.0  (also minor|major)
just version-check      # verify all manifests agree (also runs in CI)
git commit -am "semtrim 0.2.0" && git tag v0.2.0
```

`just version` refuses same-version and down-version targets and fails if any
manifest is left out of sync.
