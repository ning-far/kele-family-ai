/**
 * WhisperRecognizer 模型切换与可用性校验的单元测试（不依赖真实麦克风/transformers）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { WhisperRecognizer, MODEL_ID, ADVANCED_MODEL_ID } = await import(
  "../src/speech/whisperRecognizer.js"
);

test("默认模型为标准版 whisper-base", () => {
  const r = new WhisperRecognizer();
  assert.equal(r.modelId, MODEL_ID);
  assert.equal(r.modelId, "whisper-base");
});

test("构造时可指定高级版模型 whisper-small.en", () => {
  const r = new WhisperRecognizer({ modelId: ADVANCED_MODEL_ID });
  assert.equal(r.modelId, "whisper-small.en");
});

test("useModel 切换：更新 modelId、清空管道缓存、作废在途序列", () => {
  const r = new WhisperRecognizer();
  r._pipe = { fake: true };
  r._loadedModelId = "whisper-base";
  const before = r._activeSeq;
  r.useModel(ADVANCED_MODEL_ID);
  assert.equal(r.modelId, "whisper-small.en");
  assert.equal(r._pipe, null);
  assert.equal(r._loadedModelId, null);
  assert.equal(r._activeSeq, before + 1);
});

test("useModel 缺省参数回退到标准版", () => {
  const r = new WhisperRecognizer({ modelId: ADVANCED_MODEL_ID });
  r.useModel();
  assert.equal(r.modelId, MODEL_ID);
});

test("_modelUsable 按模型目录关键文件判断（fetch 打桩）", async () => {
  const origFetch = globalThis.fetch;
  // 只让 whisper-base 的文件齐全（200），其余 404
  globalThis.fetch = async (url) => {
    const ok = String(url).includes("/whisper-base/");
    return { ok, status: ok ? 200 : 404 };
  };
  try {
    const r = new WhisperRecognizer();
    assert.equal(await r._modelUsable("whisper-base"), true);
    assert.equal(await r._modelUsable("whisper-tiny"), false);
    assert.equal(await r._modelUsable("whisper-small.en"), false);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("_recognizeOptions：英文专用模型(.en)不带 language/task，标准模型带", () => {
  const adv = new WhisperRecognizer({ modelId: ADVANCED_MODEL_ID });
  const advOpts = adv._recognizeOptions("en-US");
  assert.equal(advOpts.language, undefined);
  assert.equal(advOpts.task, undefined);
  assert.equal(advOpts.return_timestamps, false);

  const base = new WhisperRecognizer({ modelId: MODEL_ID });
  const baseOpts = base._recognizeOptions("en-US");
  assert.equal(baseOpts.language, "en");
  assert.equal(baseOpts.task, "transcribe");
  assert.equal(baseOpts.return_timestamps, false);
});
