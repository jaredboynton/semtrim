// JS bundlers: vite, tsc, webpack. Drops per-module "transforming"/chunk lines
// on success; keeps the emitted/built summary. Errors -> generic fallback.

import { compressGeneric } from "./_generic.mjs";

const NOISE_RE = /^(transforming \(|rendering chunks|computing gzip|\s*\.\/src|vite v[\d.]+ building)/i;
const KEEP_RE = /(built in|modules transformed|✓|dist\/|chunk|compiled successfully|webpack compiled|Compilation complete|emitted)/i;
const ERROR_RE = /\b(error|TS\d+:|failed|cannot find|Module not found|SyntaxError)\b/i;

export function compressBundler(text, ctx) {
  if (ctx.success === false || ERROR_RE.test(text)) return compressGeneric(text, ctx.cfg);

  const lines = text.split("\n");
  let transformed = 0;
  const kept = [];
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (/^transforming \(/.test(l)) {
      transformed += 1;
      continue;
    }
    if (NOISE_RE.test(l)) continue;
    if (KEEP_RE.test(l)) kept.push(line);
  }
  if (!kept.length) return compressGeneric(text, ctx.cfg);
  const summary = transformed ? [`[semtrim] bundler: ${transformed} transform steps`] : [];
  return [...summary, ...kept].join("\n");
}
