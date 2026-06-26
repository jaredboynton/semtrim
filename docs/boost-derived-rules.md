# Boost-derived filter rules and semtrim redesign

Source: static analysis of the JFrog Boost v0.8.0 binary (`boost-darwin-arm64`,
Go). The binary embeds its filter definitions as TOML plus input/expected test
fixtures. This is our own analysis of observed behavior; no Boost source code is
copied (Boost's Go source is not published). Working extracts live in
`reference/findings/` (gitignored).

## Headline finding

Boost does NOT hardcode per-command logic. It uses a **declarative, data-driven
filter schema** - one TOML table per command family - interpreted by a single
generic engine. There are **78 builtin filters** and **199 embedded test
fixtures**. This is a cleaner, more extensible design than semtrim's original
hardcoded `src/compressors/*.mjs`, and we adopt it.

## Filter schema (observed keys)

```toml
[filters.<name>]
description = "..."
version = "1"
match_command = '^<regex>'              # activate when the shell command matches
match_output_select = [ '<regex>', ... ] # KEEP allowlist (see semantics)
keep_lines_matching = [ '<regex>', ... ] # alt keep list (git-status uses this)
strip_ansi = true
strip_lines_matching = [ '<regex>', ... ]# DROP list
replace = [ { pattern = '<re>', replacement = '<str>' } ]  # or [[filters.x.replace]]
on_empty = "<message>"                   # emitted if everything was stripped
max_lines = 40                           # cap output length (head)
truncate_lines_at = 150                  # cap individual line width
```

### Pipeline semantics (derived from comments + fixtures)

Boost's embedded input/expected fixtures reveal the true semantics, which are
NOT what the key names suggest:

1. **Activate** only if `match_command` matches the command. Otherwise the
   generic path runs.
2. **`match_output_select` is an activation gate, NOT a keep-list.** If the
   output contains at least one line matching the select list, the filter
   transforms it; otherwise the output is passed through unchanged (so we never
   mangle output that does not look like what we expect). Proof: the pytest
   fixture lists `'test session starts'` in `match_output_select` yet the
   expected output drops that line entirely - the keep is done elsewhere.
3. `strip_ansi` first.
4. Apply `replace` rules (e.g. docker `@sha256:...` -> ``; git-status worded
   change lines -> `M path`).
5. **`keep_lines_matching` is the only true keep-allowlist** and is applied
   after `replace`. Only `git-status` uses it (keep just the compacted
   `<LETTER> <path>` lines).
6. **`strip_lines_matching` does all the reduction**: drop every line matching
   the strip list. Blank lines are dropped only when an explicit `^\s*$` rule is
   present (it almost always is).
7. `truncate_lines_at` (per-line width) and `max_lines` (total) caps.
8. If the result is empty and `on_empty` is set, emit that message (Never-Block:
   keeps a clean run from looking like a silent failure).

semtrim implements this exactly in `src/filter-engine.mjs`: `select` gates,
`keep` is the rare allowlist, `strip` reduces, gate-miss returns `null` so the
router falls back to the generic compressor (which preserves the output).

Failure preservation is implicit: filters only ever drop known-noise lines via
`strip`, never error markers, so failures, tracebacks, and diagnostics survive.

## Architecture decision

Refactor semtrim from hardcoded compressors to a **data-driven filter engine**:

- `filters/*.toml` (or a single `filters.mjs` table) holding the keep/drop/
  replace/on_empty/caps for each family, ported from the Boost-derived rules.
- A generic `applyFilter(text, filter)` interpreter implementing the pipeline
  above. This replaces the bespoke logic in each `compressors/*.mjs`.
- The router still detects the program; the registry maps it to a filter table.
- Keep our existing wins that Boost lacks here: never-grow guard, idempotency
  marker, host adapters (Claude/Codex), and the optional secret redaction pass.

This shrinks code, matches Boost behavior, and makes adding a family a
data-only change.

## Families to ship (mapped to our registry)

Boost has 78; we port the ones that fit coding-agent shell usage and our
existing registry, then keep the generic fallback for the rest.

| semtrim family | Boost filter(s) | keep (select) | drop |
|---|---|---|---|
| npm | npm | `npm (warn|notice|err)`, `> pkg@ver`, `added N packages`, `npm error` | blanks, `> pkg@ver`, `npm warn`, `npm notice` |
| pnpm | pnpm | `Progress: resolved`, `dependencies:`, `Packages: +/-`, `Already up to date` | blanks, `Progress: resolved`, `Downloading` |
| pip | pip | `Successfully installed`, `Requirement already satisfied`, `Collecting`, `Package Version` | blanks, `Collecting`, `Downloading`, `Using cached`, separators |
| docker (build) | docker-build | `^#N [`, `naming to`, `exporting to image`, `ERROR: failed to solve` | blanks, `[internal]`, `transferring`, `#N DONE`, `#N <time>`, `exporting layers`, `writing image`, `#N extracting/resolve`; replace `@sha256:..`->`` |
| docker (ps/images) | docker-ps, docker-images | header row | blanks; `max_lines=40` |
| go | go | `=== RUN`, `--- FAIL:`, `--- PASS:`, `ok S`, `FAIL`, `? ... [no test files]` | `=== RUN/CONT/PAUSE/NAME`, `--- PASS:`, `ok S`, `PASS`, `? ... [no test files]`; `on_empty="ok"` |
| cargo | cargo | `Compiling/Checking/Finished`, `error[E`, `could not compile`, `test result:`, `running N tests` | blanks, progress verbs, `running N tests`, `test ... ok`, `test ... ignored` |
| bundler (tsc) | tsc | `(L,C): error/warning TS`, `Found N error` | blanks; `on_empty="tsc: ok"` |
| bundler (next) | next | route table, `Compiled successfully`, `Failed to compile` | next build progress lines; `on_empty="next: ok"` |
| bundler (vite via vitest) | vitest | `RUN v`, `Test Files N`, `Tests N`, `FAIL` | blanks, pass ticks, `RUN v`, `Start at`; `on_empty="vitest: ok"` |
| pytest | pytest | `test session starts`, `FAILED`, `ERROR`, ` passed`, ` failed` | session preamble, `platform/rootdir/plugins/cachedir/configfile/collected`, `[ NN%]` |
| jest/vitest | vitest | (reuse vitest rules; jest summary `Tests:`/`Test Suites:`) | per-test pass lines |
| git (status) | git-status | branch headers, change lines | prose/hints; replace worded->letter; `on_empty="working tree clean"` |
| git (push) | git-push | (keep most; drop remote PR hint + vuln notice) | `remote: ...vulnerabilit`, hint lines |
| lint (eslint) | eslint | `L:C error/warning`, `N problem(s)` | blanks; `on_empty="eslint: ok"` |
| lint (ruff) | ruff | `:L:C: [A-Z]N`, `Found N error`, `All checks passed`, reformatted/unchanged | blanks; `on_empty="ruff: ok"` |
| lint (mypy) | mypy | `: error:`, `: note:`, `Found N error`, `Success: no issues` | blanks; `on_empty="mypy: ok"` |
| lint (golangci) | golangci-lint | `.go:L:C:` | blanks, `level=`; `on_empty="golangci-lint: ok"` |
| lint (gcc) | gcc | (keep errors/warnings) | blanks, `In file included from`, `from `, `N warnings/errors generated`; `max_lines=50`, `on_empty="gcc: ok"` |

New capability Boost has that we lack and will add:
- `on_empty` fallback messages (Never-Block on clean runs).
- `replace` rules (docker digest scrub, git-status compaction).
- `max_lines` / `truncate_lines_at` caps.
- A wider drop vocabulary across families.

New capability we keep that Boost does not do in-hook:
- never-grow guard, idempotency marker, Claude/Codex output-rewrite adapters,
  optional secret redaction.

## Note on method

The approved plan called for a dynamic before/after diff plus static mining.
Static mining recovered Boost's actual filter definitions and its own
input/expected fixtures verbatim, which is higher fidelity than diffing observed
output - so we port from those directly and do not need to execute the JFrog
binary at all (also avoids any local telemetry writes). The binary remains in
`reference/boost-bin/` (gitignored) only as provenance.
