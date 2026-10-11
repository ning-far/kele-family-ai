/**
 * Unit tests for translation boundary handling.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeTranslation } from "../src/modules/translate.js";

test("keeps a normal short translation", () => {
  const r = sanitizeTranslation("早上好", "Good morning!");
  assert.equal(r, "Good morning!");
});

test("keeps a normal enumeration sentence (not flagged as spam)", () => {
  const dst = "I like apples, I like bananas, I like cherries, I like dates.";
  const r = sanitizeTranslation("我喜欢苹果香蕉樱桃枣", dst);
  assert.equal(r, dst);
});

test("wipes a spammy repeated translation", () => {
  const dst = "Subtitles: Guo Wengui. Subtitles: Guo Wengui. Subtitles: Guo Wengui. Subtitles: Guo Wengui. Subtitles: Guo Wengui.";
  const r = sanitizeTranslation("翻译", dst);
  assert.equal(r, "");
});

test("truncates an overly long translation with an ellipsis", () => {
  // 用大量互不重复的词组成 >120 字符、且不触发灌水判定的长句
  const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  const r = sanitizeTranslation("x", words);
  assert.ok(r.endsWith("…"), "should end with ellipsis");
  assert.ok(r.length <= 121, "should be capped near MAX_TRANSLATION_LEN");
});

test("returns empty for empty input", () => {
  assert.equal(sanitizeTranslation("hi", ""), "");
  assert.equal(sanitizeTranslation("hi", "   "), "");
});
