// Budget-bounded truncation helpers. Pure, deterministic.

// Head+tail byte window with a marker for the dropped middle.
export function truncateMiddle(s, { thresholdBytes, headBytes, tailBytes }) {
  const text = String(s ?? "");
  const total = text.length;
  if (total <= thresholdBytes) return text;
  const head = text.slice(0, headBytes);
  const tail = text.slice(total - tailBytes);
  const dropped = total - headBytes - tailBytes;
  return `${head}\n[semtrim: trimmed ${dropped} bytes from middle]\n${tail}`;
}

// Collapse runs of byte-identical consecutive lines into "line  (xN)".
export function dedupeConsecutiveLines(s) {
  const lines = String(s ?? "").split("\n");
  const out = [];
  let prev = null;
  let count = 0;
  const flush = () => {
    if (prev === null) return;
    out.push(count > 1 ? `${prev}  (x${count})` : prev);
  };
  for (const line of lines) {
    if (line === prev) {
      count += 1;
    } else {
      flush();
      prev = line;
      count = 1;
    }
  }
  flush();
  return out.join("\n");
}
