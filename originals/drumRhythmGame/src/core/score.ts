/**
 * 计分 / 连击 / 星级（纯逻辑，可单测）。
 *
 * 儿童友好原则：
 * - 计分以「正向」为主：打到就加分，评价越好分越高；
 * - 失误只做「温和回滚」：小幅扣分且分数绝不为负，连击清零；
 * - 结算永远 ≥ 1 星，配鼓励语，绝不出现 0 星 / 失败字样。
 */

import type { HitGrade, JudgeGrade } from "./judge";

/** 各命中等级得分。 */
export const GRADE_POINTS: Record<HitGrade, number> = {
  great: 300,
  good: 200,
  ok: 100,
};

/** 失误温和回滚：扣一点点分（不为负）。刻意做得很小，避免打击孩子。 */
export const MISS_PENALTY = 25;

/** 连击里程碑：触发柔和彩带 + 角色欢呼（视觉闪烁频率必须 <3Hz）。 */
export const COMBO_MILESTONES = [10, 25, 50] as const;

export interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  /** 各判定计数，用于算准度与星级。 */
  counts: Record<JudgeGrade, number>;
  totalNotes: number;
}

/** 创建初始计分状态。 */
export function createScore(totalNotes: number): ScoreState {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    counts: { great: 0, good: 0, ok: 0, miss: 0 },
    totalNotes,
  };
}

/** applyHit 的返回：若这次命中恰好跨过一个连击里程碑，带回该里程碑值。 */
export interface HitOutcome {
  milestone: number | null;
  gained: number;
}

/**
 * 命中一个音符：加分、连击 +1，并检查是否触发里程碑。
 * @returns 本次得分与（若命中里程碑）里程碑值。
 */
export function applyHit(s: ScoreState, grade: HitGrade): HitOutcome {
  s.counts[grade] += 1;
  // 连击越高，加成越多，但保持温和（每 10 连击 +5%，封顶 +50%）。
  const comboBonus = 1 + Math.min(0.5, Math.floor(s.combo / 10) * 0.05);
  const gained = Math.round(GRADE_POINTS[grade] * comboBonus);
  s.score += gained;
  s.combo += 1;
  if (s.combo > s.maxCombo) s.maxCombo = s.combo;
  const milestone = (COMBO_MILESTONES as readonly number[]).find((m) => m === s.combo) ?? null;
  return { milestone, gained };
}

/** 失误（音符落地没打到）：连击清零 + 分数温和回滚（绝不为负）。 */
export function applyMiss(s: ScoreState): void {
  s.counts.miss += 1;
  s.combo = 0;
  s.score = Math.max(0, s.score - MISS_PENALTY);
}

/**
 * 准度 0..1：按命中质量加权。
 * great=1、good=0.75、ok=0.5、miss=0，除以总音符数。
 * 没有音符时返回 1（不惩罚空谱）。
 */
export function accuracy(s: ScoreState): number {
  if (s.totalNotes <= 0) return 1;
  const weighted = s.counts.great * 1 + s.counts.good * 0.75 + s.counts.ok * 0.5;
  return Math.max(0, Math.min(1, weighted / s.totalNotes));
}

/** 星级：永远 ≥1 星。准度 ≥0.85→3 星，≥0.6→2 星，其余 1 星。 */
export function computeStars(s: ScoreState): 1 | 2 | 3 {
  const acc = accuracy(s);
  if (acc >= 0.85) return 3;
  if (acc >= 0.6) return 2;
  return 1;
}

/** 结算鼓励语：随星级变化，全正面、无「失败/差劲」类字眼。 */
export function encourageMessage(stars: 1 | 2 | 3): string {
  if (stars === 3) return "太厉害啦！节奏小达人！";
  if (stars === 2) return "很棒！再玩一次会更厉害！";
  return "完成啦！继续加油，你越来越棒！";
}
