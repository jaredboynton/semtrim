#!/usr/bin/env node
// Bump or verify the semtrim version across every manifest in one pass.
//
//   node scripts/bump-version.mjs <X.Y.Z|major|minor|patch>   set all manifests
//   node scripts/bump-version.mjs --check                     CI gate: assert sync
//
// Canonical version source is package.json. The script refuses same-version and
// down-version bumps and hard-verifies no straggler of the old version remains
// in a managed manifest. Zero dependencies (matches the project's no-deps rule).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = "package.json";
const SEMVER = /^\d+\.\d+\.\d+$/;

// Managed manifests. Each carries a JSON "version": "X.Y.Z" field; a missing
// file is skipped so the set stays complete as new host plugins are added.
const TARGETS = [
  "package.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".codex-plugin/plugin.json",
  ".codex-plugin/marketplace.json",
];

const VERSION_FIELD = /("version"\s*:\s*")(\d+\.\d+\.\d+)(")/g;

function die(msg) {
  process.stderr.write(`bump-version: ${msg}\n`);
  process.exit(1);
}

function read(rel) {
  return readFileSync(join(REPO, rel), "utf8");
}

function canonicalVersion() {
  const v = String(JSON.parse(read(CANONICAL)).version || "");
  if (!SEMVER.test(v)) die(`${CANONICAL} has no valid semver (got ${JSON.stringify(v)})`);
  return v;
}

function tuple(v) {
  return v.split(".").map((n) => parseInt(n, 10));
}

function isDowngrade(next, old) {
  const [a, b, c] = tuple(next);
  const [x, y, z] = tuple(old);
  if (a !== x) return a < x;
  if (b !== y) return b < y;
  return c < z;
}

function check() {
  const want = canonicalVersion();
  const bad = [];
  for (const rel of TARGETS) {
    if (!existsSync(join(REPO, rel))) continue;
    const text = read(rel);
    for (const m of text.matchAll(VERSION_FIELD)) {
      if (m[2] !== want) bad.push(`  ${rel}: ${m[2]} (expected ${want})`);
    }
  }
  if (bad.length) {
    die(`version drift detected (canonical ${CANONICAL} = ${want}):\n${bad.join("\n")}`);
  }
  process.stdout.write(`bump-version: all manifests in sync at ${want}\n`);
}

function resolveTarget(arg, old) {
  if (SEMVER.test(arg)) return arg;
  const [maj, min, pat] = tuple(old);
  if (arg === "major") return `${maj + 1}.0.0`;
  if (arg === "minor") return `${maj}.${min + 1}.0`;
  if (arg === "patch") return `${maj}.${min}.${pat + 1}`;
  die(`'${arg}' is not a semver (X.Y.Z) or one of major|minor|patch`);
}

function bump(arg) {
  const old = canonicalVersion();
  const next = resolveTarget(arg, old);
  if (next === old) die(`refused: target ${next} is already the current version`);
  if (isDowngrade(next, old)) die(`refused: downgrades are not allowed (${old} -> ${next})`);

  let total = 0;
  const changed = [];
  for (const rel of TARGETS) {
    const p = join(REPO, rel);
    if (!existsSync(p)) continue;
    const text = read(rel);
    let n = 0;
    const out = text.replace(VERSION_FIELD, (_m, a, _v, c) => {
      n += 1;
      return `${a}${next}${c}`;
    });
    if (n && out !== text) {
      writeFileSync(p, out);
      changed.push(`  ${rel}: ${n} field(s)`);
      total += n;
    }
  }

  if (total === 0) die(`no version fields matched; nothing changed (old=${old})`);

  for (const rel of TARGETS) {
    if (!existsSync(join(REPO, rel))) continue;
    for (const m of read(rel).matchAll(VERSION_FIELD)) {
      if (m[2] !== next) die(`${rel} still has version ${m[2]} (expected ${next})`);
    }
  }

  process.stdout.write(`bump-version: ${old} -> ${next}\n${changed.join("\n")}\n`);
}

const arg = process.argv[2];
if (!arg) die("usage: bump-version.mjs <X.Y.Z|major|minor|patch|--check>");
if (arg === "--check") check();
else bump(arg);
