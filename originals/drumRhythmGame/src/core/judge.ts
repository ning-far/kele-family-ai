/**
 * 判定窗口与判定逻辑（纯函数，可单测）。
 *
 * 儿童友好原则：
 * - 三档命中窗口都算「打到了」，只是评价不同；
 * - 超过最大窗口不算失误，只当「多敲一下」，不判罚（返回 null）；
 * - 判定文字一律用正面中文词，绝不出现「失败/差劲」等字眼。
 */

/** 命中等级（miss 是「音符落地没打到」，用词也保持正面）。 */
export type JudgeGrade = "great" | "good" | "ok" | "miss";
/** handleHit 命中到的音符评价（不含 miss，miss 由「落地未打」产生）。 */
export type HitGrade = "great" | "good" | "ok";

/** 判定窗口（毫秒，取绝对值比较）。 */
export const JUDGE_MS = {
  great: 90, // 太棒了
  good: 150, // 很好
  ok: 220, // 不错
} as const;

/** 最大判定窗口：超过它不算失误，只当多敲一下。 */
export const MAX_JUDGE_MS = JUDGE_MS.ok;

/** 判定文字（正面中文词，少文字、配合颜色/动画）。 */
export const JUDGE_LABEL: Record<JudgeGrade, string> = {
  great: "太棒了",
  good: "很好",
  ok: "不错",
  miss: "加油",
};

/** 判定文字配色（糖果色，与轨道色系区分，纯装饰）。 */
export const JUDGE_COLOR: Record<JudgeGrade, string> = {
  great: "#ffe066",
  good: "#8ce99a",
  ok: "#8cc9ff",
  miss: "#c3b8e6",
};

/**
 * 命中偏差 → 命中等级。
 * @param deltaMs 命中时间 - 音符目标时间（正=偏晚，负=偏早）
 * @returns great/good/ok；|delta| 超过 220ms 返回 null（多敲一下，不判罚）。
 */
export function gradeFromDelta(deltaMs: number): HitGrade | null {
  const d = Math.abs(deltaMs);
  if (d <= JUDGE_MS.great) return "great";
  if (d <= JUDGE_MS.good) return "good";
  if (d <= JUDGE_MS.ok) return "ok";
  return null;
}

/**
 * 在一组候选音符里，挑出离命中时间最近、且落在 ±220ms 窗口内的一个。
 * 找不到（说明这一下是「多敲」）返回 null。
 * 只依赖 { timeMs }，与具体音符类型解耦，方便单测。
 */
export function pickHitTarget<T extends { timeMs: number }>(
  candidates: readonly T[],
  hitMs: number,
): T | null {
  let best: T | null = null;
  let bestAbs = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c.timeMs - hitMs);
    if (d <= MAX_JUDGE_MS && d < bestAbs) {
      bestAbs = d;
      best = c;
    }
  }
  return best;
}
