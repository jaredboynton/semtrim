import { test } from "node:test";
import assert from "node:assert/strict";
import { detectProgram } from "../src/router.mjs";

const cases = [
  ["npm ci", "npm"],
  ["npm run build", "npm"],
  ["pnpm install", "pnpm"],
  ["yarn add react", "yarn"],
  ["python -m pytest tests/", "pytest"],
  ["python3 -m pytest", "pytest"],
  ["npx eslint .", "eslint"],
  ["pnpm vitest run", "vitest"],
  ["CI=1 NODE_ENV=test go test ./...", "go"],
  ["/usr/local/bin/docker build .", "docker"],
  ["cd /tmp && cargo test", "cargo"],
  ["git status", "git"],
  ["poetry run pytest", "pytest"],
  ["echo hi | grep x && gh pr list", "gh"],
];

for (const [cmd, expected] of cases) {
  test(`detect: ${cmd} -> ${expected}`, () => {
    const d = detectProgram(cmd);
    assert.ok(d, `detected for: ${cmd}`);
    assert.equal(d.prog, expected);
  });
}

test("empty command -> null", () => {
  assert.equal(detectProgram(""), null);
  assert.equal(detectProgram("   "), null);
});
