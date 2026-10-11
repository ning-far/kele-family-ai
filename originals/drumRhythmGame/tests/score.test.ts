/**
 * 计分 / 连击 / 星级单测：正向计分、温和回滚、里程碑、永远 ≥1 星。
 */

import { describe, expect, it } from "vitest";
import {
  GRADE_POINTS,
  MISS_PENALTY,
  COMBO_MILESTONES,
  createScore,
  applyHit,
  applyMiss,
  accuracy,
  computeStars,
  encourageMessage,
} from "../src/core/score";

describe("applyHit 计分与连击", () => {
  it("命中加分、连击 +1", () => {
    const s = createScore(10);
    const r = applyHit(s, "great");
    expect(s.score).toBe(GRADE_POINTS.great);
    expect(s.combo).toBe(1);
    expect(s.maxCombo).toBe(1);
    expect(s.counts.great).toBe(1);
    expect(r.gained).toBe(GRADE_POINTS.great);
  });

  it("三档分值 great>good>ok", () => {
    expect(GRADE_POINTS.great).toBeGreaterThan(GRADE_POINTS.good);
    expect(GRADE_POINTS.good).toBeGreaterThan(GRADE_POINTS.ok);
  });

  it("连击里程碑 10/25/50 触发", () => {
    expect([...COMBO_MILESTONES]).toEqual([10, 25, 50]);
    const s = createScore(100);
    let milestones: (number | null)[] = [];
    for (let i = 1; i <= 50; i++) milestones.push(applyHit(s, "ok").milestone);
    const hit = milestones.filter((m): m is number => m !== null);
    expect(hit).toEqual([10, 25, 50]);
  });

  it("连击加成封顶 +50%", () => {
    const s = createScore(1000);
    for (let i = 0; i < 100; i++) applyHit(s, "ok"); // combo 100 → 加成早已封顶
    const before = s.score;
    const r = applyHit(s, "great");
    expect(r.gained).toBe(Math.round(GRADE_POINTS.great * 1.5));
    expect(s.score).toBe(before + r.gained);
  });
});

describe("applyMiss 温和回滚", () => {
  it("连击清零、扣分很小", () => {
    const s = createScore(10);
    applyHit(s, "great");
    applyHit(s, "great");
    expect(s.combo).toBe(2);
    applyMiss(s);
    expect(s.combo).toBe(0);
    expect(s.counts.miss).toBe(1);
    expect(MISS_PENALTY).toBeLessThanOrEqual(25);
  });

  it("分数绝不为负", () => {
    const s = createScore(10);
    applyMiss(s);
    applyMiss(s);
    expect(s.score).toBe(0);
  });
});

describe("accuracy 与 computeStars", () => {
  it("全 great → 准度 1、3 星", () => {
    const s = createScore(4);
    for (let i = 0; i < 4; i++) applyHit(s, "great");
    expect(accuracy(s)).toBeCloseTo(1, 5);
    expect(computeStars(s)).toBe(3);
  });

  it("空谱准度 1（不惩罚）", () => {
    const s = createScore(0);
    expect(accuracy(s)).toBe(1);
  });

  it("永远 ≥1 星：全 miss 也 1 星", () => {
    const s = createScore(5);
    for (let i = 0; i < 5; i++) applyMiss(s);
    expect(accuracy(s)).toBe(0);
    expect(computeStars(s)).toBe(1);
  });

  it("星级阈值：≥0.85→3，≥0.6→2，否则 1", () => {
    const mk = (great: number, good: number, ok: number, miss: number) => {
      const s = createScore(great + good + ok + miss);
      for (let i = 0; i < great; i++) applyHit(s, "great");
      for (let i = 0; i < good; i++) applyHit(s, "good");
      for (let i = 0; i < ok; i++) applyHit(s, "ok");
      s.counts.miss += miss;
      return s;
    };
    expect(computeStars(mk(85, 0, 0, 15))).toBe(3);
    expect(computeStars(mk(60, 0, 0, 40))).toBe(2);
    expect(computeStars(mk(10, 0, 0, 90))).toBe(1);
  });
});

describe("encourageMessage 鼓励语", () => {
  it("各星级都有正面鼓励语，无失败/差劲类字眼", () => {
    for (const st of [1, 2, 3] as const) {
      const msg = encourageMessage(st);
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toMatch(/失败|差劲|糟|烂|笨|太差/);
    }
  });
});
