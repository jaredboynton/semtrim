<coding_guidelines>
@AGENTS.md

## Claude Code

- Shared agent guidance is imported from `AGENTS.md` via the `@` import above;
  keep Claude-specific notes here only.
- This is NOT a symlink: the import lets Claude-specific addenda live below
  while every other tool reads `AGENTS.md` directly.
- semtrim's own PreToolUse wrap may rewrite Bash commands in this repo's
  sessions. If a command's output looks filtered, that is expected; use the
  `filter` CLI form to reproduce.
</coding_guidelines>
