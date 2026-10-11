import { test } from "node:test";
import assert from "node:assert/strict";
import { Recorder } from "../src/speech/recorder.js";

/**
 * A controllable fake Recognizer implementing the same start/abort surface the
 * Recorder expects, so we can drive onResult / onNoResult deterministically.
 */
function fakeRecognizer() {
  return {
    listening: false,
    _opts: null,
    start(opts) {
      this.listening = true;
      this._opts = opts;
      return true;
    },
    abort() {
      this.listening = false;
      this._opts?.onEnd?.();
    },
    stop() {
      this.listening = false;
      this._opts?.onEnd?.();
    },
  };
}

test("toggle starts a session and reports state", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r);
  let state = null;
  rec.toggle("en-US", { onState: (s) => (state = s) });
  assert.equal(state, true);
  assert.equal(r.listening, true);
  rec.stop();
  assert.equal(state, false);
});

test("a captured result fires onResult and NOT onNoResult", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r);
  let result = null;
  let noResult = 0;
  rec.toggle("en-US", { onResult: (res) => (result = res), onNoResult: () => noResult++ });
  r._opts.onResult({ transcript: "apple", confidence: 0.9 });
  assert.deepEqual(result, { transcript: "apple", confidence: 0.9 });
  assert.equal(noResult, 0);
  assert.equal(rec.recording, false);
});

test("pressing again STOPS (does not start a new session) and yields onNoResult", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r);
  let noResult = 0;
  let starts = 0;
  const origStart = r.start.bind(r);
  r.start = (opts) => {
    starts++;
    return origStart(opts);
  };
  rec.toggle("en-US", { onNoResult: () => noResult++ });
  // Second press while recording -> finalize (abort -> onEnd -> onNoResult).
  rec.toggle("en-US", {});
  assert.equal(noResult, 1);
  assert.equal(starts, 1); // only the first press started a session
  assert.equal(rec.recording, false);
});

test("ending with no transcript fires onNoResult (silent-dead-end fix)", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r);
  let noResult = 0;
  let result = null;
  rec.toggle("en-US", { onResult: (res) => (result = res), onNoResult: () => noResult++ });
  rec.stop();
  assert.equal(noResult, 1);
  assert.equal(result, null);
});

test("non-aborted errors fire onError with the reason", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r);
  let err = null;
  rec.toggle("en-US", { onError: (e) => (err = e) });
  r._opts.onError("not-allowed");
  assert.equal(err, "not-allowed");
});

test("'no-speech' and 'aborted' are treated as no-result, not onError", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r);
  let noResult = 0;
  let err = 0;
  rec.toggle("en-US", { onNoResult: () => noResult++, onError: () => err++ });
  r._opts.onError("no-speech");
  r._opts.onError("aborted");
  rec.stop();
  assert.equal(noResult, 1);
  assert.equal(err, 0);
});

test("interim transcript is forwarded to onInterim", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r);
  let interim = null;
  rec.toggle("en-US", { onInterim: (t) => (interim = t) });
  r._opts.onInterim?.("hel");
  assert.equal(interim, "hel");
  rec.stop();
});

test("a non-fatal error clears the auto-stop timer", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r, { maxDurationMs: 100000 });
  rec.toggle("en-US", { onError: () => {} });
  r._opts.onError("not-allowed");
  assert.equal(rec._timer, null);
});

test("after a result, a new question can start a fresh session", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r);
  let starts = 0;
  const origStart = r.start.bind(r);
  r.start = (opts) => {
    starts++;
    return origStart(opts);
  };
  rec.toggle("en-US", { onResult: () => {} });
  r._opts.onResult({ transcript: "apple" });
  assert.equal(rec._done, true);
  // Simulate next question's press.
  rec.toggle("en-US", { onResult: () => {} });
  assert.equal(starts, 2);
});

test("stale onEnd from a previous round is ignored (no cross-talk / freeze)", () => {
  // 复现真实 bug：上一轮的 onEnd 在新一轮开始后才到达，不应把新一轮误判为「无结果」。
  const stopCalls = [];
  const fake = {
    start(opts) {
      opts.onStart?.();
      return true;
    },
    stop(cbs) {
      stopCalls.push(cbs); // 不直接回调，由测试手动触发
    },
    abort() {},
  };
  const rec = new Recorder(fake);
  const ev1 = [];
  const ev2 = [];
  rec.start("en-US", {
    onState() {},
    onResult: (r) => ev1.push(["r", r]),
    onNoResult: () => ev1.push(["nr"]),
    onError: (e) => ev1.push(["e", e]),
  });
  rec.release(); // 触发第一轮 stop，回调被存进 stopCalls[0]
  rec.start("en-US", {
    onState() {},
    onResult: (r) => ev2.push(["r", r]),
    onNoResult: () => ev2.push(["nr"]),
    onError: (e) => ev2.push(["e", e]),
  });
  rec.release(); // 触发第二轮 stop，回调被存进 stopCalls[1]
  // 第一轮的 onEnd 现在才迟到 -> 必须被忽略（seq 不匹配）
  stopCalls[0]?.onEnd?.();
  assert.equal(ev1.length, 0, "旧轮不应产生结果");
  assert.equal(ev2.length, 0, "新一轮尚未结算");
  // 第二轮的 onEnd 到达 -> 才生效
  stopCalls[1]?.onEnd?.();
  assert.equal(ev2.length, 1);
  assert.deepEqual(ev2[0], ["nr"]);
});

test("repeated start() without release returns false (not a new session)", () => {
  const r = fakeRecognizer();
  const rec = new Recorder(r);
  rec.start("en-US", { onState() {} });
  assert.equal(rec.start("en-US", { onState() {} }), false);
});

test("start() throwing synchronously still emits onState(false) and resets", () => {
  const r = fakeRecognizer();
  r.start = () => {
    throw new Error("boom");
  };
  const rec = new Recorder(r);
  let state = null;
  rec.start("en-US", { onState: (s) => (state = s) });
  assert.equal(state, false, "onState(false) 必须发出，否则录音态卡住");
  assert.equal(rec.recording, false, "recording 必须复位");
});

test("stale onInterim from a previous round is not forwarded to the new round", () => {
  // 旧轮迟到的中间文本不得写进新一轮 UI（否则按钮文案被旧文本覆盖且无人复位）。
  const stopCalls = [];
  const startOpts = [];
  const fake = {
    start(opts) {
      startOpts.push(opts);
      opts.onStart?.();
      return true;
    },
    stop(cbs) {
      stopCalls.push(cbs); // 不直接回调，由测试手动触发
    },
    abort() {},
  };
  const rec = new Recorder(fake);
  const seen = [];
  rec.start("en-US", { onInterim: (t) => seen.push(["r1", t]) });
  rec.release(); // 第一轮结束，交给 stop 的回调存在 stopCalls[0]
  rec.start("en-US", { onInterim: (t) => seen.push(["r2", t]) }); // 新一轮，seq 已递增
  stopCalls[0]?.onInterim?.("stale"); // 旧轮迟到 interim -> 必须被忽略
  assert.deepEqual(seen, [], "旧轮 interim 不应转发到新一轮");
  startOpts[1]?.onInterim?.("fresh"); // 本轮 recognizer 吐出的 interim -> 正常转发
  assert.deepEqual(seen, [["r2", "fresh"]]);
  rec.release(); // 清理安全超时定时器
});
