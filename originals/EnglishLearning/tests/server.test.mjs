/**
 * Security regression tests for the static server's path containment.
 * Guards against path-traversal (../) and sibling-prefix bypass.
 * Run with:  node --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isInsideRoot } from "../server.mjs";
import { normalize, join, sep, resolve } from "node:path";

// Use resolve() so ROOT carries the platform's real separators (e.g. "\" on
// Windows), matching how server.mjs builds ROOT from fileURLToPath + resolve.
const ROOT = resolve("/srv/EnglishLearning");

test("allows files inside root", () => {
  assert.equal(isInsideRoot(ROOT, join(ROOT, "index.html")), true);
  assert.equal(isInsideRoot(ROOT, join(ROOT, "src", "app.js")), true);
});

test("allows the root directory itself", () => {
  assert.equal(isInsideRoot(ROOT, ROOT), true);
});

test("blocks simple ../ traversal", () => {
  const evil = normalize(join(ROOT, "..", "..", "etc", "passwd"));
  assert.equal(isInsideRoot(ROOT, evil), false);
});

test("blocks encoded traversal resolved by the server", () => {
  // The server decodes %2e%2e before joining; this replicates the resolved path.
  const evil = normalize(join(ROOT, "..", "secret.txt"));
  assert.equal(isInsideRoot(ROOT, evil), false);
});

test("blocks sibling directory whose name is a prefix of root", () => {
  // Without the sep suffix, ROOT + "X" would wrongly start with ROOT.
  const sibling = ROOT + "X" + sep + "secret.txt";
  assert.equal(isInsideRoot(ROOT, sibling), false);
});
