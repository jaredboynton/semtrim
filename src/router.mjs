// Detect the salient program from a shell command string, then route to a
// declarative filter (src/filters.mjs) via the registry. Falls back to the
// generic compressor. Pure and dependency-free.

import { lookupFilterKey } from "./registry.mjs";
import { FILTERS } from "./filters.mjs";
import { applyFilter } from "./filter-engine.mjs";
import { compressGeneric } from "./compressors/_generic.mjs";

const ENV_ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;
const RUNNERS = new Set(["npx", "pnpm", "yarn", "bun", "bunx", "poetry", "uv", "pipenv", "deno"]);
const PYTHON = new Set(["python", "python3", "py"]);

function basename(tok) {
  const noQuote = tok.replace(/^['"]|['"]$/g, "");
  const slash = noQuote.lastIndexOf("/");
  return slash >= 0 ? noQuote.slice(slash + 1) : noQuote;
}

function tokenize(seg) {
  return String(seg ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function lastSegment(cmd) {
  const parts = String(cmd ?? "").split(/[\n\r]|&&|\|\||;|\||&/);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const toks = tokenize(parts[i]);
    if (toks.length) return toks;
  }
  return [];
}

// Resolve argv to canonical [program, ...rest], unwrapping env assignments,
// runner prefixes, and `python -m <mod>`.
export function resolveArgv(tokens) {
  let toks = [...tokens];
  while (toks.length && ENV_ASSIGN_RE.test(toks[0])) toks = toks.slice(1);
  if (!toks.length) return [];

  let prog = basename(toks[0]);

  if (PYTHON.has(prog)) {
    const mi = toks.indexOf("-m");
    if (mi >= 0 && toks[mi + 1]) return [basename(toks[mi + 1]), ...toks.slice(mi + 2)];
    return [prog, ...toks.slice(1)];
  }

  if (RUNNERS.has(prog)) {
    let rest = toks.slice(1);
    if (rest[0] === "run" && prog !== "pnpm" && prog !== "yarn" && prog !== "bun") {
      rest = rest.slice(1);
    }
    const sub = rest.find((t) => !t.startsWith("-"));
    if ((prog === "pnpm" || prog === "yarn" || prog === "bun") &&
        ["install", "i", "ci", "add", "remove", "list", "ls", "outdated"].includes(sub)) {
      return [prog, ...rest];
    }
    if (sub) return [basename(sub), ...rest.slice(rest.indexOf(sub) + 1)];
    return [prog, ...rest];
  }

  return [prog, ...toks.slice(1)];
}

// Returns { prog, argv } for a Bash command, or null.
export function detectProgram(command) {
  const seg = lastSegment(command);
  if (!seg.length) return null;
  const argv = resolveArgv(seg);
  if (!argv.length) return null;
  return { prog: argv[0], argv };
}

// Pick and run a filter for a Bash command. Always returns a string.
export function routeBash(command, text, { cfg }) {
  if (cfg.genericOnly) return compressGeneric(text, cfg);
  const detected = detectProgram(command);
  if (detected) {
    const key = lookupFilterKey(detected.prog, detected.argv);
    if (key && FILTERS[key] && cfg.filters?.[key] !== false) {
      try {
        const out = applyFilter(text, FILTERS[key]);
        // null  -> activation gate failed (unrecognized output): fall back.
        // string -> filter applied (may be an on_empty summary). Use it; the
        // engine's never-grow guard discards it if it isn't actually smaller.
        if (typeof out === "string") return out;
      } catch {
        /* fall through to generic */
      }
    }
  }
  return compressGeneric(text, cfg);
}
