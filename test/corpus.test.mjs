import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { FILTERS } from "../src/filters.mjs";
import { applyFilter } from "../src/filter-engine.mjs";
import { cleanTerminalNoise } from "../src/util/ansi.mjs";

// Golden corpus derived from JFrog Boost's embedded input/expected fixtures
// (see docs/boost-derived-rules.md). Each test/corpus/<family>/<n>.input.txt is
// run through FILTERS[<family>] and compared to <n>.expected.txt.
//
// Provenance caveat: the fixtures were recovered by static string-mining of the
// Boost binary; tab-delimited samples (go/docker-ps tabular output) lost their
// tabs during extraction and cannot reproduce the original single-line layout,
// so they are skipped. semtrim's own behavior is also covered by
// test/compressors.test.mjs against hand-written fixtures.

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, "corpus");

// Fixtures corrupted by tab/unicode mangling during binary string-mining
// (lost tabs in tabular output, lost vitest/jest status glyphs).
const SKIP = new Set(["go/1", "go/3", "docker-ps/1", "git-status/2", "vitest/1", "vitest/2"]);

if (existsSync(CORPUS)) {
  for (const family of readdirSync(CORPUS)) {
    const filter = FILTERS[family];
    if (!filter) continue;
    const dir = join(CORPUS, family);
    const inputs = readdirSync(dir).filter((f) => f.endsWith(".input.txt"));
    for (const inFile of inputs) {
      const idx = inFile.replace(".input.txt", "");
      const id = `${family}/${idx}`;
      if (SKIP.has(id)) continue;
      const input = readFileSync(join(dir, inFile), "utf8");
      const expected = readFileSync(join(dir, `${idx}.expected.txt`), "utf8");
      const nameFile = join(dir, `${idx}.name.txt`);
      const name = existsSync(nameFile) ? readFileSync(nameFile, "utf8").trim() : "";

      test(`corpus ${id}: ${name}`, () => {
        // null = activation gate failed -> generic fallback preserves output.
        const out = applyFilter(input, filter) ?? cleanTerminalNoise(input);
        assert.equal(out.trim(), expected.trim());
      });
    }
  }
}
