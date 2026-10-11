/**
 * 时钟换算单测：beat ↔ ms 往返一致，含谱面偏移与校准叠加。
 */

import { describe, expect, it } from "vitest";
import { beatToMs, msToBeat, msPerBeat, clamp } from "../src/core/clock";

describe("beat ↔ ms", () => {
  it("beatToMs 符合 time_ms = beat*60000/bpm + offset", () => {
    expect(beatToMs(0, 84)).toBe(0);
    expect(beatToMs(1, 60)).toBe(1000); // 60bpm → 每拍 1000ms
    expect(beatToMs(4, 120)).toBe(2000); // 120bpm → 每拍 500ms
    expect(beatToMs(2, 60, 100)).toBe(2100); // 含 offset
  });

  it("msPerBeat", () => {
    expect(msPerBeat(60)).toBe(1000);
    expect(msPerBeat(120)).toBe(500);
  });

  it("msToBeat 是 beatToMs 的逆运算（往返一致）", () => {
    for (const bpm of [70, 84, 100]) {
      for (const beat of [0, 1, 2.5, 15, 95]) {
        const ms = beatToMs(beat, bpm, 37);
        expect(msToBeat(ms, bpm, 37)).toBeCloseTo(beat, 9);
      }
    }
  });

  it("变速不变密度：同一 beat 的拍号不随 bpm 改变", () => {
    // 谱面以「拍」为单位，bpm 只改时间换算，不改 beat。
    expect(msToBeat(beatToMs(7, 70), 70)).toBeCloseTo(7, 9);
    expect(msToBeat(beatToMs(7, 100), 100)).toBeCloseTo(7, 9);
  });
});

describe("clamp", () => {
  it("夹到区间内", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
