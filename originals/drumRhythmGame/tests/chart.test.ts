/**
 * 谱面校验单测：直接读 charts/twinkle.json 跑 validateChart / parseChart，
 * 并断言任务规格里的全部硬约束。
 */

import { describe, expect, it } from "vitest";
import twinkle from "../charts/twinkle.json";
import {
  CHART_FORMAT,
  parseChart,
  validateChart,
  chartLengthBeats,
  type Chart,
} from "../src/core/chart";
import { DIFFICULTY_BPM } from "../src/settings";

const chart = twinkle as unknown as Chart;

describe("charts/twinkle.json 结构与校验", () => {
  it("validateChart 无错误", () => {
    expect(validateChart(chart)).toEqual([]);
  });

  it("parseChart 不抛错并原样返回", () => {
    expect(() => parseChart(twinkle)).not.toThrow();
    expect(parseChart(twinkle).format).toBe(CHART_FORMAT);
  });

  it("meta 字段齐全", () => {
    expect(chart.format).toBe("drumgame-chart/1");
    expect(chart.meta.title).toBe("小星星");
    expect(chart.meta.beatsPerBar).toBe(4);
    expect(chart.meta.stepsPerBar).toBe(16);
    expect(typeof chart.meta.audioOffsetMs).toBe("number");
  });

  it("4 条轨道 = S1..S4，颜色+形状双编码符合规格", () => {
    expect(chart.lanes).toHaveLength(4);
    const byId = chart.lanes.map((l) => l.id);
    expect(byId).toEqual([0, 1, 2, 3]);
    expect(chart.lanes.map((l) => l.key)).toEqual(["S1", "S2", "S3", "S4"]);
    expect(chart.lanes.map((l) => l.shape)).toEqual(["circle", "triangle", "round", "star"]);
    // GM 音色号：CHH42 / OHH46 / Clap39 / Rim37
    expect(chart.lanes.map((l) => l.gm)).toEqual([42, 46, 39, 37]);
    // 每条轨道都有颜色（色盲双编码：颜色 + 形状）
    for (const l of chart.lanes) expect(l.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("谱面硬约束", () => {
  it("无负 beat 且单调不减", () => {
    let prev = -Infinity;
    for (const n of chart.notes) {
      expect(n.beat).toBeGreaterThanOrEqual(0);
      expect(n.beat).toBeGreaterThanOrEqual(prev);
      prev = n.beat;
    }
  });

  it("lanes ⊆ {0,1,2,3} 且单音符内不重复", () => {
    for (const n of chart.notes) {
      expect(n.lanes.length).toBeGreaterThanOrEqual(1);
      for (const l of n.lanes) {
        expect([0, 1, 2, 3]).toContain(l);
      }
      expect(new Set(n.lanes).size).toBe(n.lanes.length);
    }
  });

  it("双押 = 0（每音符恰好 1 lane，且无同 beat 多音符）", () => {
    for (const n of chart.notes) expect(n.lanes).toHaveLength(1);
    const beats = chart.notes.map((n) => n.beat);
    expect(new Set(beats).size).toBe(beats.length);
  });

  it("vel ∈ [0,127] 且为整数", () => {
    for (const n of chart.notes) {
      expect(Number.isInteger(n.vel)).toBe(true);
      expect(n.vel).toBeGreaterThanOrEqual(0);
      expect(n.vel).toBeLessThanOrEqual(127);
    }
  });

  it("密度 ≤ 每拍 4 音", () => {
    const perBeat = new Map<number, number>();
    for (const n of chart.notes) {
      const b = Math.floor(n.beat);
      perBeat.set(b, (perBeat.get(b) ?? 0) + n.lanes.length);
    }
    for (const [, count] of perBeat) expect(count).toBeLessThanOrEqual(4);
  });

  it("整曲约 1–2 分钟、乐句循环 4–6 遍", () => {
    const lengthBeats = chartLengthBeats(chart);
    const phrases = lengthBeats / 16;
    expect(phrases).toBeGreaterThanOrEqual(4);
    expect(phrases).toBeLessThanOrEqual(6);
    // 各难度下的时长（秒）都应落在约 1–2 分钟区间。
    for (const bpm of Object.values(DIFFICULTY_BPM)) {
      const sec = (lengthBeats * 60) / bpm;
      expect(sec).toBeGreaterThan(50);
      expect(sec).toBeLessThan(130);
    }
  });
});

describe("《小星星》4 键重映射节奏骨架", () => {
  it("每拍 1 下：Rim(lane3) 在第 1/3 拍，Clap(lane2) 在第 2/4 拍", () => {
    for (const n of chart.notes) {
      const lane = n.lanes[0];
      const isPhraseEnd = n.beat % 16 === 15;
      if (isPhraseEnd) {
        expect(lane).toBe(1); // 乐句末 OHH「亮一下」
        continue;
      }
      const local = n.beat % 4;
      if (local === 0 || local === 2) expect(lane).toBe(3); // Rim
      else expect(lane).toBe(2); // Clap
    }
  });

  it("每个乐句末尾（每 16 拍）有一下 OHH(lane1)", () => {
    const phrases = chartLengthBeats(chart) / 16;
    for (let p = 0; p < phrases; p++) {
      const beat = p * 16 + 15;
      const note = chart.notes.find((n) => n.beat === beat);
      expect(note, `beat ${beat} 应有音符`).toBeDefined();
      expect(note!.lanes[0]).toBe(1);
    }
  });

  it("本版不使用 CHH(lane0)", () => {
    expect(chart.notes.some((n) => n.lanes[0] === 0)).toBe(false);
  });
});

describe("validateChart 能抓出违规", () => {
  it("检出负 beat / 双押 / 越界 vel / 未定义 lane", () => {
    const bad: Chart = {
      format: CHART_FORMAT,
      meta: { ...chart.meta },
      lanes: [{ id: 0, name: "x", key: "S1", color: "#ffffff", shape: "circle" }],
      notes: [
        { beat: -1, lanes: [0], vel: 10 }, // 负 beat
        { beat: 2, lanes: [0, 0], vel: 10 }, // 单音符内重复 + 双押
        { beat: 2, lanes: [0], vel: 200 }, // 同 beat 多音符 + vel 越界
        { beat: 3, lanes: [9], vel: 10 }, // 未定义 lane
      ],
    };
    const errors = validateChart(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("|")).toMatch(/负/);
    expect(errors.join("|")).toMatch(/vel/);
    expect(errors.join("|")).toMatch(/未在 lanes/);
    expect(() => parseChart(bad)).toThrow();
  });
});
