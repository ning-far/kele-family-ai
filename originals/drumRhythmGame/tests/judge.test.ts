/**
 * 判定窗口单测：边界值必须精确（±90/±150/±220），超窗不算失误。
 */

import { describe, expect, it } from "vitest";
import {
  JUDGE_MS,
  MAX_JUDGE_MS,
  gradeFromDelta,
  pickHitTarget,
  JUDGE_LABEL,
} from "../src/core/judge";

describe("gradeFromDelta 判定窗口", () => {
  it("窗口常量符合规格", () => {
    expect(JUDGE_MS.great).toBe(90);
    expect(JUDGE_MS.good).toBe(150);
    expect(JUDGE_MS.ok).toBe(220);
    expect(MAX_JUDGE_MS).toBe(220);
  });

  it("太棒了 ±90ms（含边界）", () => {
    expect(gradeFromDelta(0)).toBe("great");
    expect(gradeFromDelta(90)).toBe("great");
    expect(gradeFromDelta(-90)).toBe("great");
    expect(gradeFromDelta(45)).toBe("great");
  });

  it("很好 ±150ms（含边界，>90）", () => {
    expect(gradeFromDelta(91)).toBe("good");
    expect(gradeFromDelta(150)).toBe("good");
    expect(gradeFromDelta(-150)).toBe("good");
    expect(gradeFromDelta(-120)).toBe("good");
  });

  it("不错 ±220ms（含边界，>150）", () => {
    expect(gradeFromDelta(151)).toBe("ok");
    expect(gradeFromDelta(220)).toBe("ok");
    expect(gradeFromDelta(-220)).toBe("ok");
  });

  it("超 ±220ms → null（多敲一下，不算失误）", () => {
    expect(gradeFromDelta(221)).toBeNull();
    expect(gradeFromDelta(-221)).toBeNull();
    expect(gradeFromDelta(1000)).toBeNull();
  });

  it("判定文字全为正面中文词，无失败/差劲类字眼", () => {
    const words = Object.values(JUDGE_LABEL).join("");
    expect(words).toContain("太棒了");
    expect(words).toContain("加油");
    // 注：「不错」是正面词，不能用单字「错」做禁词，故只查真正的负面词。
    expect(words).not.toMatch(/失败|差劲|糟|烂|太差|真差/);
  });
});

describe("pickHitTarget 选最近目标", () => {
  const c = (timeMs: number) => ({ timeMs });

  it("挑窗口内最近的一个", () => {
    const candidates = [c(1000), c(1400), c(2000)];
    expect(pickHitTarget(candidates, 1380)).toBe(candidates[1]);
    expect(pickHitTarget(candidates, 1010)).toBe(candidates[0]);
  });

  it("全部超窗 → null", () => {
    const candidates = [c(1000), c(2000)];
    expect(pickHitTarget(candidates, 1500)).toBeNull(); // 距两者都 500ms
  });

  it("边界 220ms 内可选，221ms 不可选", () => {
    expect(pickHitTarget([c(1000)], 1220)).not.toBeNull();
    expect(pickHitTarget([c(1000)], 1221)).toBeNull();
    expect(pickHitTarget([c(1000)], 780)).not.toBeNull();
    expect(pickHitTarget([c(1000)], 779)).toBeNull();
  });

  it("空候选 → null", () => {
    expect(pickHitTarget([], 1000)).toBeNull();
  });
});
