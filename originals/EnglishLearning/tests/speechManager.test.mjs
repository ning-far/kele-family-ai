/**
 * SpeechManager 引擎切换时正确把本地模型档位路由给 WhisperRecognizer。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// 内存版 localStorage shim
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const { SpeechManager } = await import("../src/speech/speechManager.js");
const { MODEL_ID, ADVANCED_MODEL_ID } = await import(
  "../src/speech/whisperRecognizer.js"
);

// 用间谍替换本地识别器的 useModel，记录调用
function spyLocalRec(sm) {
  const calls = [];
  sm.localRec.useModel = (id) => calls.push(id);
  return calls;
}

test("setEngine('local-adv') 令本地识别器切换到高级版模型", () => {
  mem.clear();
  const sm = new SpeechManager();
  const calls = spyLocalRec(sm);
  sm.setEngine("local-adv");
  assert.deepEqual(calls, [ADVANCED_MODEL_ID]);
  assert.equal(sm.engine, "local-adv");
});

test("setEngine('local-base') 令本地识别器切换到标准版模型", () => {
  mem.clear();
  const sm = new SpeechManager();
  const calls = spyLocalRec(sm);
  sm.setEngine("local-base");
  assert.deepEqual(calls, [MODEL_ID]);
  assert.equal(sm.engine, "local-base");
});

test("setEngine('baidu') 仍把本地模型设为标准版（仅切 TTS/识别器来源）", () => {
  mem.clear();
  const sm = new SpeechManager();
  const calls = spyLocalRec(sm);
  sm.setEngine("baidu");
  assert.deepEqual(calls, [MODEL_ID]);
  assert.equal(sm.engine, "baidu");
});

test("构造时按已保存引擎初始化本地模型档位", () => {
  mem.clear();
  mem.set("el_speech_engine", "local-adv");
  const sm = new SpeechManager();
  assert.equal(sm.localRec.modelId, ADVANCED_MODEL_ID);
});
