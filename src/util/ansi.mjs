// ANSI escape and terminal-noise stripping. Pure, deterministic.

const ANSI_CSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const ANSI_OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const ANSI_CHARSET = /\x1b[()][AB012]/g;
const ANSI_SINGLE = /\x1b[=>78Mc]/g;
const CARRIAGE = /\r(?!\n)/g;
const SPINNER = /[\u2800-\u28ff\u2580-\u259f\u25d0-\u25d3\u25cf\u25cb\u23f3\u231b\u2713\u2717\u2714\u2718]/g;
const TRAILING_WS = /[ \t]+$/gm;
const EXTRA_BLANKS = /\n{3,}/g;

export function stripAnsi(s) {
  return String(s ?? "")
    .replace(ANSI_OSC, "")
    .replace(ANSI_CSI, "")
    .replace(ANSI_CHARSET, "")
    .replace(ANSI_SINGLE, "");
}

// Carriage-return progress lines: keep only the final state of each line.
export function collapseCarriageReturns(s) {
  const out = [];
  for (const line of String(s ?? "").split("\n")) {
    if (line.includes("\r")) {
      const segments = line.split("\r");
      out.push(segments[segments.length - 1]);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

export function stripSpinners(s) {
  return String(s ?? "").replace(SPINNER, "");
}

export function tidyWhitespace(s) {
  return String(s ?? "")
    .replace(TRAILING_WS, "")
    .replace(EXTRA_BLANKS, "\n\n");
}

// Full light pass: the always-on, lossless-ish cleanup applied to command output.
export function cleanTerminalNoise(s) {
  let t = collapseCarriageReturns(String(s ?? ""));
  t = stripAnsi(t);
  t = stripSpinners(t);
  t = tidyWhitespace(t);
  return t;
}
