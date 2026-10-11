/**
 * GameEngine：游玩期的「时间域」核心逻辑（纯逻辑，不 import Tone，可单测）。
 *
 * 职责：
 *  - 持有运行时音符列表（把 chart.notes 展开成带状态、带目标时间的 RuntimeNote）；
 *  - 处理一次输入命中：在同轨道候选里挑最近且在 ±220ms 窗口内的音符 → 判定 → 计分；
 *    窗口外则视为「多敲一下」，不判罚；
 *  - 每帧 update：把已过窗口仍未命中的音符标记为 miss（温和），并检测整曲结束；
 *  - 通过回调把事件抛给上层（音效 / 特效 / HUD / 结算）。
 *
 * 它只认「毫秒」，不认「像素」；像素投影在 render/scene.ts 完成。
 */

import { chartLengthBeats, noteTimeMs, type Chart } from "./chart";
import { beatToMs, clamp, msPerBeat, type Clock } from "./clock";
import { gradeFromDelta, MAX_JUDGE_MS, pickHitTarget, type HitGrade } from "./judge";
import {
  accuracy,
  applyHit,
  applyMiss,
  computeStars,
  createScore,
  type ScoreState,
} from "./score";

export type NoteStatus = "pending" | "hit" | "missed";

export interface RuntimeNote {
  index: number;
  beat: number;
  lane: number; // 本版单押，取 lanes[0]
  vel: number;
  timeMs: number; // 目标时间（含谱面 audioOffsetMs + 用户校准）
  status: NoteStatus;
  grade?: HitGrade;
  hitDeltaMs?: number;
}

export interface EngineCallbacks {
  /** 命中一个音符（grade 为 great/good/ok）。 */
  onHit?(note: RuntimeNote, grade: HitGrade, deltaMs: number): void;
  /** 多敲一下：该轨道在窗口内没有可判音符，不判罚。 */
  onExtraTap?(lane: number, timeMs: number): void;
  /** 音符落地未打：温和失误。 */
  onMiss?(note: RuntimeNote): void;
  /** 连击跨里程碑（10/25/50）。 */
  onCombo?(combo: number, milestone: number): void;
  /** 整曲结束 → 去结算。 */
  onEnd?(result: EngineResult): void;
}

export interface EngineResult {
  score: number;
  maxCombo: number;
  counts: ScoreState["counts"];
  accuracy: number;
  stars: 1 | 2 | 3;
  totalNotes: number;
}

export interface EngineOptions {
  bpm: number;
  /** 用户音频延迟校准（ms），叠加到每个音符目标时间上。 */
  calibrationMs?: number;
  /**
   * 预备拍（ms）：整首歌的音符统一后移这么多毫秒，形成「前奏空拍」，
   * 让第一个音符有足够时间从顶部下落到判定线（与音乐引擎的 leadIn 保持一致）。
   */
  leadInMs?: number;
  /** 最后一个音符判定结束后，再留多少拍收尾才结算。默认 2 拍。 */
  tailBeats?: number;
}

export class GameEngine {
  readonly chart: Chart;
  readonly notes: RuntimeNote[];
  readonly score: ScoreState;
  readonly bpm: number;
  readonly calibrationMs: number;
  readonly leadInMs: number;
  readonly endTimeMs: number;

  private readonly clock: Clock;
  private readonly cb: EngineCallbacks;
  /** miss 扫描游标：notes 按 beat 单调，扫过的不再回看。 */
  private missCursor = 0;
  ended = false;

  constructor(chart: Chart, clock: Clock, opts: EngineOptions, cb: EngineCallbacks = {}) {
    this.chart = chart;
    this.clock = clock;
    this.cb = cb;
    this.bpm = opts.bpm;
    this.calibrationMs = opts.calibrationMs ?? 0;
    this.leadInMs = opts.leadInMs ?? 0;

    const offset = chart.meta.audioOffsetMs + this.calibrationMs + this.leadInMs;
    this.notes = chart.notes.map((n, index) => ({
      index,
      beat: n.beat,
      lane: n.lanes[0] ?? 0,
      vel: clamp(n.vel, 0, 127),
      timeMs: noteTimeMs(n,this.bpm,chart)+this.calibrationMs+this.leadInMs,
      status: "pending" as NoteStatus,
    }));
    this.score = createScore(this.notes.length);

    const lengthBeats = chartLengthBeats(chart);
    const lastNote = this.notes[this.notes.length - 1];
    const lastTime = lastNote ? lastNote.timeMs : beatToMs(lengthBeats, this.bpm, offset);
    // 结束点：最后一个音符判定窗口结束后，再留一点收尾（默认 2 拍）。
    this.endTimeMs = Math.max(lastTime + MAX_JUDGE_MS + msPerBeat(this.bpm) * (opts.tailBeats ?? 2), (chart.meta.audioDurationMs??0)+this.leadInMs);
  }

  /** 当前音频时间（ms）。 */
  nowMs(): number {
    return this.clock.nowMs();
  }

  /** 当前拍（相对起点，含校准偏移，便于渲染对齐）。 */
  currentBeat(): number {
    const offset = this.chart.meta.audioOffsetMs + this.calibrationMs + this.leadInMs;
    return ((this.nowMs() - offset) * this.bpm) / 60000;
  }

  /**
   * 处理一次输入命中。
   * @param lane 轨道号 0..3
   * @param timeMs 音频时钟时间戳（由 InputSource 打戳）
   */
  handleHit(lane: number, timeMs: number): void {
    if (this.ended) return;
    const candidates = this.notes.filter((n) => n.status === "pending" && n.lane === lane);
    const target = pickHitTarget(candidates, timeMs);
    if (!target) {
      // 窗口内没有该轨道的音符：多敲一下，不判罚（空敲不扣或极轻 → 这里不扣）。
      this.cb.onExtraTap?.(lane, timeMs);
      return;
    }
    const delta = timeMs - target.timeMs;
    const grade = gradeFromDelta(delta); // pickHitTarget 已限定 ±220ms，这里必非 null
    if (!grade) {
      this.cb.onExtraTap?.(lane, timeMs);
      return;
    }
    target.status = "hit";
    target.grade = grade;
    target.hitDeltaMs = delta;
    const { milestone } = applyHit(this.score, grade);
    this.cb.onHit?.(target, grade, delta);
    if (milestone !== null) this.cb.onCombo?.(this.score.combo, milestone);
  }

  /**
   * 每帧更新：检测 miss + 结束判定。
   * notes 按 timeMs 单调，故只需从 missCursor 向前扫描。
   */
  update(): void {
    if (this.ended) return;
    const now = this.nowMs();

    while (this.missCursor < this.notes.length) {
      const n = this.notes[this.missCursor];
      if (n.status !== "pending") {
        this.missCursor++;
        continue;
      }
      if (now > n.timeMs + MAX_JUDGE_MS) {
        n.status = "missed";
        applyMiss(this.score);
        this.cb.onMiss?.(n);
        this.missCursor++;
        continue;
      }
      break; // 该音符仍在窗口内，其后的更晚，无需再看
    }

    if (now >= this.endTimeMs) {
      this.ended = true;
      this.cb.onEnd?.({
        score: this.score.score,
        maxCombo: this.score.maxCombo,
        counts: { ...this.score.counts },
        accuracy: accuracy(this.score),
        stars: computeStars(this.score),
        totalNotes: this.score.totalNotes,
      });
    }
  }

  /** 静态工具：把某拍换算成目标时间（含谱面偏移与校准），供渲染/测试复用。 */
  beatTimeMs(beat: number): number {
    return noteTimeMs({ beat, lanes: [], vel: 0 }, this.bpm, this.chart) + this.calibrationMs;
  }
}
