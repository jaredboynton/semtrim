// Load config: bundled defaults merged with optional user override at
// ~/.config/semtrim/config.json (or $SEMTRIM_CONFIG). Never throws.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULTS_PATH = join(HERE, "..", "config", "defaults.json");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function loadConfig() {
  const defaults = readJson(DEFAULTS_PATH) || {};
  const overridePath =
    process.env.SEMTRIM_CONFIG || join(homedir(), ".config", "semtrim", "config.json");
  const override = readJson(overridePath) || {};
  return {
    ...defaults,
    ...override,
    compressors: { ...(defaults.compressors || {}), ...(override.compressors || {}) },
  };
}
