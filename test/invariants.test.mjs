import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadConfig } from "../src/config.mjs";
import { run, compress, selectAdapter } from "../src/engine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures");
const cfg = loadConfig();

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIX, name, "in.json"), "utf8"));
}

function jobFromFixture(name) {
  const payload = loadFixture(name);
  const adapter = selectAdapter(payload);
  assert.ok(adapter, `adapter found for ${name}`);
  return { payload, adapter, job: adapter.extract(payload) };
}

const ALL = readdirSync(FIX, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

// ---------------------------------------------------------------------------
// never-grow: output is always <= input, else pass-through (null)
// ---------------------------------------------------------------------------
for (const name of ALL) {
  test(`never-grow: ${name}`, () => {
    const { job } = jobFromFixture(name);
    if (!job) return; // unextractable -> engine passes through
    const out = compress(job, cfg);
    assert.ok(out.length <= job.text.length, `${name}: ${out.length} <= ${job.text.length}`);
  });
}

// ---------------------------------------------------------------------------
// idempotency: compress(compress(x)) == compress(x) for Bash text
// ---------------------------------------------------------------------------
for (const name of ALL) {
  test(`idempotent: ${name}`, () => {
    const { job } = jobFromFixture(name);
    if (!job || job.tool !== "Bash") return;
    const once = compress(job, cfg);
    const twice = compress({ ...job, text: once }, cfg);
    assert.equal(twice, once, `${name} not idempotent`);
  });
}

// ---------------------------------------------------------------------------
// cache-safety: deterministic across runs (byte-identical)
// ---------------------------------------------------------------------------
for (const name of ALL) {
  test(`deterministic: ${name}`, () => {
    const a = jobFromFixture(name).job;
    const b = jobFromFixture(name).job;
    if (!a || !b) return;
    assert.equal(compress(a, cfg), compress(b, cfg));
  });
}

// ---------------------------------------------------------------------------
// no volatile tokens injected (timestamps etc.) — our markers are static
// ---------------------------------------------------------------------------
for (const name of ALL) {
  test(`no volatile markers: ${name}`, () => {
    const { job } = jobFromFixture(name);
    if (!job) return;
    const out = compress(job, cfg);
    // ISO timestamps / epoch-like injected values would break caching; ensure
    // we don't add any beyond what the source already had.
    const added = out.replace(job.text, "");
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(added), "no ISO timestamp injected");
  });
}
