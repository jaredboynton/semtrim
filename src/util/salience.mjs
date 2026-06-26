// Order-preserving, budget-bounded salience filter for noisy command output.
// Keeps high-signal lines (errors, URLs, file:line refs, headers, tables,
// keyword lines) and the head/tail; fills remaining budget with surrounding
// prose; marks dropped runs. Deterministic. Adapted from the unifable
// compress_research_output line-tier design.

const URL_RE = /https?:\/\/[^\s)>\]"'|]+/;
const FILE_REF_RE = /(?:[\w.\-]+\/)*[\w.\-]+\.[A-Za-z]{1,6}:\d+\b/;
const HEADER_RE = /^\s{0,3}#{1,6}\s+\S/;
const TABLE_RE = /^\s*\|.*\|\s*$/;
const KEYWORD_RE = /\b(error|errors|failed|failure|fatal|panic|traceback|exception|warning|warn|cannot|denied|refused|timeout|unable|missing|conflict|recommendation|summary|conclusion|caveat|important)\b/i;

function tier(line, idx, critical) {
  if (critical.has(idx)) return 0;
  if (URL_RE.test(line) || FILE_REF_RE.test(line)) return 0;
  if (KEYWORD_RE.test(line)) return 0;
  if (HEADER_RE.test(line) || TABLE_RE.test(line)) return 1;
  return 2;
}

export function salienceFilter(text, budget) {
  const s = String(text ?? "");
  if (budget <= 0) return "";
  if (s.length <= budget) return s;

  const lines = s.split("\n");
  const n = lines.length;
  const nonEmpty = [];
  for (let i = 0; i < n; i += 1) {
    if (lines[i].trim()) nonEmpty.push(i);
  }
  const critical = new Set([...nonEmpty.slice(0, 4), ...nonEmpty.slice(-10)]);

  const tiers = lines.map((ln, i) => tier(ln, i, critical));
  const keep = new Array(n).fill(false);
  let used = 0;
  for (const want of [0, 1, 2]) {
    for (let i = 0; i < n; i += 1) {
      if (keep[i] || tiers[i] !== want) continue;
      const cost = lines[i].length + 1;
      if (used + cost > budget) {
        if (want === 0) continue; // skip an oversized critical line, keep scanning
        break;
      }
      keep[i] = true;
      used += cost;
    }
    if (want !== 0 && used >= budget) break;
  }

  const out = [];
  let run = 0;
  for (let i = 0; i < n; i += 1) {
    if (keep[i]) {
      if (run) {
        out.push(`[semtrim: ... ${run} lines ...]`);
        run = 0;
      }
      out.push(lines[i]);
    } else {
      run += 1;
    }
  }
  if (run) out.push(`[semtrim: ... ${run} lines ...]`);

  let result = out.join("\n");
  if (result.length > budget) {
    const head = nonEmpty.slice(0, 4).map((i) => lines[i]).join("\n");
    const marker = "\n[semtrim: ... omitted ...]\n";
    const room = budget - head.length - marker.length;
    result = room > 0
      ? head + marker + result.slice(result.length - room)
      : result.slice(0, Math.max(0, budget - 3)) + "...";
  }
  return result;
}
