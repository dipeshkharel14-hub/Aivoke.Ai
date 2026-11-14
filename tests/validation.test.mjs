// Run: node --test --experimental-strip-types tests/
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLinkUrl } from "../lib/validation/links.ts";
import { containsProfanity } from "../lib/validation/profanity.ts";
import { safeNext } from "../lib/security/redirect.ts";

test("links: https only, no credentials, no IPs, no shorteners", () => {
  assert.equal(normalizeLinkUrl("https://github.com/aivoke").ok, true);
  for (const bad of ["http://example.com", "javascript:alert(1)", "https://name:secret@localhost", "https://127.0.0.1/x",
    "https://localhost/x", "https://bit.ly/abc", "https://sub.tinyurl.com/x", "example.com", "https://intranet.local/"])
    assert.equal(normalizeLinkUrl(bad).ok, false, bad);
});
test("profanity: catches obfuscation, avoids Scunthorpe cases", () => {
  assert.equal(containsProfanity("f.u.c.k you"), true);
  assert.equal(containsProfanity("Sh1t"), true);
  assert.equal(containsProfanity("Classic assistant"), false);
  assert.equal(containsProfanity("Scunthorpe fan"), false);
  assert.equal(containsProfanity("Dipesh Kharel"), false);
});
test("safeNext blocks open redirects", () => {
  assert.equal(safeNext("/settings/profile"), "/settings/profile");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:1", null, ""]) assert.equal(safeNext(bad), "/");
});
