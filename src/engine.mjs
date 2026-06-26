// semtrim core engine: adapter selection, dispatch, never-grow safety.
// Pure with respect to I/O — takes a parsed payload + config, returns either an
// output object to print or null (pass through unchanged).

import * as claude from "./adapters/claude.mjs";
import * as codex from "./adapters/codex.mjs";
import * as cursor from "./adapters/cursor.mjs";
import { routeBash } from "./router.mjs";
import { compressFileContent } from "./compressors/_file.mjs";
import { exitSuccess } from "./util/exit-detect.mjs";

const ADAPTERS = [claude, codex, cursor];

export function selectAdapter(payload) {
  for (const a of ADAPTERS) {
    if (a.match(payload)) return a;
  }
  return null;
}

// Our injected markers all start with this token. Re-compressing text that
// already carries one would mangle a prior summary, so we treat marked text as
// already-compressed and return it unchanged (guarantees f(f(x)) == f(x)).
const MARKER = "[semtrim";

// Compute the compressed text for an extracted job. Pure.
export function compress(job, cfg) {
  if (job.text.includes(MARKER)) return job.text;
  if (job.tool === "Read") {
    return compressFileContent(job.text, cfg);
  }
  // Bash
  const success = exitSuccess(job.text, job.structured);
  return routeBash(job.command || "", job.text, { success, cfg });
}

// Returns an output object or null (pass through). Never throws.
export function run(payload, cfg) {
  let adapter;
  try {
    adapter = selectAdapter(payload);
    if (!adapter) return null;
    const job = adapter.extract(payload);
    if (!job || typeof job.text !== "string" || !job.text) return null;

    const newText = compress(job, cfg);
    // Never-grow safety: only rewrite if we actually saved bytes.
    if (typeof newText !== "string" || newText.length >= job.text.length) return null;
    return adapter.emit(job, newText);
  } catch {
    return null;
  }
}
