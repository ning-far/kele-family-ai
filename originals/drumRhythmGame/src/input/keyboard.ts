/**
 * KeyboardSource：阶段1A 的输入实现。
 *
 * 映射（lane = 板子键号 i，屏幕轨道左→右 = S1→S4）：
 *   lane0/S1 → D（备用 1）
 *   lane1/S2 → F（备用 2）
 *   lane2/S3 → J（备用 3）
 *   lane3/S4 → K（备用 4）
 *
 * 规则：
 *  - 只在「按下沿」产生一次 hit；忽略抬起、忽略系统自动重复(ev.repeat)、忽略未抬起的重复按下；
 *  - 命中时间戳用注入的 Clock（游玩期即音频时钟），保证判定与音符同源；
 *  - 对游戏键 preventDefault，避免触发按钮/滚动等浏览器默认行为。
 *
 * 用 ev.code（物理键位）而非 ev.key，免受输入法/大小写/键盘布局影响。
 */

import type { Clock } from "../core/clock";
import type { HitEvent, InputSource } from "./types";

/** 物理键位 → lane。左右手分区：D/F 左手，J/K 右手；数字键 1-4 备用。 */
const CODE_TO_LANE: Readonly<Record<string, number>> = {
  KeyD: 0,
  KeyF: 1,
  KeyJ: 2,
  KeyK: 3,
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
};

export class KeyboardSource implements InputSource {
  readonly kind = "keyboard" as const;

  private readonly clock: Clock;
  private onHit?: (e: HitEvent) => void;
  /** 记录已按下但未抬起的键，避免长按重复触发。 */
  private held = new Set<string>();
  private bound = false;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  start(onHit: (e: HitEvent) => void): void {
    this.onHit = onHit;
    if (this.bound) return;
    window.addEventListener("keydown", this.handleDown);
    window.addEventListener("keyup", this.handleUp);
    window.addEventListener("blur", this.handleBlur);
    this.bound = true;
  }

  stop(): void {
    this.onHit = undefined;
    if (!this.bound) return;
    window.removeEventListener("keydown", this.handleDown);
    window.removeEventListener("keyup", this.handleUp);
    window.removeEventListener("blur", this.handleBlur);
    this.bound = false;
    this.held.clear();
  }

  private handleDown = (ev: KeyboardEvent): void => {
    const lane = CODE_TO_LANE[ev.code];
    if (lane === undefined) return; // 非游戏键，放行
    ev.preventDefault();
    if (ev.repeat) return; // 忽略系统自动重复
    if (this.held.has(ev.code)) return; // 忽略未抬起的重复按下
    this.held.add(ev.code);
    this.onHit?.({ lane, timeMs: this.clock.nowMs(), source: "keyboard" });
  };

  private handleUp = (ev: KeyboardEvent): void => {
    if (CODE_TO_LANE[ev.code] === undefined) return;
    ev.preventDefault();
    this.held.delete(ev.code); // 只清状态，不产生 hit（忽略抬起）
  };

  /** 失焦时清空按住状态，避免切窗口回来后卡在「已按下」。 */
  private handleBlur = (): void => {
    this.held.clear();
  };
}
