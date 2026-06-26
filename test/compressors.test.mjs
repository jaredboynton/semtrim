import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadConfig } from "../src/config.mjs";
import { run, compress, selectAdapter } from "../src/engine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures");
const cfg = loadConfig();

function job(name) {
  const payload = JSON.parse(readFileSync(join(FIX, name, "in.json"), "utf8"));
  const adapter = selectAdapter(payload);
  return { payload, job: adapter.extract(payload) };
}

test("npm: drops deprecation/funding noise, keeps package + vuln summary", () => {
  const { job: j } = job("npm-ci");
  const out = compress(j, cfg);
  assert.match(out, /added 1285 packages/);
  assert.match(out, /found 0 vulnerabilities/);
  assert.doesNotMatch(out, /deprecated/);
  assert.doesNotMatch(out, /looking for funding/);
  assert.doesNotMatch(out, /npm notice/);
});

test("docker: collapses to step + cache summary, keeps success line", () => {
  const { job: j } = job("docker-build");
  const out = compress(j, cfg);
  assert.match(out, /docker build: 12 steps, 2 cached/);
  assert.match(out, /Successfully tagged app:latest/);
  assert.doesNotMatch(out, /Running in a1b2c3d4/);
});

test("go: summarizes ok packages, drops PASS run lines", () => {
  const { job: j } = job("go-test");
  const out = compress(j, cfg);
  assert.match(out, /package\(s\) ok/);
  assert.doesNotMatch(out, /=== RUN/);
  assert.doesNotMatch(out, /--- PASS/);
});

test("pytest pass: keeps summary only", () => {
  const { job: j } = job("pytest-pass");
  const out = compress(j, cfg);
  assert.match(out, /42 passed/);
  assert.doesNotMatch(out, /\[ 23%\]/);
});

test("pytest fail: preserves the failure block verbatim", () => {
  const { job: j } = job("pytest-fail");
  const out = compress(j, cfg);
  assert.match(out, /FAILED tests\/test_b\.py::test_thing/);
  assert.match(out, /assert 4 == 5/);
  assert.match(out, /1 failed, 2 passed/);
});

test("gh pr list: keeps rows, drops 'Showing N of M' preamble", () => {
  const { job: j } = job("gh-pr-list");
  const out = compress(j, cfg);
  assert.match(out, /#83  feat: load traces to db/);
  assert.doesNotMatch(out, /Showing 12 of 24/);
});

test("Read large: line-windowed with marker, smaller than input", () => {
  // Build a large file payload dynamically.
  const big = Array.from({ length: 4000 }, (_, i) => `line ${i} ${"x".repeat(20)}`).join("\n");
  const payload = {
    tool_name: "Read",
    tool_input: { file_path: "/tmp/big.txt" },
    tool_response: {
      type: "text",
      file: { filePath: "/tmp/big.txt", content: big, numLines: 4000, startLine: 1, totalLines: 4000 },
    },
  };
  const out = run(payload, cfg);
  assert.ok(out, "should rewrite");
  const content = out.hookSpecificOutput.updatedToolOutput.file.content;
  assert.ok(content.length < big.length);
  assert.match(content, /trimmed \d+ lines from middle/);
});

test("small Bash output passes through unchanged (null)", () => {
  const payload = {
    tool_name: "Bash",
    tool_input: { command: "echo hi" },
    tool_response: "hi\n",
  };
  assert.equal(run(payload, cfg), null);
});

test("malformed payload never throws, returns null", () => {
  assert.equal(run({ nonsense: true }, cfg), null);
  assert.equal(run(null, cfg), null);
});
