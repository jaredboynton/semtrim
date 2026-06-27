## Summary

- TBD

## Verification

- [ ] `npm test`
- [ ] `bash scripts/smoke-claude.sh && bash scripts/smoke-codex.sh`
- [ ] `node scripts/bump-version.mjs --check`

```bash

```

## Checklist

- [ ] Scope is limited to the requested change.
- [ ] New filter rules are validated against fixtures in `test/corpus/`.
- [ ] Invariants preserved (never blocks, never grows, cache-safe, failure-preserving).
- [ ] Documentation updated when behavior changed.
- [ ] Version fields changed only through `just version` when a release bump was needed.
