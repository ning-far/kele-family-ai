/**
 * 时间与时钟工具。
 *
 * 设计要点：
 * - 本文件保持「纯」，不 import Tone.js，以便单测在 node 环境直接跑。
 * - Clock 是一个接口：游玩期由音频引擎（MusicEngine，基于 Tone.Transport）实现，
 *   单测里可注入「假时钟」。engine 只依赖接口，不依赖具体实现，方便替换与测试。
 */

/** 权威音频时钟接口。游玩期一切计时都以它为准，绝不用 setTimeout 自己数。 */
export interface Clock {
  /** 当前音频时钟时间（毫秒，单调递增；暂停时保持不动）。 */
  nowMs(): number;
}

/**
 * beat → 毫秒。
 * 规格：time_ms = beat * 60000 / bpm + offsetMs
 * offsetMs 用于谱面自带的 audioOffsetMs 与用户「音频延迟校准」的叠加。
 */
export function beatToMs(beat: number, bpm: number, offsetMs = 0): number {
  return (beat * 60000) / bpm + offsetMs;
}

/** 毫秒 → beat（beatToMs 的逆运算，用于把当前音频时间换算成拍）。 */
export function msToBeat(ms: number, bpm: number, offsetMs = 0): number {
  return ((ms - offsetMs) * bpm) / 60000;
}

/** 每拍多少毫秒。 */
export function msPerBeat(bpm: number): number {
  return 60000 / bpm;
}

/** 把数值夹到 [min, max]。 */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
