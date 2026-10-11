/**
 * 谱面（chart）类型、加载与运行时校验（纯逻辑，可单测）。
 *
 * 谱面 schema（drumgame-chart/1）：
 *   { format, meta:{title,gear,difficulty,bpm,beatsPerBar,stepsPerBar,audioOffsetMs},
 *     lanes:[{id,name,key,color,shape,icon?,gm?}],
 *     notes:[{beat,lanes:number[],vel}],
 *     events?:[{beat,type,value?}] }
 *
 * beat = 浮点拍（相对起点）；运行时 time_ms = beat*60000/bpm + audioOffsetMs。
 * 本版支持多轨道音符（同拍不同 lane，如闭镲+边击同时击打）。
 */

import { beatToMs } from "./clock";

export const CHART_FORMAT = "drumgame-chart/1";

/** 轨道形状（色盲双编码：颜色 + 形状/图标）。 */
export type LaneShape = "circle" | "triangle" | "round" | "star";

export interface LaneDef {
  id: number; // = 板子键号 i(0..3)
  name: string; // 例：闭镲 CHH
  key: string; // S1..S4
  gm?: number; // GM 音色号：CHH42/OHH46/Clap39/Rim37
  color: string; // 糖果色
  shape: LaneShape; // 形状（与颜色双编码）
  icon?: string;
}

export interface NoteDef {
  beat: number; // 浮点拍
  /** Actual recording time, for drift/variable tempo; never difficulty-scaled. */
  timeMs?: number;
  lanes: number[]; // 本版一律长度 1
  vel: number; // 0..127，映射音符大小/亮度
}

export interface ChartEvent {
  beat: number;
  type: string;
  value?: number;
}

export interface ChartMeta {
  title: string;
  gear?: number;
  difficulty?: string;
  bpm: number;
  beatsPerBar: number;
  stepsPerBar: number;
  audioOffsetMs: number;
  lengthBeats?: number; // 整曲拍数（用于安排乐句循环与结束）
  source?: string;
  /** MP3 音频文件路径（相对于 public/ 目录），有值时使用 MP3 播放而非合成旋律。 */
  audioFile?: string;
  audioDurationMs?: number;
  audioSha256?: string;
  drumKit?: 'groove';
}

export interface Chart {
  format: typeof CHART_FORMAT;
  meta: ChartMeta;
  lanes: LaneDef[];
  notes: NoteDef[];
  events?: ChartEvent[];
}

/**
 * 音符目标时间（ms）= beat*60000/bpm + audioOffsetMs。
 * 运行期还会再叠加用户「音频延迟校准」，见 engine。
 */
export function noteTimeMs(note: NoteDef, bpm: number, chart: Chart): number {
  return (note.timeMs ?? beatToMs(note.beat,bpm)) + chart.meta.audioOffsetMs;
}

/** 整曲拍数：优先用 meta.lengthBeats，否则取最后一个音符的 beat + 1。 */
export function chartLengthBeats(chart: Chart): number {
  if (typeof chart.meta.lengthBeats === "number" && chart.meta.lengthBeats > 0) {
    return chart.meta.lengthBeats;
  }
  if (chart.notes.length === 0) return 0;
  return chart.notes[chart.notes.length - 1].beat + 1;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * 运行时结构校验：确认 raw 具备 chart 必需结构，否则抛错。
 * 通过后再跑 validateChart 做「规则」校验（密度/双押/单调等）。
 */
export function parseChart(raw: unknown): Chart {
  if (!isRecord(raw)) throw new Error("谱面根节点应为对象");
  if (raw.format !== CHART_FORMAT) {
    throw new Error(`谱面 format 应为 ${CHART_FORMAT}，实际 ${String(raw.format)}`);
  }
  if (!isRecord(raw.meta)) throw new Error("谱面缺少 meta 对象");
  if (!Array.isArray(raw.lanes) || raw.lanes.length === 0) {
    throw new Error("谱面 lanes 应为非空数组");
  }
  if (!Array.isArray(raw.notes)) throw new Error("谱面 notes 应为数组");
  const chart = raw as unknown as Chart;
  const errors = validateChart(chart);
  if (errors.length > 0) {
    throw new Error("谱面校验失败：\n- " + errors.join("\n- "));
  }
  return chart;
}

/**
 * 规则校验：返回错误列表（空数组 = 通过）。单测直接读 charts/twinkle.json 跑它。
 * 覆盖硬约束：
 *  - format 正确；lane.id 唯一
 *  - 无负 beat；beat 单调不减
 *  - lanes ⊆ 已定义 lane.id；单音符内 lane 不重复
 *  - 同一 beat 允许多个音符（多轨道鼓谱，如同时敲闭镲和边击）
 *  - vel ∈ [0,127] 且为整数
 *  - 密度 ≤ 每拍 4 音（按整数拍窗口内 lane 总数统计）
 */
export function validateChart(chart: Chart): string[] {
  const errors: string[] = [];

  if (chart.format !== CHART_FORMAT) {
    errors.push(`format 应为 ${CHART_FORMAT}，实际 ${String(chart.format)}`);
  }

  const laneIds = new Set<number>();
  for (const lane of chart.lanes) {
    if (laneIds.has(lane.id)) errors.push(`lane.id 重复：${lane.id}`);
    laneIds.add(lane.id);
  }

  let prevBeat = Number.NEGATIVE_INFINITY;
  const perBeat = new Map<number, number>();

  for (let i = 0; i < chart.notes.length; i++) {
    const n = chart.notes[i];
    if(n.timeMs!==undefined&&(!Number.isFinite(n.timeMs)||n.timeMs<0))errors.push(`note[${i}] timeMs invalid`);
    if(i>0&&n.timeMs!==undefined&&chart.notes[i-1].timeMs!==undefined&&n.timeMs<chart.notes[i-1].timeMs!)errors.push(`note[${i}] timeMs not monotonic`);

    if (!Number.isFinite(n.beat)) {
      errors.push(`note[${i}] beat 非有限数：${String(n.beat)}`);
      continue;
    }
    if (n.beat < 0) errors.push(`note[${i}] beat 为负：${n.beat}`);
    if (n.beat < prevBeat) {
      errors.push(`note[${i}] beat 非单调不减：${n.beat} < ${prevBeat}`);
    }
    prevBeat = n.beat;

    if (!Array.isArray(n.lanes) || n.lanes.length === 0) {
      errors.push(`note[${i}] lanes 为空`);
      continue;
    }
    const seen = new Set<number>();
    for (const l of n.lanes) {
      if (!laneIds.has(l)) errors.push(`note[${i}] lane ${l} 未在 lanes 中定义`);
      if (seen.has(l)) errors.push(`note[${i}] 单音符内 lane ${l} 重复`);
      seen.add(l);
    }

    if (!Number.isInteger(n.vel) || n.vel < 0 || n.vel > 127) {
      errors.push(`note[${i}] vel 越界（应为 0..127 整数）：${String(n.vel)}`);
    }

    // 多轨道鼓谱：同一 beat 允许多个音符（不同 lane）。

    // 密度：按整数拍窗口 [floor(beat), floor(beat)+1) 统计 lane 总数。
    const bucket = Math.floor(n.beat);
    perBeat.set(bucket, (perBeat.get(bucket) ?? 0) + n.lanes.length);
  }

  for (const [bucket, count] of perBeat) {
    if (count > 4) errors.push(`beat ${bucket} 密度 ${count} 超过每拍 4 音上限`);
  }

  return errors;
}
