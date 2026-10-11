/**
 * Unit tests for the keyboard simulator KEYMAP (number + home-row layouts).
 * Run with:  node --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { KEYMAP, isTypingTarget } from "../src/board/simulator.js";
import { KEY } from "../src/board/protocol.js";

test("number row 1..8 maps to S1..S8", () => {
  assert.equal(KEYMAP.Digit1, KEY.S1);
  assert.equal(KEYMAP.Digit2, KEY.S2);
  assert.equal(KEYMAP.Digit3, KEY.S3);
  assert.equal(KEYMAP.Digit4, KEY.S4);
  assert.equal(KEYMAP.Digit5, KEY.S5);
  assert.equal(KEYMAP.Digit6, KEY.S6);
  assert.equal(KEYMAP.Digit7, KEY.S7);
  assert.equal(KEYMAP.Digit8, KEY.S8);
});

test("numpad 1..8 also maps to S1..S8 (kids-friendly)", () => {
  assert.equal(KEYMAP.Numpad7, KEY.S7);
  assert.equal(KEYMAP.Numpad8, KEY.S8);
});

test("home row A..K maps to S1..S8", () => {
  assert.equal(KEYMAP.KeyA, KEY.S1);
  assert.equal(KEYMAP.KeyJ, KEY.S7); // S1+S7 enter combo = A + J
  assert.equal(KEYMAP.KeyK, KEY.S8);
});

test("text-entry targets must be ignored by the simulator", () => {
  assert.equal(isTypingTarget({ tagName: "INPUT" }), true);
  assert.equal(isTypingTarget({ tagName: "textarea" }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTypingTarget({ tagName: "DIV" }), false);
  assert.equal(isTypingTarget(null), false);
  assert.equal(isTypingTarget({}), false);
});
