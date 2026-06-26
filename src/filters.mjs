// Declarative filter definitions, ported faithfully from observed JFrog Boost
// behavior and its embedded test fixtures (see docs/boost-derived-rules.md).
// Each entry is interpreted by src/filter-engine.mjs. Semantics:
//   select = activation gate (only transform recognized output)
//   strip  = drop list (does the reduction)
//   keep   = true allowlist, post-replace (git-status only)
// Adding a family is a data-only change here.

export const FILTERS = {
  npm: {
    name: "npm",
    select: [/(?:^|\s)npm (warn|notice|err)/i, /^> \S+@\S+/, /^added \d+ packages/, /(?:^|\s)npm error/i],
    strip: [/^\s*$/, /^> \S+@\S+/, /^npm warn/i, /^npm notice/i],
  },

  pnpm: {
    name: "pnpm",
    select: [/^Progress: resolved/i, /^dependencies:/, /^Packages: [+-]/, /Already up to date/],
    strip: [/^\s*$/, /^Progress: resolved/i, /^Downloading /i, /^[\u2500-\u257F\s]+$/],
  },

  pip: {
    name: "pip",
    select: [/Successfully installed/, /Requirement already satisfied/, /^Collecting /, /^Package\s+Version/, /^-+ +-+/],
    strip: [/^\s*$/, /^\s*Collecting /i, /^\s*Downloading /i, /^\s*Using cached /i, /^[- ]+$/],
  },

  "docker-build": {
    name: "docker-build",
    select: [/^#\d+ \[/, /naming to /, /exporting to image/, /ERROR: failed to solve/],
    replace: [{ pattern: /@sha256:[0-9a-f]+/g, replacement: "" }],
    strip: [/^\s*$/, /\[internal\]/, /transferring/, /^#\d+ DONE /, /^#\d+ \d+\.\d+ /, /exporting layers/, /writing image/, /exporting manifest/, /^#\d+ extracting /, /^#\d+ resolve /],
  },

  "docker-ps": {
    name: "docker-ps",
    select: [/^CONTAINER ID\s+IMAGE/],
    strip: [/^\s*$/],
    maxLines: 40,
  },

  go: {
    name: "go",
    select: [/^=== RUN /, /^--- FAIL: /, /^--- PASS: /, /^ok \s*\S/, /^FAIL\b/, /^\?\s+\S+\s+\[no test files\]/],
    strip: [/^=== RUN /, /^=== CONT /, /^=== PAUSE /, /^=== NAME /, /^\s*--- PASS: /, /^ok \s+\S/, /^PASS$/, /^\?\s+\S+\s+\[no test files\]/],
    onEmpty: "ok",
  },

  cargo: {
    name: "cargo",
    select: [/^\s*Compiling \S+ v/, /^\s*Checking \S+ v/, /^\s*Finished /, /^error\[E\d/, /^error: could not compile/, /^test result: /, /^running \d+ tests?/],
    strip: [/^\s*$/, /^\s*Compiling /, /^\s*Checking /, /^\s*Downloading /, /^\s*Downloaded /, /^\s*Updating /, /^\s*Blocking /, /^\s*Installing /, /^\s*Running /, /^running \d+ tests?$/, /^test .* \.\.\. ok$/, /^test .* \.\.\. ignored/],
  },

  tsc: {
    name: "tsc",
    select: [/\(\d+,\d+\): error TS\d/, /\(\d+,\d+\): warning TS\d/, /^Found \d+ error/],
    strip: [/^\s*$/],
    onEmpty: "tsc: ok",
  },

  next: {
    name: "next",
    select: [/Creating an optimized production build/, /Compiled successfully/, /Route \(app\)/, /First Load JS/, /Failed to compile/],
    strip: [/^\s*$/, /Next\.js/, /Creating an optimized production build/, /Compiled successfully/, /Linting and checking validity of types/, /Collecting page data/, /Generating static pages/, /Finalizing page optimization/, /Collecting build traces/],
    onEmpty: "next: ok",
  },

  vitest: {
    name: "vitest",
    select: [/RUN\s+v\d/, /Test Files\s+\d/, /^\s*Tests\s+\d/, /\u276f \S/, /^\s*FAIL /],
    strip: [/^\s*$/, /^\s*\u2713/, /^\s*RUN\s+v/, /^\s*Start at /],
    onEmpty: "vitest: ok",
  },

  jest: {
    name: "jest",
    select: [/^Test Suites:/, /^Tests:/, /\u2715|\u2717|\u00d7/, /\u25cf/, /^\s*FAIL /, /Expected|Received/],
    strip: [/^\s*$/, /^\s*\u2713 /, /^\s*\u221a /, /^PASS /],
    onEmpty: "jest: ok",
  },

  pytest: {
    name: "pytest",
    select: [/test session starts/, /^FAILED /, /^ERROR /, / passed/, / failed/],
    strip: [/test session starts/, /^platform /, /^rootdir:/, /^plugins:/, /^cachedir:/, /^configfile:/, /^collected \d+ item/, /\[\s*\d+%\]$/],
  },

  "git-status": {
    name: "git-status",
    select: [/^On branch /, /^HEAD detached/, /^Changes to be committed:/, /^Changes not staged for commit:/, /^Untracked files:/, /^\s*(?:both )?modified:/, /^\s*deleted:/, /^\s*new file:/, /^nothing to commit/],
    onEmpty: "working tree clean",
    replace: [
      { pattern: /^\s*both modified:\s+(.*)$/, replacement: "U $1" },
      { pattern: /^\s*modified:\s+(.*)$/, replacement: "M $1" },
      { pattern: /^\s*deleted:\s+(.*)$/, replacement: "D $1" },
      { pattern: /^\s*new file:\s+(.*)$/, replacement: "N $1" },
      { pattern: /^\s*renamed:\s+(.*)$/, replacement: "R $1" },
      { pattern: /^\s*copied:\s+(.*)$/, replacement: "C $1" },
      { pattern: /^\s*typechange:\s+(.*)$/, replacement: "T $1" },
      { pattern: /^[ \t]+([^(\s].*)$/, replacement: "? $1" },
    ],
    keep: [/^[MDNRCTU?] \S/],
  },

  "git-push": {
    name: "git-push",
    select: [/^To \S+$/, /^\s*\* \[new branch\]/, /^\s*! \[rejected\]/, /^\s*[0-9a-f]+\.\.[0-9a-f]+\s+\S+ -> \S+/, /^Everything up-to-date/, /set up to track/],
    replace: [{ pattern: /[ \t]+$/, replacement: "" }],
    strip: [/^\s*$/, /^remote:\s*$/, /^Enumerating objects:/, /^Counting objects:/, /^Delta compression /, /^Compressing objects:/, /^Writing objects:/, /^Total \d/, /^remote: Resolving deltas:/, /^remote:.*create a (pull|merge) request/i, /^remote:.*\bvulnerabilit/i, /^remote:.*to find out more/i, /^remote:.*\bdependabot\b/i, /^remote:\s+https?:\/\/\S+/],
    onEmpty: "push complete",
  },

  eslint: {
    name: "eslint",
    select: [/^\s*\d+:\d+\s+(error|warning)\s/, /\d+ problem/, /\d+ problems? \(\d+ error/],
    strip: [/^\s*$/],
    onEmpty: "eslint: ok",
  },

  ruff: {
    name: "ruff",
    select: [/:\d+:\d+: [A-Z]\d/, /^Found \d+ error/, /All checks passed/, /files? reformatted/, /left unchanged/],
    strip: [/^\s*$/],
    onEmpty: "ruff: ok",
  },

  mypy: {
    name: "mypy",
    select: [/: error: /, /: note: /, /^Found \d+ error/, /^Success: no issues/],
    strip: [/^\s*$/],
    onEmpty: "mypy: ok",
  },

  "golangci-lint": {
    name: "golangci-lint",
    select: [/\.go:\d+:\d+: /],
    strip: [/^\s*$/, /^level=/],
    onEmpty: "golangci-lint: ok",
  },

  gcc: {
    name: "gcc",
    strip: [/^\s*$/, /^\s+\|\s*$/, /^In file included from/, /^\s+from\s/, /^\d+ warnings? generated/, /^\d+ errors? generated/],
    maxLines: 50,
    onEmpty: "gcc: ok",
  },

  prettier: {
    name: "prettier",
    select: [/^\[warn\] /, /^\[error\] /, /Code style issues found/, /All matched files use Prettier/],
    strip: [/^\s*$/, /^Checking formatting\.\.\./],
    onEmpty: "prettier: ok",
  },

  black: {
    name: "black",
    select: [/^would reformat /, /would be reformatted/, /file\(s\)? reformatted/, /left unchanged/, /^Oh no!/],
    strip: [/^\s*$/, /^All done!/, /^Oh no!/],
    onEmpty: "black: ok",
  },

  rubocop: {
    name: "rubocop",
    select: [/\d+ files? inspected/, /^Offenses:/, /offenses? detected/],
    strip: [/^\s*$/, /^Inspecting \d+ file/, /^[.CWEF]+$/],
  },

  rspec: {
    name: "rspec",
    select: [/\d+ examples?, \d+ failures?/, /^Failures:/, /^Failed examples:/],
    strip: [/^\s*$/, /^Running via spring/i, /^Finished in /, /^DEPRECATION WARNING:/, /^[.F*]+$/],
  },

  biome: {
    name: "biome",
    strip: [/^\s*$/, /^Checked \d+ file/, /^Fixed \d+ file/, /^The following command/, /^Run it with/],
    maxLines: 50,
    onEmpty: "biome: ok",
  },

  turbo: {
    name: "turbo",
    strip: [/^\s*$/, /^\s*cache (hit|miss|bypass)/, /^\s*\d+ packages in scope/, /^\s*Tasks:\s+\d+/, /^\s*Duration:\s+/, /^\s*Remote caching (enabled|disabled)/],
    truncateLinesAt: 150,
    maxLines: 50,
    onEmpty: "turbo: ok",
  },

  nx: {
    name: "nx",
    strip: [/^\s*$/, /^\s*>\s*NX\s+Running target/, /^\s*>\s*NX\s+Nx read the output/, /^\s*>\s*NX\s+View logs/, /Nx \(powered by/],
    truncateLinesAt: 150,
    maxLines: 60,
    onEmpty: "nx: ok",
  },
};
