/**
 * 输入源抽象。
 *
 * 阶段1A：只实现 KeyboardSource（键盘 D/F/J/K，备用 1/2/3/4）。
 * 阶段1B：新增 SerialSource（Web Serial，VID 0x303A，波特率 115200），
 *   解析设备上行 {t:"key", i, v}（见 easyinput-beatbox/app/src/protocol.ts:59），
 *   只取 v===1（按下沿）、i∈0..3（S1–S4），并对同一键做 20–30ms 去重，
 *   再用同一个 Clock 打时间戳 → 交给 engine.handleHit。
 *
 * 因为两种源都只通过 onHit(HitEvent) 输出、都实现同一个 InputSource 接口，
 * 1B 换源时上层（screens/engine）无需改动。
 */

/** 一次「敲击」：轨道 + 音频时钟时间戳 + 来源标识。 */
export interface HitEvent {
  lane: number; // 0..3（= 板子键号 i）
  timeMs: number; // 由权威音频时钟打戳
  source: "keyboard" | "serial";
}

/** 输入源接口：start 时把命中回调交给它，stop 时解绑。 */
export interface InputSource {
  /** 开始监听；命中通过 onHit 抛出。 */
  start(onHit: (e: HitEvent) => void): void;
  /** 停止监听并清理。 */
  stop(): void;
  /** 源标识，便于日志/调试。 */
  readonly kind: "keyboard" | "serial";
}
