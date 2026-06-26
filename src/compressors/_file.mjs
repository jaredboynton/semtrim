// Read tool file-content windower. Line-aware head+tail so structure is kept,
// improving on raw byte slicing. Returns the trimmed content string; the
// adapter rebuilds the Read file{} envelope around it.

export function compressFileContent(content, cfg) {
  const text = String(content ?? "");
  if (text.length <= cfg.thresholdBytes) return text;

  const lines = text.split("\n");
  // Approximate head/tail line counts from byte budgets (~avg line length).
  const avg = Math.max(1, Math.floor(text.length / Math.max(1, lines.length)));
  const headLines = Math.max(1, Math.floor(cfg.headBytes / avg));
  const tailLines = Math.max(1, Math.floor(cfg.tailBytes / avg));
  if (headLines + tailLines >= lines.length) return text;

  const head = lines.slice(0, headLines);
  const tail = lines.slice(lines.length - tailLines);
  const dropped = lines.length - headLines - tailLines;
  return [...head, `[semtrim: trimmed ${dropped} lines from middle]`, ...tail].join("\n");
}
