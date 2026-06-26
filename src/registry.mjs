// Map a detected program name to a compressor + config key.

import { compressGh } from "./compressors/gh.mjs";
import { compressDocker } from "./compressors/docker.mjs";
import { compressNpm } from "./compressors/npm.mjs";
import { compressGo } from "./compressors/go.mjs";
import { compressCargo } from "./compressors/cargo.mjs";
import { compressBundler } from "./compressors/bundler.mjs";
import { compressPytest } from "./compressors/pytest.mjs";
import { compressJest } from "./compressors/jest.mjs";
import { compressGit } from "./compressors/git.mjs";
import { compressLint } from "./compressors/lint.mjs";

// program token -> { key, fn }. `key` gates via config.compressors[key].
const TABLE = {
  gh: { key: "gh", fn: compressGh },

  docker: { key: "docker", fn: compressDocker },
  "docker-compose": { key: "docker", fn: compressDocker },

  npm: { key: "npm", fn: compressNpm },
  pnpm: { key: "npm", fn: compressNpm },
  yarn: { key: "npm", fn: compressNpm },
  bun: { key: "npm", fn: compressNpm },

  go: { key: "go", fn: compressGo },
  cargo: { key: "cargo", fn: compressCargo },

  vite: { key: "bundler", fn: compressBundler },
  tsc: { key: "bundler", fn: compressBundler },
  webpack: { key: "bundler", fn: compressBundler },
  rollup: { key: "bundler", fn: compressBundler },
  esbuild: { key: "bundler", fn: compressBundler },

  pytest: { key: "pytest", fn: compressPytest },

  jest: { key: "jest", fn: compressJest },
  vitest: { key: "jest", fn: compressJest },

  git: { key: "git", fn: compressGit },

  eslint: { key: "lint", fn: compressLint },
  ruff: { key: "lint", fn: compressLint },
  mypy: { key: "lint", fn: compressLint },
  pyright: { key: "lint", fn: compressLint },
  flake8: { key: "lint", fn: compressLint },
};

export function lookupCompressor(prog) {
  return TABLE[prog] || null;
}
