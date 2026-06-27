<coding_guidelines>
# semtrim - agent notes

## Project Overview

semtrim is a Claude Code / Codex plugin that does command-aware semantic
compression of agent tool output (Boost-derived, clean-room). The user-facing
contract lives in `README.md`; durable implementation rules live here.

It uses two layers:
- **PreToolUse command-wrap (reliable default)**: rewrites known, pipe-safe Bash
  commands to `set -o pipefail; <cmd> 2>&1 | semtrim filter --cmd <b64>`.
- **PostToolUse rewrite (best-effort)**: emits a correctly-shaped
  `updatedToolOutput` where the host honors it (notably Read).

## Tree Index

```text
.
|-- README.md                 # user-facing contract + two-layer model
|-- AGENTS.md                 # this file: durable agent rules
|-- CLAUDE.md                 # Claude Code import shim (@AGENTS.md)
|-- package.json              # node --test runner; no deps
|-- justfile                  # task runner (test, smoke, lint, version, precommit)
|-- LICENSE                   # MIT
|-- CHANGELOG.md              # Keep a Changelog format
|-- .pre-commit-config.yaml   # gitleaks, shellcheck, node --check, version-sync, cleanup-traps, tests
|-- .github/
|   |-- workflows/ci.yml      # node 20/22 tests + smoke + version-sync; lint job
|   |-- actionlint.yaml       # workflow linter config
|   |-- ISSUE_TEMPLATE/       # bug_report.yml, feature_request.yml
|   `-- pull_request_template.md
|-- config/defaults.json      # thresholds, filters{}, wrap{}, post{}, redact
|-- hooks/
|   |-- semtrim.mjs           # entrypoint dispatcher (filter subcmd vs hook mode)
|   `-- hooks.json            # registers PreToolUse(Bash) + PostToolUse(Read|Bash)
|-- .claude-plugin/           # plugin.json + marketplace.json (Claude)
|-- .codex-plugin/            # plugin.json + hooks.json + marketplace.json (Codex, PreToolUse-only)
|-- src/
|   |-- cli.mjs               # filter mode: stdin output -> compressed stdout
|   |-- wrap.mjs              # PreToolUse wrappability + wrapped form
|   |-- engine.mjs            # run (PostToolUse) / runPre (PreToolUse), redact, never-grow
|   |-- router.mjs            # detectProgram / routeBash / resolveArgv
|   |-- registry.mjs          # program(+subcmd) -> filter key
|   |-- filters.mjs           # declarative filter table (26 families)
|   |-- filter-engine.mjs     # gate -> replace -> keep -> strip -> caps -> on_empty
|   |-- config.mjs            # defaults + user override merge
|   |-- adapters/             # claude | codex | cursor host payload shapes
|   |-- compressors/          # _generic (salience) + _file (Read windower)
|   `-- util/                 # ansi, salience, budget, redact
|-- test/                     # node unit + contract + corpus tests
|   `-- corpus/               # 40 golden fixtures derived from Boost
|-- install/                  # claude.sh, codex.sh, cursor.sh wiring helpers
|-- scripts/                  # smoke-*.sh, bump-version.mjs, check-cleanup-traps.sh
|-- docs/boost-derived-rules.md
`-- reference/                # gitignored Boost binary + mined extracts (provenance)
```

## Commands

- Tests: `npm test` (= `node --test "test/**/*.test.mjs"`) or `just test`
- Claude host-contract smoke: `scripts/smoke-claude.sh`
- Codex host-contract smoke: `scripts/smoke-codex.sh` (or `just smoke` for both)
- Version sync gate: `node scripts/bump-version.mjs --check` (`just version-check`)
- Version bump: `just version <X.Y.Z|patch|minor|major>` (sets all manifests)
- Cleanup-traps check: `bash scripts/check-cleanup-traps.sh`
- Pre-commit (all hooks): `just precommit`
- Manual filter: `<cmd> 2>&1 | node hooks/semtrim.mjs filter --cmd <base64-cmd>`

Run `npm test`, both smoke scripts, and the version-sync gate before committing.

## Invariants (do not break)

- **Never blocks**: any error / empty result exits 0 with no output; original
  passes through. The filter CLI passes stdin through verbatim on error.
- **Never grows**: emit only if strictly smaller than input; else pass-through.
- **Cache-safe**: deterministic, idempotent (`f(f(x)) == f(x)`, including
  re-wrapping an already-wrapped command), no timestamps/volatile tokens.
- **Failure-preserving**: filters drop only known-noise lines, never error
  markers. `pipefail` preserves the wrapped command's exit code.
- **Conservative wrapping**: wrap only single, pipe-safe commands with a known
  filter; never compound/piped/redirected/heredoc/backgrounded/already-wrapped.

## Host-Contract Rules (learned the hard way)

- Claude `updatedToolOutput` MUST match the tool's output shape. Bash is
  `{stdout,stderr,interrupted,isImage}`; a bare string is silently ignored.
- Claude PostToolUse Bash output replacement is unreliable
  (anthropics/claude-code#65122, #54196). Treat PreToolUse wrap as the reliable
  path; PostToolUse is best-effort (Read is the dependable consumer).
- Codex does NOT support PostToolUse output replacement; its adapter is a no-op
  there and compresses via PreToolUse wrap only. Codex intercepts simple shell
  calls only.
- Cursor cannot mutate shell/Read output; it is no-op only (see install/cursor.sh).
- `match_output_select` in a filter is an ACTIVATION GATE (only transform
  recognized output), NOT a keep-list. `strip_lines_matching` does the reduction.
  Only git-status uses a true `keep_lines_matching`.

## Repo-Wide Rules

- No emoji in code, comments, logs, or docs.
- Add only necessary comments (hidden constraints / invariants), never
  task-narrative comments.
- New runtime path requires wrapper + implementation + a smoke/unit check before
  it is documented.
- Filter rules are clean-room reimplementations validated against the recovered
  Boost fixtures in `test/corpus/`. `reference/` is provenance-only, gitignored.
- Do not hardcode secrets or absolute user paths in committed files.
- Pre-commit (`.pre-commit-config.yaml`) runs gitleaks, shellcheck,
  `node --check`, the version-sync gate, the cleanup-traps check, and the test
  suite. Every committed `*.sh` under `install/` and `scripts/` MUST declare a
  cleanup posture: either a `trap ... EXIT` or a `# cleanup-traps: not-applicable`
  annotation (enforced by `scripts/check-cleanup-traps.sh`).
- Version lives in `package.json` and every plugin manifest; change it only via
  `just version` (or `scripts/bump-version.mjs`) so all manifests stay in sync.
- Distribution is Claude/Codex plugin only (not published to npm). The remote is
  `github.com/jaredboynton/semtrim`.
</coding_guidelines>
