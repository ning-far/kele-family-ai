/**
 * GameEngine 单测：用「假时钟」驱动（绝不 import Tone），
 * 覆盖命中判定、多敲不判罚、落地 miss、结束回调、leadIn/calibration 偏移。
 */

import { describe, expect, it } from "vitest";
import { GameEngine, type EngineResult } from "../src/core/engine";
import type { Chart } from "../src/core/chart";
import type { Clock } from "../src/core/clock";
import { CHART_FORMAT } from "../src/core/chart";

/** 可编程假时钟。 */
class FakeClock implements Clock {
  t = 0;
  nowMs(): number {
    return this.t;
  }
}

/** 造一个 4 拍小谱：beat 0..3，每拍一个音符，交替 lane 3/2。 */
function makeChart(): Chart {
  return {
    format: CHART_FORMAT,
    meta: {
      title: "test",
      bpm: 60,
      beatsPerBar: 4,
      stepsPerBar: 16,
      audioOffsetMs: 0,
      lengthBeats: 4,
    },
    lanes: [
      { id: 0, name: "a", key: "S1", color: "#ffffff", shape: "circle" },
      { id: 1, name: "b", key: "S2", color: "#ffffff", shape: "triangle" },
      { id: 2, name: "c", key: "S3", color: "#ffffff", shape: "round" },
      { id: 3, name: "d", key: "S4", color: "#ffffff", shape: "star" },
    ],
    notes: [
      { beat: 0, lanes: [3], vel: 100 },
      { beat: 1, lanes: [2], vel: 100 },
      { beat: 2, lanes: [3], vel: 100 },
      { beat: 3, lanes: [2], vel: 100 },
    ],
  };
}

describe("GameEngine 时间轴", () => {
  it("bpm 60 → 每拍 1000ms，音符目标时间对齐", () => {
    const clock = new FakeClock();
    const eng = new GameEngine(makeChart(), clock, { bpm: 60 });
    expect(eng.notes.map((n) => n.timeMs)).toEqual([0, 1000, 2000, 3000]);
  });

  it("leadInMs / calibrationMs 叠加到目标时间", () => {
    const clock = new FakeClock();
    const eng = new GameEngine(makeChart(), clock, {
      bpm: 60,
      leadInMs: 4000,
      calibrationMs: 50,
    });
    expect(eng.notes[0].timeMs).toBe(4050);
    expect(eng.notes[1].timeMs).toBe(5050);
  });
});

describe("GameEngine 命中与判定", () => {
  it("正中靶心 → great + 连击 1", () => {
    const clock = new FakeClock();
    const hits: string[] = [];
    const eng = new GameEngine(makeChart(), clock, { bpm: 60 }, {
      onHit: (_n, g) => hits.push(g),
    });
    clock.t = 1000;
    eng.handleHit(2, 1000); // beat1 lane2，偏差 0
    expect(hits).toEqual(["great"]);
    expect(eng.score.combo).toBe(1);
    expect(eng.notes[1].status).toBe("hit");
  });

  it("偏差 140ms → good；偏差 200ms → ok", () => {
    const clock = new FakeClock();
    const grades: string[] = [];
    const eng = new GameEngine(makeChart(), clock, { bpm: 60 }, {
      onHit: (_n, g) => grades.push(g),
    });
    eng.handleHit(3, 0 + 140); // beat0 目标 0，偏 140
    eng.handleHit(2, 1000 + 200); // beat1 目标 1000，偏 200
    expect(grades).toEqual(["good", "ok"]);
  });

  it("超 ±220ms → 多敲一下，不判罚、不改分", () => {
    const clock = new FakeClock();
    let extra = 0;
    const eng = new GameEngine(makeChart(), clock, { bpm: 60 }, {
      onExtraTap: () => extra++,
    });
    const scoreBefore = eng.score.score;
    eng.handleHit(3, 500); // 距 beat0(0)=500、距 beat2(2000)=1500，都超窗
    expect(extra).toBe(1);
    expect(eng.score.score).toBe(scoreBefore);
    expect(eng.score.combo).toBe(0);
  });

  it("错误轨道在窗口内无可判音符 → 多敲一下", () => {
    const clock = new FakeClock();
    let extra = 0;
    const eng = new GameEngine(makeChart(), clock, { bpm: 60 }, {
      onExtraTap: () => extra++,
    });
    eng.handleHit(0, 0); // beat0 是 lane3，敲 lane0 → 无目标
    expect(extra).toBe(1);
    expect(eng.notes[0].status).toBe("pending");
  });
});

describe("GameEngine miss 与结束", () => {
  it("过窗未打 → missed，连击清零", () => {
    const clock = new FakeClock();
    const missed: number[] = [];
    const eng = new GameEngine(makeChart(), clock, { bpm: 60 }, {
      onMiss: (n) => missed.push(n.index),
    });
    clock.t = 0 + 221; // beat0 目标 0，超窗
    eng.update();
    expect(eng.notes[0].status).toBe("missed");
    expect(missed).toEqual([0]);
    expect(eng.score.counts.miss).toBe(1);
  });

  it("窗口内不判 miss", () => {
    const clock = new FakeClock();
    const eng = new GameEngine(makeChart(), clock, { bpm: 60 });
    clock.t = 200; // beat0 仍在 ±220 内
    eng.update();
    expect(eng.notes[0].status).toBe("pending");
  });

  it("整曲结束触发 onEnd，结果含 ≥1 星与准度", () => {
    const clock = new FakeClock();
    let result: EngineResult | null = null;
    const eng = new GameEngine(makeChart(), clock, { bpm: 60, tailBeats: 2 }, {
      onEnd: (r) => (result = r),
    });
    clock.t = eng.endTimeMs + 1;
    eng.update();
    expect(eng.ended).toBe(true);
    expect(result).not.toBeNull();
    expect(result!.totalNotes).toBe(4);
    expect(result!.stars).toBeGreaterThanOrEqual(1);
    expect(result!.accuracy).toBeGreaterThanOrEqual(0);
  });

  it("命中全部后再结束 → 高分高准度 3 星", () => {
    const clock = new FakeClock();
    let result: EngineResult | null = null;
    const eng = new GameEngine(makeChart(), clock, { bpm: 60 }, {
      onEnd: (r) => (result = r),
    });
    for (const n of eng.notes) eng.handleHit(n.lane, n.timeMs); // 全部正中
    clock.t = eng.endTimeMs + 1;
    eng.update();
    expect(result!.stars).toBe(3);
    expect(result!.maxCombo).toBe(4);
    expect(result!.accuracy).toBeCloseTo(1, 5);
  });
});
