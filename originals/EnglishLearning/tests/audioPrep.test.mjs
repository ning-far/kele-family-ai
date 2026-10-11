/**
 * Unit tests for audio preprocessing (pure logic, no browser).
 * Run with:  node --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  peakOf,
  trimSilence,
  normalizeGain,
  padToMinLength,
  prepareSpeech,
} from "../src/speech/audioPrep.js";

test("peakOf finds the maximum amplitude", () => {
  // 注意 Float32 精度：0.9 存入 Float32Array 后约为 0.89999998，需用容差比较
  const p = peakOf(new Float32Array([0, 0.5, -0.9, 0.2]));
  assert.ok(Math.abs(p - 0.9) < 1e-6, "expected ~0.9, got " + p);
});

test("trimSilence removes leading and trailing silence", () => {
  const d = new Float32Array(1000);
  for (let i = 300; i < 600; i++) d[i] = 0.5;
  const t = trimSilence(d);
  assert.ok(t.length < d.length, "should be trimmed, got " + t.length);
  assert.ok(t.length >= 300 && t.length <= 360, "should keep the voiced part, got " + t.length);
});

test("trimSilence leaves all-silence input unchanged (no crash, no empty output)", () => {
  const d = new Float32Array(500);
  assert.equal(trimSilence(d).length, d.length);
});

test("normalizeGain raises quiet audio up to the target peak", () => {
  const d = new Float32Array([0, 0.05, -0.05, 0]);
  const g = normalizeGain(d, { targetPeak: 0.9, maxGain: 100 });
  assert.ok(Math.abs(peakOf(g) - 0.9) < 1e-5, "peak should be ~0.9, got " + peakOf(g));
});

test("normalizeGain does NOT amplify near-silence (avoids boosting background noise)", () => {
  const d = new Float32Array([0, 1e-6, -1e-6]);
  const g = normalizeGain(d, { targetPeak: 0.9 });
  assert.equal(peakOf(g), peakOf(d));
});

test("normalizeGain caps gain at maxGain", () => {
  const d = new Float32Array([0, 1e-3]);
  const g = normalizeGain(d, { targetPeak: 0.9, maxGain: 5 });
  assert.ok(peakOf(g) <= 1e-3 * 5 + 1e-6, "gain must be capped, got " + peakOf(g));
});

test("padToMinLength pads short audio with silence", () => {
  const p = padToMinLength(new Float32Array(100), 400);
  assert.equal(p.length, 400);
  assert.equal(peakOf(p), 0);
});

test("padToMinLength leaves already-long audio untouched", () => {
  const d = new Float32Array(500);
  assert.equal(padToMinLength(d, 400).length, 500);
});

test("prepareSpeech: near-silence is NOT amplified or padded (stays silent -> recognizer returns no result)", () => {
  const sr = 16000;
  const d = new Float32Array(Math.round(0.1 * sr)); // 按了键但没出声
  for (let i = 0; i < d.length; i++) d[i] = 0.002; // 环境底噪级别
  const out = prepareSpeech(d, sr, { minSeconds: 1 });
  // 不能补到 1s（否则静音被拉长成噪声，模型更容易脑补出一个词）
  assert.ok(out.length < sr, "should not be padded to 1s, got " + out.length);
  assert.ok(peakOf(out) < 0.01, "silence must not be amplified, got " + peakOf(out));
});

test("prepareSpeech: a short quiet word is trimmed, boosted and padded to min length", () => {
  const sr = 16000;
  const d = new Float32Array(Math.round(0.3 * sr)); // 0.3s
  for (let i = 80; i < 200; i++) d[i] = 0.08; // 很轻的说话
  const out = prepareSpeech(d, sr, { minSeconds: 1 });
  assert.equal(out.length, sr, "should be padded to 1s");
  assert.ok(peakOf(out) > 0.5, "loudness should be raised, got " + peakOf(out));
});
