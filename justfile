# semtrim task runner. Run `just` to list recipes.

# List available recipes.
_default:
    @just --list

# Run the unit + contract + corpus test suite.
test:
    npm test

# Run both host-contract smoke tests (Claude + Codex).
smoke:
    bash scripts/smoke-claude.sh
    bash scripts/smoke-codex.sh

# Syntax-check the entrypoint and all sources, then shellcheck the shell scripts.
lint:
    node --check hooks/semtrim.mjs
    node --check scripts/bump-version.mjs
    find src -name '*.mjs' -exec node --check {} +
    shellcheck install/*.sh scripts/*.sh

# Assert every manifest version agrees with package.json.
version-check:
    node scripts/bump-version.mjs --check

# Set the version across package.json and all plugin manifests.
# Usage: just version 0.2.0   (or: just version patch|minor|major)
version VERSION:
    node scripts/bump-version.mjs {{VERSION}}

# Run all pre-commit hooks against every file.
precommit:
    pre-commit run --all-files
