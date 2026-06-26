# semtrim

Command-aware semantic compression of agent tool output, applied as a
PostToolUse hook. Replaces blind head+tail truncation with a **data-driven
filter engine**: one declarative rule set per command family (npm, pnpm, pip,
docker, go, cargo, tsc, next, vitest, jest, pytest, git status/push, eslint,
ruff, mypy, golangci-lint, gcc, prettier, black, rubocop, rspec, biome, turbo,
nx) plus a generic ANSI+dedup+salience fallback, and a secret-redaction pass.
Deterministic and cache-safe; it never blocks and never grows output.

The filter rules and a golden test corpus were derived by analyzing
[JFrog Boost](https://boost.jfrog.com/)'s behavior and its embedded test
fixtures (Boost's filter logic ships in a compiled Go binary; this is a
clean-room reimplementation in Node). See `docs/boost-derived-rules.md`.

## What it does

On each Read/Bash tool result, before the output enters the model's context:

- **Bash**: detects the program and routes to a declarative filter. Each filter
  has an *activation gate* (only transform output that looks like that command),
  a *strip list* of known-noise line patterns to drop, optional *replace* rules
  and an *on_empty* fallback message. Signal (errors, tracebacks, test
  pass/fail tallies, lint diagnostics, ref updates) is preserved; noise
  (progress bars, ANSI, per-module/per-test scaffolding, digests, vuln/PR
  chatter) is dropped. Unknown commands get a generic ANSI-strip +
  consecutive-line dedup + salience pass, with truncation only when over budget.
- **Read**: line-aware head+tail windowing of large file content (keeps
  structure), instead of raw byte slicing.
- **Redaction**: a final pass scrubs secrets (`*_TOKEN`/`*_SECRET`/`AWS_*`/
  `DATABASE_URL`/bearer tokens/`AKIA…`/`ghp_…`/URL credentials) from any output
  before it reaches the model.

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
- **Failure-preserving**: filters only ever drop known-noise lines, never error
  markers, so failing tests, compiler errors, tracebacks, and lint diagnostics
  survive verbatim. If a filter's activation gate does not recognize the output,
  it is passed through unchanged rather than risk mangling it.

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
  "filters": { "docker-build": false },
  "redact": true,
  "genericOnly": false
}
```

- `thresholdBytes` - size above which truncation/salience kicks in.
- `headBytes` / `tailBytes` - window sizes for Read truncation.
- `salienceBudgetBytes` - budget for the generic salience filter.
- `filters.<key>` - set `false` to fall back to generic for that family
  (keys match `src/filters.mjs`, e.g. `npm`, `docker-build`, `git-status`).
- `redact` - set `false` to disable the secret-redaction pass.
- `genericOnly` - skip all per-command filters.

## Architecture

```
stdin JSON -> adapter (claude|codex|cursor) -> extract job
           -> Read:  file windower
           -> Bash:  router (detect program) -> registry -> filter key
                       -> filter-engine.applyFilter(FILTERS[key])
                       -> generic fallback (gate miss / unknown command)
           -> redaction pass -> never-grow check -> adapter emit -> stdout
```

- `hooks/semtrim.mjs` - entrypoint (stdin/stdout, never throws).
- `src/engine.mjs` - adapter selection, dispatch, redaction, never-grow safety.
- `src/router.mjs` - shell program detection (env prefixes, `python -m`,
  `npx`/`poetry run` wrappers, operator splitting).
- `src/registry.mjs` - program (+subcommand) -> filter key map.
- `src/filters.mjs` - declarative filter table (one entry per family).
- `src/filter-engine.mjs` - generic interpreter (gate -> replace -> keep ->
  strip -> caps -> on_empty).
- `src/compressors/{_generic,_file}.mjs` - generic fallback + Read windower.
- `src/adapters/*` - host payload schemas.
- `src/util/*` - ansi, salience, budget, redact.

## Development

```bash
npm test   # node --test "test/**/*.test.mjs"
```

Tests cover: the declarative filters against a **golden corpus** of fixtures
derived from Boost (`test/corpus/`), per-command behavior on hand-written
fixtures, program detection, and the invariants (never-grow, idempotency,
determinism, no volatile markers).

`reference/` (gitignored) holds the Boost binary and the mined filter/fixture
extracts used to derive the rules; it is reference-only provenance. Boost's
filter logic is not published as source (compiled Go binary), so semtrim's
filters are a clean-room reimplementation validated against the recovered
input/expected fixtures.
