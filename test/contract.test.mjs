import { test } from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "../src/config.mjs";
import { run, runPre } from "../src/engine.mjs";
import { wrapCommand, isWrappable } from "../src/wrap.mjs";

const cfg = loadConfig();

// --- PreToolUse wrap: Claude ---------------------------------------------

test("claude PreToolUse: wraps a known command via updatedInput + allow", () => {
  const payload = {
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "npm ci", description: "install deps" },
  };
  const out = runPre(payload, cfg);
  assert.ok(out, "should return a decision");
  const hso = out.hookSpecificOutput;
  assert.equal(hso.hookEventName, "PreToolUse");
  assert.equal(hso.permissionDecision, "allow");
  // updatedInput replaces the whole input object: original fields preserved.
  assert.equal(hso.updatedInput.description, "install deps");
  assert.match(hso.updatedInput.command, /^set -o pipefail; npm ci 2>&1 \| node /);
  assert.match(hso.updatedInput.command, /semtrim\.mjs" filter --cmd /);
});

test("claude PreToolUse: leaves unknown/compound commands unchanged (null)", () => {
  for (const command of ["echo hi", "ls && rm x", "cat a | grep b", "foo; bar"]) {
    const payload = { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } };
    assert.equal(runPre(payload, cfg), null, `should not wrap: ${command}`);
  }
});

test("wrap idempotency: an already-wrapped command is not re-wrapped", () => {
  const once = wrapCommand("npm ci", cfg);
  assert.ok(once);
  assert.equal(wrapCommand(once, cfg), null);
  assert.equal(isWrappable(once, cfg), false);
});

test("wrap preserves exit code via pipefail and base64-encodes the command", () => {
  const w = wrapCommand("pytest", cfg);
  assert.match(w, /^set -o pipefail; pytest 2>&1 \| node /);
  const b64 = w.match(/--cmd (\S+)$/)[1];
  assert.equal(Buffer.from(b64, "base64").toString("utf8"), "pytest");
});

test("wrap respects per-filter disable in config", () => {
  const off = { ...cfg, filters: { ...cfg.filters, npm: false } };
  assert.equal(wrapCommand("npm ci", off), null);
});

test("wrap respects wrap.enabled = false", () => {
  const off = { ...cfg, wrap: { enabled: false } };
  const payload = { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "npm ci" } };
  assert.equal(runPre(payload, off), null);
});

// --- PreToolUse wrap: Codex ----------------------------------------------

test("codex PreToolUse: shell tool wrapped via updatedInput", () => {
  const payload = {
    hook_event_name: "PreToolUse",
    tool_name: "Shell",
    tool_input: { command: "go test ./..." },
  };
  const out = runPre(payload, cfg);
  assert.ok(out);
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
  assert.match(out.hookSpecificOutput.updatedInput.command, /semtrim\.mjs" filter --cmd /);
});

// --- PostToolUse: Claude Bash structured envelope ------------------------

test("claude PostToolUse Bash: emits structured {stdout,stderr,interrupted,isImage}", () => {
  const big = "npm warn deprecated x\n".repeat(50) + "added 1285 packages\nfound 0 vulnerabilities\n";
  const payload = {
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: "npm ci" },
    tool_response: { stdout: big, stderr: "", interrupted: false, isImage: false },
  };
  const out = run(payload, cfg);
  assert.ok(out, "should rewrite");
  const u = out.hookSpecificOutput.updatedToolOutput;
  assert.equal(typeof u, "object", "must be structured object, not bare string");
  assert.equal(typeof u.stdout, "string");
  assert.equal(u.stderr, "");
  assert.equal(u.interrupted, false);
  assert.equal(u.isImage, false);
  assert.ok(u.stdout.length < big.length);
  assert.match(u.stdout, /added 1285 packages/);
});

test("claude PostToolUse Bash: bare-string response stays bare string", () => {
  const big = "npm warn deprecated x\n".repeat(50) + "added 1285 packages\n";
  const payload = {
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: "npm ci" },
    tool_response: big,
  };
  const out = run(payload, cfg);
  assert.ok(out);
  assert.equal(typeof out.hookSpecificOutput.updatedToolOutput, "string");
});

// --- PostToolUse: Codex is a documented no-op ----------------------------

test("codex PostToolUse: never rewrites output (returns null)", () => {
  // A Codex shell PostToolUse payload: bare-string response, shell tool name.
  const payload = {
    hook_event_name: "PostToolUse",
    tool_name: "Shell",
    tool_input: { command: "npm ci" },
    tool_response: "npm warn deprecated x\n".repeat(50),
  };
  assert.equal(run(payload, cfg), null);
});

// --- post.enabled toggle --------------------------------------------------

test("post.enabled = false disables PostToolUse rewriting", () => {
  const off = { ...cfg, post: { enabled: false } };
  const payload = {
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: "npm ci" },
    tool_response: { stdout: "npm warn x\n".repeat(50) + "added 1 packages\n", stderr: "", interrupted: false, isImage: false },
  };
  assert.equal(run(payload, off), null);
});
