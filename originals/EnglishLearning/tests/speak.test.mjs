/**
 * Unit tests for Speak module item generation.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLevel1Items, buildLevel2Items, buildLevel3Items } from "../src/modules/speak.js";

test("Level 1 items are single simple words", () => {
  const items = buildLevel1Items();
  assert.ok(items.length > 0, "should have items");
  for (const it of items) {
    assert.equal(it.level, 1);
    assert.ok(!it.text.includes(" "), "level 1 should be a single word, got: " + it.text);
    assert.equal(it.text, it.word);
  }
});

test("Level 2 items are short phrases with spaces", () => {
  const items = buildLevel2Items();
  assert.ok(items.length > 0);
  for (const it of items) {
    assert.equal(it.level, 2);
    assert.ok(it.text.includes(" "), "level 2 should be a phrase, got: " + it.text);
    assert.ok(it.text.length <= 50, "phrase should be short: " + it.text);
  }
});

test("Level 3 items are full sentences", () => {
  const items = buildLevel3Items();
  assert.ok(items.length > 0);
  for (const it of items) {
    assert.equal(it.level, 3);
    assert.ok(it.text.includes(" "), "level 3 should be a sentence, got: " + it.text);
  }
});
