import { test } from "node:test";
import assert from "node:assert/strict";

import { redact } from "../src/util/redact.mjs";

test("redact preserves the original separator (: stays :, = stays =)", () => {
  assert.equal(redact("API_TOKEN=abc123def"), "API_TOKEN=[REDACTED]");
  assert.equal(redact("API_TOKEN: abc123def"), "API_TOKEN: [REDACTED]");
  assert.equal(redact("AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI"), "AWS_SECRET_ACCESS_KEY: [REDACTED]");
});

test("redact catches token classes and url creds", () => {
  assert.match(redact("ghp_abcdefghijklmnopqrstuvwxyz0123456789"), /\[REDACTED\]/);
  assert.match(redact("AKIAIOSFODNN7EXAMPLE"), /\[REDACTED\]/);
  assert.equal(redact("Authorization: Bearer xyz.abc.123"), "Authorization: Bearer [REDACTED]");
  assert.equal(
    redact("postgres://user:supersecret@db:5432/app"),
    "postgres://user:[REDACTED]@db:5432/app",
  );
});

test("redact is idempotent", () => {
  const once = redact("DATABASE_URL=postgres://u:p@h/db\nGH_TOKEN: ghp_aaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(redact(once), once);
});

test("redact leaves non-secret text untouched", () => {
  const t = "added 1285 packages\nfound 0 vulnerabilities";
  assert.equal(redact(t), t);
});
