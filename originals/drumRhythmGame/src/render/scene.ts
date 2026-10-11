/**
 * Scene：把「时间域」的引擎状态投影成「像素域」的可渲染模型，并持有全部视觉状态。
 *
 * - computeLayout / projectNotes：纯投影（下落插值，从出现到判定线约 travelMs）。
 * - Scene：拥有星空、命中爆发、彩带、判定浮字、吉祥物情绪、连击与分数缓动等视觉状态。
 *
 * 判定线固定在画面高 82% 处；音符 travelMs 默认 2.8 秒（儿童友好，给足反应时间）。
 * 不 import Tone.js，只依赖 core 的纯类型与 effects。
 */

import type { LaneDef, LaneShape } from "../core/chart";
import type { RuntimeNote } from "../core/engine";
import { JUDGE_COLOR, JUDGE_LABEL, type HitGrade } from "../core/judge";
import { clamp } from "../core/clock";
import {
  Confetti,
  HitBurst,
  Popups,
  defaultRng,
  type BackgroundLayer,
  type Rng,
} from "./effects";
import { TrainNightBackground } from "./train-background";
import { createBackground } from "./theme-registry";

export interface LaneLayout {
  index: number;
  left: number;
  right: number;
  width: number;
  centerX: number;
}

export interface Layout {
  width: number;
  height: number;
  judgeY: number; // 判定线 y（height * 0.82）
  spawnY: number; // 音符出现处（顶部之上）
  travelMs: number; // 出现 → 判定线的时间
  fieldLeft: number;
  fieldRight: number;
  noteBaseRadius: number;
  lanes: LaneLayout[];
}

/** 计算布局：4 轨居中、等宽，判定线在 82% 高。 */
export function computeLayout(
  width: number,
  height: number,
  laneCount: number,
  travelMs: number,
): Layout {
  const judgeY = Math.round(height * 0.82);
  const fieldW = Math.min(width * 0.92, 700);
  const left0 = (width - fieldW) / 2;
  const laneW = fieldW / Math.max(1, laneCount);
  const lanes: LaneLayout[] = [];
  for (let i = 0; i < laneCount; i++) {
    const left = left0 + i * laneW;
    lanes.push({ index: i, left, right: left + laneW, width: laneW, centerX: left + laneW / 2 });
  }
  const noteBaseRadius = Math.min(laneW * 0.3, 42);
  return {
    width,
    height,
    judgeY,
    spawnY: -noteBaseRadius * 1.6,
    travelMs,
    fieldLeft: left0,
    fieldRight: left0 + fieldW,
    noteBaseRadius,
    lanes,
  };
}

/** 音符力度 → 半径（vel 越大越大越亮）。 */
export function noteRadius(vel: number, base: number): number {
  return base * (0.72 + 0.5 * clamp(vel / 127, 0, 1));
}

export type NoteState = "falling" | "missed";

export interface NoteView {
  note: RuntimeNote;
  lane: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  shape: LaneShape;
  progress: number; // 0=出现，1=判定线，>1=已过线
  state: NoteState;
}

export type MascotMood = "idle" | "cheer" | "oops";

export interface MascotState {
  mood: MascotMood;
  t: number; // 进入该情绪的秒数
  bob: number; // 呼吸/摆动的累计相位
}

/**
 * 把引擎音符投影成 NoteView（只保留该出现的）。
 * progress = 1 - (timeMs - nowMs)/travelMs；y 在 spawnY↔judgeY 间线性插值。
 */
export function projectNotes(
  notes: readonly RuntimeNote[],
  layout: Layout,
  laneDefs: readonly LaneDef[],
  nowMs: number,
): NoteView[] {
  const out: NoteView[] = [];
  for (const n of notes) {
    if (n.status === "hit") continue; // 命中后交给爆发特效表现
    const progress = 1 - (n.timeMs - nowMs) / layout.travelMs;
    if (progress < -0.02) continue; // 还没到出现时机
    if (n.status === "missed" && progress > 1.35) continue; // 落地太久，淡出移除
    const lane = layout.lanes[n.lane];
    const def = laneDefs[n.lane];
    if (!lane) continue;
    const y = layout.spawnY + progress * (layout.judgeY - layout.spawnY);
    out.push({
      note: n,
      lane: n.lane,
      x: lane.centerX,
      y,
      radius: noteRadius(n.vel, layout.noteBaseRadius),
      color: def?.color ?? "#ffffff",
      shape: def?.shape ?? "circle",
      progress,
      state: n.status === "missed" ? "missed" : "falling",
    });
  }
  return out;
}

/** 视觉状态容器 + 事件响应。渲染器只读取它来作画。 */
export class Scene {
  layout: Layout = computeLayout(1, 1, 4, 2800);
  laneDefs: LaneDef[] = [];

  /** 背景层（1A 夜空；1B 可 setBackground 换成横向视差小火车）。 */
  background: BackgroundLayer;
  readonly burst = new HitBurst();
  readonly confetti = new Confetti();
  readonly popups = new Popups();

  mascot: MascotState = { mood: "idle", t: 0, bob: 0 };
  combo = 0;
  displayScore = 0;
  targetScore = 0;
  /** 每轨命中后的短暂发亮（0..1，随时间衰减）。 */
  laneGlow = [0, 0, 0, 0];
  /** 里程碑欢呼强度（0..1），驱动背景柔和脉动，<3Hz。 */
  cheerPulse = 0;

  private travelMs: number;
  private reduceMotion: boolean;
  private rng: Rng;

  constructor(reduceMotion = false, travelMs = 2800, rng: Rng = defaultRng) {
    this.reduceMotion = reduceMotion;
    this.travelMs = travelMs;
    this.rng = rng;
    // 阶段1B：默认换成「夜行小火车穿越星空山谷」横向视差背景。
    this.background = new TrainNightBackground({ reduceMotion, rng });
  }

  /** 1B 换背景：注入实现同一 BackgroundLayer 接口的对象即可。 */
  setBackground(bg: BackgroundLayer): void {
    this.background = bg;
  }

  /** 按主题 id 切换背景（从 theme-registry 查找并实例化）。 */
  setTheme(themeId: string, opts: { reduceMotion: boolean }): void {
    const bg = createBackground(themeId, opts);
    this.setBackground(bg);
  }

  /**
   * 阶段1B：把音乐节拍喂给背景，驱动「随音乐滚动的枕木节拍尺」。
   * 游玩期传 engine.currentBeat()；首页/结算传 null 释放为缓慢自走漂移。
   */
  setMusicBeat(beat: number | null): void {
    this.background.setScrollBeats?.(beat);
  }

  setReduceMotion(v: boolean): void {
    this.reduceMotion = v;
  }

  setLanes(laneDefs: LaneDef[]): void {
    this.laneDefs = laneDefs;
    this.laneGlow = laneDefs.map(() => 0);
  }

  resize(width: number, height: number): void {
    this.layout = computeLayout(width, height, this.laneDefs.length || 4, this.travelMs);
  }

  /** 每帧推进视觉状态。dt 秒。targetScore 用于分数缓动（含温和回滚）。 */
  update(dt: number, targetScore: number, combo: number): void {
    this.targetScore = targetScore;
    this.combo = combo;

    this.background.update(dt, this.reduceMotion);
    this.burst.update(dt);
    this.confetti.update(dt);
    this.popups.update(dt);

    // 分数缓动：命中升、失误温和回落，都平滑过渡。
    const diff = this.targetScore - this.displayScore;
    if (Math.abs(diff) < 0.6) this.displayScore = this.targetScore;
    else this.displayScore += diff * Math.min(1, dt * 7);

    // 吉祥物情绪：非 idle 约 1.1 秒后回到 idle。
    this.mascot.t += dt;
    this.mascot.bob += dt;
    if (this.mascot.mood !== "idle" && this.mascot.t > 1.1) this.mascot.mood = "idle";

    // 轨道发光衰减
    for (let i = 0; i < this.laneGlow.length; i++) {
      this.laneGlow[i] = Math.max(0, this.laneGlow[i] - dt * 2.6);
    }
    // 欢呼脉动缓慢衰减（低频，绝不快闪）
    this.cheerPulse = Math.max(0, this.cheerPulse - dt * 0.8);
  }

  setMood(mood: MascotMood): void {
    this.mascot.mood = mood;
    this.mascot.t = 0;
  }

  /** 重开一局前清空所有瞬时视觉状态（分数/连击/特效/情绪）。 */
  reset(): void {
    this.burst.clear();
    this.confetti.clear();
    this.popups.clear();
    this.displayScore = 0;
    this.targetScore = 0;
    this.combo = 0;
    this.cheerPulse = 0;
    this.laneGlow = this.laneGlow.map(() => 0);
    this.setMood("idle");
  }

  /** 命中反馈：柔和爆发 + 轨道发亮 + 判定浮字；「太棒了」时吉祥物开心一下。 */
  onHit(lane: number, grade: HitGrade): void {
    const ll = this.layout.lanes[lane];
    const def = this.laneDefs[lane];
    if (!ll) return;
    const x = ll.centerX;
    const y = this.layout.judgeY;
    const strength = grade === "great" ? 1 : grade === "good" ? 0.7 : 0.5;
    this.burst.spawn(x, y, def?.color ?? "#ffffff", strength, this.reduceMotion, this.rng);
    this.background.onHitPulse?.(strength); // 敲对时小火车角色柔和跳一下
    this.laneGlow[lane] = 1;
    this.popups.spawn(JUDGE_LABEL[grade], x, y - 46, JUDGE_COLOR[grade], grade === "great");
    if (grade === "great") this.setMood("cheer");
  }

  /** 失误反馈：音符灰化由渲染处理，这里给一句温和「加油」+ 吉祥物温和表情。 */
  onMiss(lane: number): void {
    const ll = this.layout.lanes[lane];
    if (!ll) return;
    this.popups.spawn(JUDGE_LABEL.miss, ll.centerX, this.layout.judgeY - 40, JUDGE_COLOR.miss, false);
    this.setMood("oops");
  }

  /** 多敲一下：极轻的中性提示，不出文字、不判罚。 */
  onExtraTap(lane: number): void {
    const ll = this.layout.lanes[lane];
    if (!ll) return;
    this.laneGlow[lane] = Math.max(this.laneGlow[lane], 0.35);
  }

  /** 连击里程碑：柔和彩带 + 吉祥物欢呼 + 背景低频脉动。 */
  onCombo(milestone: number): void {
    this.confetti.burst(this.layout.width, this.reduceMotion, this.rng, milestone >= 50 ? 60 : 40);
    this.setMood("cheer");
    this.cheerPulse = 1;
    this.popups.spawn(
      `${milestone} 连击!`,
      this.layout.width / 2,
      this.layout.judgeY - 150,
      "#ffe066",
      true,
    );
  }
}
