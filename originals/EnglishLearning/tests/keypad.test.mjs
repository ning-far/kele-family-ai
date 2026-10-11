/**
 * Unit tests for the Keypad: key state, dedupe, listeners, enter combo, appmode.
 * Run with:  node --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypad } from "../src/board/keypad.js";
import { KEY, ENGLISH_MODE } from "../src/board/protocol.js";

test("setKey toggles state and notifies key listeners", () => {
  const k = new Keypad();
  let last = null;
  k.onKey((i, down) => (last = [i, down]));
  k.setKey(KEY.S1, true);
  assert.equal(k.keysDown[KEY.S1], true);
  assert.deepEqual(last, [KEY.S1, true]);
  k.setKey(KEY.S1, false);
  assert.equal(k.keysDown[KEY.S1], false);
});

test("setKey ignores duplicate state (no double fire)", () => {
  const k = new Keypad();
  let calls = 0;
  k.onKey(() => calls++);
  k.setKey(KEY.S3, true);
  k.setKey(KEY.S3, true); // duplicate
  assert.equal(calls, 1);
});

test("S1+S8 fires enter combo on each both-down edge, never while held still", () => {
  const k = new Keypad();
  let comboCount = 0;
  k.onEnterCombo(() => comboCount++);
  // Gesture 1: S1 down, then S8 down -> both down -> fires once.
  k.setKey(KEY.S1, true);
  k.setKey(KEY.S8, true);
  assert.equal(comboCount, 1);
  // While still held, duplicate frames must NOT re-fire.
  k.setKey(KEY.S8, true);
  k.setKey(KEY.S1, true);
  assert.equal(comboCount, 1);
  // Release both, then a fresh both-down edge fires again.
  k.setKey(KEY.S8, false);
  k.setKey(KEY.S1, false);
  k.setKey(KEY.S1, true);
  k.setKey(KEY.S8, true);
  assert.equal(comboCount, 2);
});

test("appmode listener fires and isEnglish reflects it", () => {
  const k = new Keypad();
  let seen = null;
  k.onAppMode((mode) => (seen = mode));
  assert.equal(k.isEnglish(), false);
  k.setAppMode(ENGLISH_MODE);
  assert.equal(seen, ENGLISH_MODE);
  assert.equal(k.isEnglish(), true);
});

test("setAppMode ignores empty / unchanged mode", () => {
  const k = new Keypad();
  let calls = 0;
  k.onAppMode(() => calls++);
  k.setAppMode("");
  k.setAppMode(ENGLISH_MODE);
  k.setAppMode(ENGLISH_MODE); // unchanged
  assert.equal(calls, 1);
});
