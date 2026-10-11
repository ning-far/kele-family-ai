/**
 * Unit tests for the pronunciation scorer (pure logic, no browser).
 * Run with:  node --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  tokenize,
  sentenceSimilarity,
  containsWord,
  wordMatch,
  scorePronunciation,
} from "../src/speech/scorer.js";

test("normalize strips punctuation and lowercases", () => {
  assert.equal(normalize("  I have an APPLE!!!  "), "i have an apple");
});

test("tokenize splits on whitespace", () => {
  assert.deepEqual(tokenize("The cat is happy"), ["the", "cat", "is", "happy"]);
});

test("sentenceSimilarity is 1 for identical token sequences", () => {
  assert.equal(sentenceSimilarity("I have an apple", "I have an apple"), 1);
});

test("sentenceSimilarity ignores articles", () => {
  const a = sentenceSimilarity("I have apple", "I have an apple");
  assert.ok(a >= 0.9, "articles should not penalise much, got " + a);
});

test("sentenceSimilarity drops for very different sentences", () => {
  const a = sentenceSimilarity("I have an apple", "The dog can run");
  assert.ok(a < 0.4, "should be low, got " + a);
});

test("containsWord finds a whole word", () => {
  assert.ok(containsWord("this is an apple", "apple"));
  assert.ok(!containsWord("I see an apple tree", "app")); // not a whole word
});

test("wordMode scoring: correct word gives high score", () => {
  const r = scorePronunciation({ target: "apple", actual: "apple", wordMode: true, confidence: 0.9 });
  assert.equal(r.correct, true);
  assert.ok(r.score >= 80, "score should be high, got " + r.score);
});

test("wordMode scoring: wrong word gives low score", () => {
  const r = scorePronunciation({ target: "apple", actual: "banana", wordMode: true, confidence: 0.9 });
  assert.equal(r.correct, false);
  assert.ok(r.score < 50, "score should be low, got " + r.score);
});

test("sentence scoring uses confidence when present", () => {
  const r = scorePronunciation({
    target: "I have an apple",
    actual: "I have an apple",
    confidence: 0.95,
  });
  assert.ok(r.score >= 85, "good match + high confidence, got " + r.score);
});

test("sentence scoring: <80 is not OK", () => {
  const r = scorePronunciation({
    target: "I have an apple",
    actual: "i have banana", // partial; low confidence absent
  });
  assert.ok(r.score < 80, "should not pass, got " + r.score);
  assert.equal(r.correct, false);
});

test("score is clamped to 0..100", () => {
  const r = scorePronunciation({ target: "x", actual: "x", confidence: 1 });
  assert.ok(r.score >= 0 && r.score <= 100);
});

/* ---- wordMatch: 针对 ASR 误识的宽松匹配（回归测试） ---- */

test("wordMatch: exact match has distance 0 and is not a fragment", () => {
  const m = wordMatch("pants", "pants");
  assert.equal(m.match, true);
  assert.equal(m.fragment, false);
  assert.equal(m.distance, 0);
});

test("wordMatch: ASR letter substitution still matches (pants -> hands)", () => {
  const m = wordMatch("pants", "hands");
  assert.equal(m.match, true, "Δ=" + m.distance);
});

test("wordMatch: longer ASR confusion matches (orange -> outrage)", () => {
  const m = wordMatch("orange", "outrage");
  assert.equal(m.match, true, "Δ=" + m.distance);
});

test("wordMatch: extra surrounding token is tolerated ('the pants')", () => {
  assert.equal(wordMatch("pants", "the pants").match, true);
});

test("wordMatch: genuinely different word fails (cat vs dog)", () => {
  assert.equal(wordMatch("cat", "dog").match, false);
});

test("wordMatch: 1-char fragment is flagged and not matched", () => {
  const m = wordMatch("pants", "g");
  assert.equal(m.match, false);
  assert.equal(m.fragment, true);
});

test("wordMatch: different short/medium words do NOT match (tolerance upper bound)", () => {
  assert.equal(wordMatch("hand", "hazy").match, false);
  assert.equal(wordMatch("book", "back").match, false);
  assert.equal(wordMatch("apple", "banana").match, false);
});

test("wordMatch: ASR confusion that is too far still fails (cow vs Carl)", () => {
  const m = wordMatch("cow", "Carl");
  assert.equal(m.match, false, "Δ=" + m.distance);
});

test("wordMatch: long word gross mismatch fails (watermelon vs water)", () => {
  assert.equal(wordMatch("watermelon", "water").match, false);
});

test("wordMode: near-miss ASR is counted correct (pants/hands)", () => {
  const r = scorePronunciation({ target: "pants", actual: "hands", wordMode: true, confidence: 0.95 });
  assert.equal(r.correct, true);
  assert.ok(r.score >= 80, "score should be high, got " + r.score);
});

test("wordMode: fragment is flagged and NOT counted correct", () => {
  const r = scorePronunciation({ target: "pants", actual: "g", wordMode: true });
  assert.equal(r.correct, false);
  assert.equal(r.fragment, true);
});
