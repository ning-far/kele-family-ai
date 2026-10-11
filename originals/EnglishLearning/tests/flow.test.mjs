import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAttempt, pickPraise, PRAISE, pronunciationHint, spellOut, phraseIPA } from "../src/modules/flow.js";

test("pronunciationHint shows IPA when available", () => {
  assert.equal(pronunciationHint("green"), "/ɡriːn/");
  assert.equal(pronunciationHint("cat"), "/kæt/");
});

test("pronunciationHint falls back to spelled letters for unknown words", () => {
  assert.equal(pronunciationHint("zzzz"), "Z - Z - Z - Z");
});

test("spellOut splits a word into hyphenated letters", () => {
  assert.equal(spellOut("cat"), "C - A - T");
});

test("phraseIPA joins known word IPAs in a phrase", () => {
  assert.ok(phraseIPA("I see a red cat").includes("/kæt/"));
  assert.ok(phraseIPA("Dream of the red chamber").includes("/red/"));
});

test("classifyAttempt: correct always wins", () => {
  assert.equal(classifyAttempt({ correct: true, attemptsUsed: 1, maxAttempts: 2 }), "correct");
  assert.equal(classifyAttempt({ correct: true, attemptsUsed: 5, maxAttempts: 2 }), "correct");
});

test("classifyAttempt: wrong then retry then reveal", () => {
  assert.equal(classifyAttempt({ correct: false, attemptsUsed: 1, maxAttempts: 2 }), "retry");
  assert.equal(classifyAttempt({ correct: false, attemptsUsed: 2, maxAttempts: 2 }), "reveal");
  // attemptsUsed beyond max still reveals (never loops forever)
  assert.equal(classifyAttempt({ correct: false, attemptsUsed: 9, maxAttempts: 2 }), "reveal");
});

test("pickPraise returns a known praise word", () => {
  for (let i = 0; i < 50; i++) {
    assert.ok(PRAISE.includes(pickPraise()));
  }
});
