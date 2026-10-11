/**
 * engineConfig 三档引擎（local-base / local-adv / baidu）的持久化与兼容性测试。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// 内存版 localStorage shim（node 无此全局）
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const { getEngine, setEngine, isLocal, getBaiduVoice, setBaiduVoice } = await import(
  "../src/speech/engineConfig.js"
);

test("getEngine 默认/空值/未知值都回退到 local-base", () => {
  mem.clear();
  assert.equal(getEngine(), "local-base");
  mem.set("el_speech_engine", "garbage");
  assert.equal(getEngine(), "local-base");
});

test("getEngine 兼容旧值 'local' → local-base", () => {
  mem.clear();
  mem.set("el_speech_engine", "local");
  assert.equal(getEngine(), "local-base");
});

test("getEngine 正确读回三档值", () => {
  mem.clear();
  mem.set("el_speech_engine", "local-adv");
  assert.equal(getEngine(), "local-adv");
  mem.set("el_speech_engine", "baidu");
  assert.equal(getEngine(), "baidu");
});

test("setEngine 只接受已知值，其余归一为 local-base", () => {
  mem.clear();
  setEngine("local-adv");
  assert.equal(mem.get("el_speech_engine"), "local-adv");
  setEngine("nonsense");
  assert.equal(mem.get("el_speech_engine"), "local-base");
  setEngine("baidu");
  assert.equal(mem.get("el_speech_engine"), "baidu");
});

test("isLocal 区分本地档与百度云", () => {
  assert.equal(isLocal("local-base"), true);
  assert.equal(isLocal("local-adv"), true);
  assert.equal(isLocal("baidu"), false);
});

test("百度 TTS 发音人持久化，默认 0", () => {
  mem.clear();
  assert.equal(getBaiduVoice(), 0);
  setBaiduVoice(4);
  assert.equal(getBaiduVoice(), 4);
});
