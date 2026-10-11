/**
 * 阶段1B 真机接入单测（纯逻辑，node 环境，绝不 import Tone / Web Serial 实体）。
 *
 * 覆盖：
 *  1) SerialSource：按下沿触发、同键 20–30ms 去重、忽略抬手、忽略 note 双倍触发、
 *     只取 S1–S4(i∈0..3)、S7(i=6) 当开始信号、首帧基线不误触；
 *  2) shouldPlaySynthDrum：serial 抑制合成鼓、keyboard 放行（避免双重发声）；
 *  3) BeatboxLink.sendRecord：record 冻结/解除的下发 JSON 行格式（收发之「发」）。
 *
 * 「忽略 note」用真实的 device-store 归约来验证：note 回显只改 keyFlashUntil、
 * 不动 keysDown，所以监听 keysDown 边沿的 SerialSource 天然不会被 note 触发。
 */

import { describe, expect, it } from "vitest";
import {
  SerialSource,
  shouldPlaySynthDrum,
  type DeviceKeyState,
  type KeyStateLink,
} from "../src/device/serial-source";
import { createInitialState, reduceHostLine, type DeviceState } from "../src/device/device-store";
import { BeatboxLink } from "../src/device/link";
import type { Clock } from "../src/core/clock";
import type { HitEvent } from "../src/input/types";

/** 可编程假时钟（模拟音频时钟毫秒）。 */
class FakeClock implements Clock {
  t = 0;
  nowMs(): number {
    return this.t;
  }
}

/**
 * 假设备链路：内部持 DeviceState，喂入上行 JSON 行经 device-store 归约后通知订阅者。
 * 与真实 BeatboxLink 一样：subscribe 立即推一次当前状态。
 */
class FakeDeviceLink implements KeyStateLink {
  private state: DeviceState = createInitialState();
  private readonly listeners = new Set<(s: DeviceKeyState) => void>();

  getState(): DeviceKeyState {
    return this.state;
  }

  subscribe(fn: (s: DeviceKeyState) => void): () => unknown {
    this.listeners.add(fn);
    fn(this.state); // BeatboxLink 语义：订阅即回一次当前态
    return () => this.listeners.delete(fn);
  }

  /** 模拟设备上行一行 JSON。 */
  feed(line: string): void {
    this.state = reduceHostLine(this.state, line);
    for (const fn of this.listeners) fn(this.state);
  }
}

const key = (i: number, v: 0 | 1) => `{"t":"key","i":${i},"v":${v}}`;

describe("SerialSource · 命中与去重", () => {
  it("按下沿产生命中，带 lane / 音频时钟时间戳 / source=serial", () => {
    const link = new FakeDeviceLink();
    const clock = new FakeClock();
    const src = new SerialSource(link, clock);
    const hits: HitEvent[] = [];
    src.start((e) => hits.push(e));

    clock.t = 1000;
    link.feed(key(1, 1));

    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({ lane: 1, timeMs: 1000, source: "serial" });
  });

  it("同键 <25ms 的二次按下沿被去重丢弃，>=25ms 才再次接受", () => {
    const link = new FakeDeviceLink();
    const clock = new FakeClock();
    const src = new SerialSource(link, clock); // 默认 dedupeMs=25
    const hits: HitEvent[] = [];
    src.start((e) => hits.push(e));

    clock.t = 0;
    link.feed(key(0, 1)); // 首次命中，lastHitAt[0]=0
    link.feed(key(0, 0)); // 抬手

    clock.t = 10;
    link.feed(key(0, 1)); // 距上次 10ms < 25 → 丢弃
    expect(hits).toHaveLength(1);

    clock.t = 30;
    link.feed(key(0, 0));
    link.feed(key(0, 1)); // 距上次被接受的 0ms 已 30ms >= 25 → 命中
    expect(hits).toHaveLength(2);
    expect(hits[1].timeMs).toBe(30);
  });

  it("去重窗口可配置（dedupeMs=20 落在要求区间）", () => {
    const link = new FakeDeviceLink();
    const clock = new FakeClock();
    const src = new SerialSource(link, clock, { dedupeMs: 20 });
    const hits: HitEvent[] = [];
    src.start((e) => hits.push(e));

    clock.t = 0;
    link.feed(key(2, 1));
    link.feed(key(2, 0));
    clock.t = 19;
    link.feed(key(2, 1)); // 19 < 20 → 丢弃
    expect(hits).toHaveLength(1);
    clock.t = 20;
    link.feed(key(2, 0));
    link.feed(key(2, 1)); // 20 >= 20 → 命中
    expect(hits).toHaveLength(2);
  });

  it("忽略抬手（true→false 不产生命中）", () => {
    const link = new FakeDeviceLink();
    const clock = new FakeClock();
    const src = new SerialSource(link, clock);
    const hits: HitEvent[] = [];
    src.start((e) => hits.push(e));

    link.feed(key(3, 1));
    expect(hits).toHaveLength(1);
    link.feed(key(3, 0)); // 抬手
    expect(hits).toHaveLength(1);
  });

  it("忽略 note 回显（keysDown 不变 → 不与 key 双倍触发）", () => {
    const link = new FakeDeviceLink();
    const clock = new FakeClock();
    const src = new SerialSource(link, clock);
    const hits: HitEvent[] = [];
    src.start((e) => hits.push(e));

    // 固件实时打击会同时上行 note 回显与 key；note 只改 keyFlashUntil。
    link.feed('{"t":"note","n":42,"v":100}'); // CHH 回显
    link.feed('{"t":"note","n":39,"v":100}'); // Clap 回显
    expect(hits).toHaveLength(0); // note 不触发命中

    link.feed(key(0, 1)); // 只有物理按键才算
    expect(hits).toHaveLength(1);
    expect(hits[0].lane).toBe(0);
  });

  it("只取 S1–S4(i∈0..3) 作鼓；i=4/5(S5/S6) 不产生命中", () => {
    const link = new FakeDeviceLink();
    const clock = new FakeClock();
    const src = new SerialSource(link, clock);
    const hits: HitEvent[] = [];
    src.start((e) => hits.push(e));

    link.feed(key(4, 1)); // S5 → 非鼓、非开始键
    link.feed(key(5, 1)); // S6
    expect(hits).toHaveLength(0);

    link.feed(key(3, 1)); // S4 → lane 3
    expect(hits).toHaveLength(1);
    expect(hits[0].lane).toBe(3);
  });

  it("首帧基线：start 时已按住的键不误触发", () => {
    const link = new FakeDeviceLink();
    link.feed(key(2, 1)); // start 前已按住 S3
    const clock = new FakeClock();
    const src = new SerialSource(link, clock);
    const hits: HitEvent[] = [];
    src.start((e) => hits.push(e)); // 立即推当前态：i=2 已 true，基线对齐，无沿
    expect(hits).toHaveLength(0);

    link.feed(key(2, 0));
    link.feed(key(2, 1)); // 真正的一次新按下才算
    expect(hits).toHaveLength(1);
  });
});

describe("SerialSource · S7 开始信号", () => {
  it("S7(i=6) 按下沿触发开始信号，且不当鼓命中", () => {
    const link = new FakeDeviceLink();
    const clock = new FakeClock();
    const src = new SerialSource(link, clock);
    const hits: HitEvent[] = [];
    let started = 0;
    src.setStartSignalHandler(() => started++);
    src.start((e) => hits.push(e));

    link.feed(key(6, 1));
    expect(started).toBe(1);
    expect(hits).toHaveLength(0); // S7 不是鼓轨

    link.feed(key(6, 0));
    link.feed(key(6, 1)); // 再次按下沿
    expect(started).toBe(2);
  });

  it("setStartSignalHandler(null) 后不再回调", () => {
    const link = new FakeDeviceLink();
    const clock = new FakeClock();
    const src = new SerialSource(link, clock);
    let started = 0;
    src.setStartSignalHandler(() => started++);
    src.start(() => {});

    link.feed(key(6, 1));
    expect(started).toBe(1);

    src.setStartSignalHandler(null);
    link.feed(key(6, 0));
    link.feed(key(6, 1));
    expect(started).toBe(1); // 已取消
  });

  it("stop 后不再产生命中，isConnected 归位", () => {
    const link = new FakeDeviceLink();
    const clock = new FakeClock();
    const src = new SerialSource(link, clock);
    const hits: HitEvent[] = [];
    src.start((e) => hits.push(e));
    expect(src.isConnected()).toBe(true);

    src.stop();
    expect(src.isConnected()).toBe(false);
    link.feed(key(0, 1));
    expect(hits).toHaveLength(0);
  });
});

describe("shouldPlaySynthDrum · 避免双重发声", () => {
  it("serial 来源抑制合成鼓（鼓声由板子喇叭本地发）", () => {
    expect(shouldPlaySynthDrum("serial")).toBe(false);
  });
  it("keyboard 来源放行合成鼓（无硬件时的反馈）", () => {
    expect(shouldPlaySynthDrum("keyboard")).toBe(true);
  });
});

describe("BeatboxLink.sendRecord · record 冻结收发（发）", () => {
  /** 注入假 writer 捕获下行字节，验证冻结/解除的 JSON 行格式。 */
  function captureWriter(link: BeatboxLink): string[] {
    const sent: string[] = [];
    const dec = new TextDecoder();
    (link as unknown as { writer: unknown }).writer = {
      write: async (v: Uint8Array) => {
        sent.push(dec.decode(v));
      },
    };
    return sent;
  }

  it('开始游戏下发 {"t":"record","v":1}（冻结 S7/S8/编码器）', async () => {
    const link = new BeatboxLink();
    const sent = captureWriter(link);
    link.sendRecord(true);
    await Promise.resolve();
    expect(sent.join("")).toBe('{"t":"record","v":1}\n');
  });

  it('结束/退出下发 {"t":"record","v":0}（解除冻结）', async () => {
    const link = new BeatboxLink();
    const sent = captureWriter(link);
    link.sendRecord(false);
    await Promise.resolve();
    expect(sent.join("")).toBe('{"t":"record","v":0}\n');
  });

  it("冻结→解除按顺序各下发一行", async () => {
    const link = new BeatboxLink();
    const sent = captureWriter(link);
    link.sendRecord(true);
    link.sendRecord(false);
    await Promise.resolve();
    expect(sent).toEqual(['{"t":"record","v":1}\n', '{"t":"record","v":0}\n']);
  });
});
