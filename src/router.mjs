// Detect the salient program from a shell command string, then route to a
// compressor. Pure and dependency-free.

import { lookupCompressor } from "./registry.mjs";
import { compressGeneric } from "./compressors/_generic.mjs";

const ENV_ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;
const RUNNERS = new Set(["npx", "pnpm", "yarn", "bun", "bunx", "poetry", "uv", "pipenv", "deno"]);
const PYTHON = new Set(["python", "python3", "py"]);

function basename(tok) {
  const noQuote = tok.replace(/^['"]|['"]$/g, "");
  const slash = noQuote.lastIndexOf("/");
  return slash >= 0 ? noQuote.slice(slash + 1) : noQuote;
}

// Split into program-led segments on shell operators / newlines; return the
// last meaningful segment's tokens (the command whose output we actually see).
function lastSegment(cmd) {
  const parts = String(cmd ?? "").split(/[\n\r]|&&|\|\||;|\||&/);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const toks = tokenize(parts[i]);
    if (toks.length) return toks;
  }
  return [];
}

function tokenize(seg) {
  return String(seg ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Resolve argv to a canonical [program, ...rest], unwrapping env assignments,
// runner prefixes (npx/pnpm/yarn/bun/poetry/uv), and `python -m <mod>`.
export function resolveArgv(tokens) {
  let toks = [...tokens];
  // strip leading VAR=val assignments
  while (toks.length && ENV_ASSIGN_RE.test(toks[0])) toks = toks.slice(1);
  if (!toks.length) return [];

  let prog = basename(toks[0]);

  // python -m <module>  ->  module is the program (pytest, etc.)
  if (PYTHON.has(prog)) {
    const mi = toks.indexOf("-m");
    if (mi >= 0 && toks[mi + 1]) {
      return [basename(toks[mi + 1]), ...toks.slice(mi + 2)];
    }
    return [prog, ...toks.slice(1)];
  }

  // runner wrappers: the next non-flag token is the real program, EXCEPT for
  // package-manager subcommands we want to keep (npm/pnpm/yarn/bun install|ci).
  if (RUNNERS.has(prog)) {
    let rest = toks.slice(1);
    // skip a leading "run" verb (poetry run / uv run / pnpm run handled below)
    if (rest[0] === "run" && prog !== "pnpm" && prog !== "yarn" && prog !== "bun") {
      rest = rest.slice(1);
    }
    const sub = rest.find((t) => !t.startsWith("-"));
    // pnpm/yarn/bun acting as package managers (install/ci/add) stay themselves.
    if ((prog === "pnpm" || prog === "yarn" || prog === "bun") &&
        ["install", "i", "ci", "add", "remove"].includes(sub)) {
      return [prog, ...rest];
    }
    if (sub) return [basename(sub), ...rest.slice(rest.indexOf(sub) + 1)];
    return [prog, ...rest];
  }

  // npm run <script> -> still npm (script output is arbitrary; npm compressor
  // only acts on install/ci, generic otherwise).
  return [prog, ...toks.slice(1)];
}

// Returns { prog, argv } for a Bash command, or null if undetectable.
export function detectProgram(command) {
  const seg = lastSegment(command);
  if (!seg.length) return null;
  const argv = resolveArgv(seg);
  if (!argv.length) return null;
  return { prog: argv[0], argv };
}

// Pick and run a compressor for a Bash command. Always returns a string.
export function routeBash(command, text, { success, cfg }) {
  if (cfg.genericOnly) return compressGeneric(text, cfg);
  const detected = detectProgram(command);
  if (detected) {
    const entry = lookupCompressor(detected.prog);
    if (entry && cfg.compressors[entry.key] !== false) {
      try {
        return entry.fn(text, { argv: detected.argv, success, cfg });
      } catch {
        return compressGeneric(text, cfg);
      }
    }
  }
  return compressGeneric(text, cfg);
}
