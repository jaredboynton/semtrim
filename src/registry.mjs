// Map a detected program (and optional subcommand) to a filter key in
// src/filters.mjs. Returns the filter key string or null.

// program -> filter key, or a function(argv) -> key for subcommand routing.
const TABLE = {
  npm: () => "npm",
  pnpm: (argv) => (["install", "i", "add", "list", "ls", "outdated"].includes(argv[1]) ? "pnpm" : "npm"),
  yarn: () => "npm",
  bun: () => "npm",

  pip: () => "pip",
  pip3: () => "pip",

  docker: (argv) => {
    const sub = argv[1];
    if (sub === "build" || sub === "buildx") return "docker-build";
    if (sub === "ps") return "docker-ps";
    if (sub === "images") return "docker-ps";
    return null;
  },

  go: (argv) => (["build", "vet", "test"].includes(argv[1]) ? "go" : null),
  cargo: (argv) => (["build", "check", "clippy", "test", "install"].includes(argv[1]) ? "cargo" : null),

  tsc: () => "tsc",
  next: (argv) => (argv[1] === "build" ? "next" : null),
  vite: () => "vitest", // vite build shares vitest-style noise; close enough
  vitest: () => "vitest",
  jest: () => "jest",
  pytest: () => "pytest",
  rspec: () => "rspec",

  git: (argv) => {
    if (argv[1] === "status") return "git-status";
    if (argv[1] === "push") return "git-push";
    return null;
  },

  eslint: () => "eslint",
  oxlint: () => "eslint",
  ruff: (argv) => (["check", "format"].includes(argv[1]) ? "ruff" : null),
  mypy: () => "mypy",
  "golangci-lint": () => "golangci-lint",
  gcc: () => "gcc",
  "g++": () => "gcc",
  prettier: () => "prettier",
  black: () => "black",
  rubocop: () => "rubocop",
  biome: () => "biome",

  turbo: () => "turbo",
  nx: () => "nx",
};

export function lookupFilterKey(prog, argv) {
  const entry = TABLE[prog];
  if (!entry) return null;
  return typeof entry === "function" ? entry(argv) : entry;
}
