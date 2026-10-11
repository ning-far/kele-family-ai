/**
 * SerialSource：阶段1B 的「真机鼓」输入源，实现 1A 定义的 InputSource 接口。
 *
 * 数据来源：device 层 BeatboxLink.subscribe 暴露的 DeviceState.keysDown（8 元素，S1–S8 按住态）。
 * 关键设计（对齐用户要求）：
 *  - 只取「按下沿」：keysDown[i] 由 false→true 才算一次敲击；忽略抬手（true→false）、
 *    忽略未变化的重复状态；
 *  - 天然忽略 note 双倍触发：device-store 里 "note" 回显只改 keyFlashUntil、不动 keysDown，
 *    所以监听 keysDown 边沿只会捕获物理按键（"key" 消息），不会被实时打击回显二次触发；
 *  - 只取 i∈0..3（S1–S4）当四条鼓轨道；其余键不作鼓判定；
 *  - 同键 20–30ms 去重（默认 25ms）：防抖动 / 防设备重复下行，短于窗口的再次按下沿丢弃；
 *  - i===6（S7）按下沿作为「开始信号」单独抛出（供「已连接/待开始」界面监听），不当鼓；
 *  - 命中时间戳用注入的 Clock（游玩期即音频时钟 MusicEngine.nowMs=Tone.Transport 秒×1000），
 *    与 KeyboardSource、engine 判定同源。
 *
 * 本文件不 import Tone / Web Serial，只依赖纯接口，可在 node 环境单测（假 link + 假时钟）。
 */

import type { Clock } from "../core/clock";
import type { HitEvent, InputSource } from "../input/types";

/** SerialSource 只需要 link 暴露「按键按住态 + 订阅」。BeatboxLink 结构上满足它。 */
export interface DeviceKeyState {
  keysDown: boolean[];
}

export interface KeyStateLink {
  getState(): DeviceKeyState;
  /** 订阅状态变化；返回取消订阅函数。实现可（像 BeatboxLink 那样）立即回调一次当前状态。 */
  subscribe(fn: (s: DeviceKeyState) => void): () => unknown;
}

/**
 * 是否应由电脑端播放合成鼓声。
 *
 * 硬件鼓模式下，鼓声已由板子喇叭本地发出（固件 S1–S4 一按即响），
 * 所以命中来自 serial 时必须抑制电脑端合成鼓，避免双重发声；
 * 来自 keyboard（无硬件）时才放合成鼓。旋律背景音乐两种模式都由电脑放（不走此门）。
 *
 * 抽成纯函数便于单测，也供 screens 回调复用（保证规则唯一来源）。
 */
export function shouldPlaySynthDrum(source: HitEvent["source"]): boolean {
  return source !== "serial";
}

export interface SerialSourceOptions {
  /** 当作鼓轨道的键数（i∈0..laneCount-1）。默认 4 → S1–S4。 */
  laneCount?: number;
  /** 「开始信号」键号。默认 6 → S7。 */
  startKeyIndex?: number;
  /** 同键去重窗口（ms）。默认 25（落在要求的 20–30ms 区间）。 */
  dedupeMs?: number;
  /** 物理键总数（keysDown 长度）。默认 8 → S1–S8。 */
  keyCount?: number;
}

export class SerialSource implements InputSource {
  readonly kind = "serial" as const;

  private readonly link: KeyStateLink;
  private readonly clock: Clock;
  private readonly laneCount: number;
  private readonly startKeyIndex: number;
  private readonly dedupeMs: number;
  private readonly keyCount: number;

  private onHit?: (e: HitEvent) => void;
  private onStartSignal?: () => void;
  /** 按下+抬起双态回调（长按检测用）。与 onStartSignal 互斥，后设置者生效。 */
  private onStartSignalState?: (v: 0 | 1) => void;
  private unsub: (() => unknown) | null = null;

  /** 上一帧各键按住态，用于检测 false→true 按下沿。 */
  private prev: boolean[] = [];
  /** 每键「上次被接受的命中」时间戳（ms），用于去重；-Infinity 表示尚无。 */
  private lastHitAt: number[] = [];
  private running = false;

  constructor(link: KeyStateLink, clock: Clock, opts: SerialSourceOptions = {}) {
    this.link = link;
    this.clock = clock;
    this.laneCount = opts.laneCount ?? 4;
    this.startKeyIndex = opts.startKeyIndex ?? 6;
    this.dedupeMs = opts.dedupeMs ?? 25;
    this.keyCount = opts.keyCount ?? 8;
  }

  /** 是否已连接硬件（供上层判断是否走「硬件鼓」模式）。 */
  isConnected(): boolean {
    return this.running;
  }

  start(onHit: (e: HitEvent) => void): void {
    this.onHit = onHit;
    if (this.unsub) return;
    // 用当前状态建立边沿基线，避免把「已按住」误判为按下沿。
    this.prev = this.snapshot(this.link.getState());
    this.lastHitAt = new Array(this.keyCount).fill(Number.NEGATIVE_INFINITY);
    this.running = true;
    this.unsub = this.link.subscribe(this.handleState);
  }

  stop(): void {
    this.onHit = undefined;
    this.onStartSignal = undefined;
    this.unsub?.();
    this.unsub = null;
    this.running = false;
    this.prev = [];
  }

  /**
   * 注册「开始信号」回调：板子 S7(i=6) 按下沿触发。
   * 传 null 取消。上层在「待开局」界面响应它。
   */
  setStartSignalHandler(cb: (() => void) | null): void {
    this.onStartSignal = cb ?? undefined;
    this.onStartSignalState = undefined; // 互斥
  }

  /**
   * 注册「开始信号」按下/抬起双态回调（用于长按检测）。
   * v=1 按下沿、v=0 抬起沿。设置后 onStartSignal 被清空（互斥）。
   */
  setStartSignalStateHandler(cb: ((v: 0 | 1) => void) | null): void {
    this.onStartSignalState = cb ?? undefined;
    this.onStartSignal = undefined; // 互斥
  }

  /**
   * 重置边沿检测基线与去重时间戳。
   * 用于开局时确保「已按住」的键不会被误判为按下沿，
   * 同时清除去重记录让新一轮敲击立即可检测。
   */
  resetEdges(): void {
    if (this.running) {
      this.prev = this.snapshot(this.link.getState());
      this.lastHitAt = new Array(this.keyCount).fill(Number.NEGATIVE_INFINITY);
    }
  }

  /** 把 keysDown 规整成长度 keyCount 的布尔数组（缺位补 false）。 */
  private snapshot(s: DeviceKeyState | null | undefined): boolean[] {
    const src = s?.keysDown ?? [];
    const out: boolean[] = [];
    for (let i = 0; i < this.keyCount; i++) out.push(!!src[i]);
    return out;
  }

  private handleState = (s: DeviceKeyState): void => {
    const keys = this.snapshot(s);
    // 首次订阅回调（BeatboxLink 会立即推一次当前 state）：对齐基线，不产生命中。
    if (this.prev.length !== this.keyCount) {
      this.prev = keys;
      return;
    }
    const now = this.clock.nowMs();
    for (let i = 0; i < this.keyCount; i++) {
      const down = keys[i];
      const was = this.prev[i];
      this.prev[i] = down;

      // S7：双态边沿（按下+抬起）独立处理，不受按下沿过滤影响
      if (i === this.startKeyIndex) {
        if (down && !was) {
          this.onStartSignal?.();
          this.onStartSignalState?.(1);
        } else if (!down && was) {
          this.onStartSignalState?.(0);
        }
        continue;
      }

      // 只取按下沿（false→true）：忽略抬手、忽略 note（keysDown 不变→无边沿）
      if (!down || was) continue;
      if (i >= this.laneCount) continue; // 只 S1–S4 作鼓

      // 同键去重：距上次被接受的命中 < dedupeMs 的再次按下沿丢弃。
      const last = this.lastHitAt[i];
      if (now - last < this.dedupeMs) continue;
      this.lastHitAt[i] = now;
      this.onHit?.({ lane: i, timeMs: now, source: "serial" });
    }
  };
}
