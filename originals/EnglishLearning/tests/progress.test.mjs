/**
 * Unit tests for progress / module level logic.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getModuleLevel,
  setModuleLevel,
  advanceModuleLevel,
  resetModuleLevel,
} from "../src/content/progress.js";

test("module level defaults to 1", () => {
  assert.equal(getModuleLevel("speak"), 1);
});

test("setModuleLevel clamps to valid range", () => {
  setModuleLevel("speak", 3);
  assert.equal(getModuleLevel("speak"), 3);
  setModuleLevel("speak", 99);
  assert.equal(getModuleLevel("speak"), 5);
  setModuleLevel("speak", 0);
  assert.equal(getModuleLevel("speak"), 1);
  resetModuleLevel("speak");
  assert.equal(getModuleLevel("speak"), 1);
});

test("advanceModuleLevel only upgrades on 2+ stars", () => {
  resetModuleLevel("vocab");
  assert.equal(advanceModuleLevel("vocab", 0), false);
  assert.equal(getModuleLevel("vocab"), 1);
  assert.equal(advanceModuleLevel("vocab", 1), false);
  assert.equal(getModuleLevel("vocab"), 1);
  assert.equal(advanceModuleLevel("vocab", 2), true);
  assert.equal(getModuleLevel("vocab"), 2);
  resetModuleLevel("vocab");
});

test("advanceModuleLevel returns false when already at max level", () => {
  setModuleLevel("vocab", 5);
  assert.equal(advanceModuleLevel("vocab", 3), false);
  assert.equal(getModuleLevel("vocab"), 5);
  resetModuleLevel("vocab");
});
