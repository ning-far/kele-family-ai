/**
 * recognizerRecovery.test.mjs
 *
 * 验证两个 recognizer 在遇到「竞态残留」(上一次录音的 _listening 没正常复位)
 * 时不会冻死：再次 start() 必须先复位旧录音，且返回 true（而非 false）。
 *
 * 不依赖真实麦克风：仅用最小浏览器 API 打桩。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { WhisperRecognizer } from "../src/speech/whisperRecognizer.js";
import { BaiduRecognizer } from "../src/speech/baiduRecognizer.js";

// ---- 最小浏览器打桩（Node 中 navigator/window 是只读 getter，需用 defineProperty）----
function installBrowserStubs() {
  const saved = {};
  const set = (k, v) => {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v });
  };
  set("window", { isSecureContext: true, AudioContext: function () {} });
  set("navigator", {
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    },
  });
  set(
    "MediaRecorder",
    class {
      constructor() {}
      static isTypeSupported() {
        return false;
      }
      start() {}
      stop() {}
    }
  );
  return () => {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  };
}

test("Whisper: _listening 残留时再次 start 先复位且不返回 false", () => {
  const restore = installBrowserStubs();
  try {
    const r = new WhisperRecognizer();
    // 模拟竞态：上一次录音没正常结束，残留 _listening=true 与一个未停的 rec
    let oldStopped = false;
    r._listening = true;
    r._rec = { stop: () => { oldStopped = true; } };
    r._stream = { getTracks: () => [{ stop() {} }] };

    const ok = r.start({ onStart() {} });
    assert.equal(ok, true, "不应返回 false，否则上层会误判失败而冻死");
    assert.equal(oldStopped, true, "必须先复位旧录音");
  } finally {
    restore();
  }
});

test("Whisper: 被新一轮 start 顶替的迟到 getUserMedia 不应残留录音", async () => {
  const restore = installBrowserStubs();
  try {
    const resolvers = [];
    globalThis.navigator.mediaDevices.getUserMedia = () =>
      new Promise((res) => resolvers.push(res));
    const r = new WhisperRecognizer();
    r.start({ onStart() {} }); // 轮 A -> resolvers[0]
    r.start({ onStart() {} }); // 轮 B 顶替 -> resolvers[1]
    // 轮 A 的 getUserMedia 迟到才返回（已被轮 B 顶替，应被丢弃）
    resolvers[0]({ getTracks: () => [{ stop() {} }] });
    await new Promise((res) => setTimeout(res, 0));
    assert.equal(r._listening, false, "迟到的轮 A 采集必须被丢弃，不能残留");
    assert.equal(r._pending, true, "轮 B 仍在途");
  } finally {
    restore();
  }
});

test("Baidu: _listening 残留时再次 start 先复位且不返回 false", () => {
  const restore = installBrowserStubs();
  try {
    const r = new BaiduRecognizer();
    let oldStopped = false;
    r._listening = true; // 模拟竞态残留
    r._rec = { stop: () => { oldStopped = true; } };
    r._stream = { getTracks: () => [{ stop() {} }] };

    const ok = r.start({ onStart() {} });
    assert.equal(ok, true, "不应返回 false，否则上层会误判失败而冻死");
    assert.equal(oldStopped, true, "必须先复位旧录音");
  } finally {
    restore();
  }
});

test("Baidu: 被新一轮 start 顶替的迟到 getUserMedia 不应残留录音", async () => {
  const restore = installBrowserStubs();
  try {
    const resolvers = [];
    globalThis.navigator.mediaDevices.getUserMedia = () =>
      new Promise((res) => resolvers.push(res));
    const r = new BaiduRecognizer();
    r.start({ onStart() {} }); // 轮 A -> resolvers[0]
    r.start({ onStart() {} }); // 轮 B 顶替 -> resolvers[1]
    // 轮 A 的 getUserMedia 迟到才返回（已被轮 B 顶替，应被丢弃）
    resolvers[0]({ getTracks: () => [{ stop() {} }] });
    await new Promise((res) => setTimeout(res, 0));
    assert.equal(r._listening, false, "迟到的轮 A 采集必须被丢弃，不能残留");
    assert.equal(r._pending, true, "轮 B 仍在途");
  } finally {
    restore();
  }
});

test("Baidu: pending-stop 残留不会错配到新一轮", async () => {
  const restore = installBrowserStubs();
  try {
    let resolveA = null;
    globalThis.navigator.mediaDevices.getUserMedia = () =>
      new Promise((res) => (resolveA = res));
    const r = new BaiduRecognizer();
    let onEndCalls = 0;
    r.start({ onStart() {} }); // 轮 A，getUM 卡住
    r.stop({ onEnd: () => { onEndCalls++; } }); // 在途期间 stop -> pending
    assert.equal(r._wantStop, true, "应进入 pending-stop");
    r.start({ onStart() {} }); // 轮 B：应清除上一轮 pending-stop
    assert.equal(r._wantStop, false, "新一轮应清除残留 pending-stop");
    resolveA({ getTracks: () => [{ stop() {} }] }); // 轮 A/B 的 getUM 同时 resolve
    await new Promise((res) => setTimeout(res, 0));
    assert.equal(r._listening, true, "轮 B 应正常开始录音，不被旧 pending-stop 误停");
    assert.equal(onEndCalls, 0, "本轮未结束，不应有 onEnd");
  } finally {
    restore();
  }
});

test("Whisper: pending-stop 残留不会错配到新一轮", async () => {
  const restore = installBrowserStubs();
  try {
    let resolveA = null;
    globalThis.navigator.mediaDevices.getUserMedia = () =>
      new Promise((res) => (resolveA = res));
    const r = new WhisperRecognizer();
    let onEndCalls = 0;
    r.start({ onStart() {} });
    r.stop({ onEnd: () => { onEndCalls++; } });
    assert.equal(r._wantStop, true, "应进入 pending-stop");
    r.start({ onStart() {} });
    assert.equal(r._wantStop, false, "新一轮应清除残留 pending-stop");
    resolveA({ getTracks: () => [{ stop() {} }] });
    await new Promise((res) => setTimeout(res, 0));
    assert.equal(r._listening, true, "轮 B 应正常开始录音，不被旧 pending-stop 误停");
    assert.equal(onEndCalls, 0, "本轮未结束，不应有 onEnd");
  } finally {
    restore();
  }
});

test("Baidu: 同一轮在途 stop → gUM resolve 后立即停（不留 _listening）", async () => {
  const restore = installBrowserStubs();
  try {
    const resolvers = [];
    globalThis.navigator.mediaDevices.getUserMedia = () =>
      new Promise((res) => resolvers.push(res));
    const r = new BaiduRecognizer();
    r.start({ onStart() {} });
    r.stop({ onEnd() {}, onResult() {} }); // 在途 stop -> pending
    assert.equal(r._wantStop, true, "应进入 pending-stop");
    resolvers[0]({ getTracks: () => [{ stop() {} }] }); // gUM resolve
    await new Promise((res) => setTimeout(res, 0));
    assert.equal(r._listening, false, "录音应已立即停止，不能残留 _listening");
  } finally {
    restore();
  }
});

test("Whisper: 同一轮在途 stop → gUM resolve 后立即停（不留 _listening）", async () => {
  const restore = installBrowserStubs();
  try {
    const resolvers = [];
    globalThis.navigator.mediaDevices.getUserMedia = () =>
      new Promise((res) => resolvers.push(res));
    const r = new WhisperRecognizer();
    r.start({ onStart() {} });
    r.stop({ onEnd() {}, onResult() {} });
    assert.equal(r._wantStop, true, "应进入 pending-stop");
    resolvers[0]({ getTracks: () => [{ stop() {} }] });
    await new Promise((res) => setTimeout(res, 0));
    assert.equal(r._listening, false, "录音应已立即停止，不能残留 _listening");
  } finally {
    restore();
  }
});
