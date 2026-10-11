import {chartForDifficulty} from '../core/difficulty';
/**
 * GameApp：把 core / input / audio / render / settings 串成一个可玩的游戏。
 *
 * 职责：
 *  - 屏幕状态机：home（首页/选歌）→ play（含 3-2-1 预备拍）→ paused → result（永远 ≥1 星）；
 *  - rAF 主循环：每帧用「权威音频时钟」推进引擎、投影音符、更新视觉、渲染；绝不用 setTimeout 计时；
 *  - DOM 覆盖层：大图形按钮、少文字（首页、难度、暂停、结算、家长设置）；
 *  - 输入：KeyboardSource 命中入队 → 每帧按音频时钟时间戳喂给 engine.handleHit。
 *
 * 儿童红线在本层的体现：暂停/回家大按钮常驻、结算永远 ≥1 星 + 鼓励语 + 彩带、
 * 减少动效开关实时生效、无失败/惩罚字样。
 */

import type { Chart } from "../core/chart";
import { chartLengthBeats, parseChart } from "../core/chart";
import { SONGS, type SongEntry } from "../core/songs";
import { msPerBeat } from "../core/clock";
import { GameEngine, type EngineResult } from "../core/engine";
import type { HitGrade } from "../core/judge";
import { encourageMessage } from "../core/score";
import type { HitEvent, InputSource } from "../input/types";
import type { MusicEngine } from "../audio/music";
import type { Renderer } from "../render/renderer";
import { Scene, projectNotes } from "../render/scene";
import { THEMES } from "../render/theme-registry";
import type { BeatboxLink } from "../device/link";
import type { SerialSource } from "../device/serial-source";
import { shouldPlaySynthDrum } from "../device/serial-source";
import {
  DIFFICULTY_BPM,
  DIFFICULTY_LABEL,
  type Difficulty,
  type Settings,
  type SettingsStore,
} from "../settings";

export type ScreenName = "home" | "play" | "paused" | "result";

/** 阶段1B：真机设备束（可选）。link 负责连接/下行/状态，serial 负责把按下沿变成 HitEvent。 */
export interface DeviceBundle {
  link: BeatboxLink;
  serial: SerialSource;
}

/** 预备拍（拍数）：4 拍 = 一小节，用作 3-2-1 倒数与首个音符下落预备。 */
const LEAD_IN_BEATS = 4;

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

export interface GameAppDeps {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  overlay: HTMLElement;
  music: MusicEngine;
  input: InputSource;
  renderer: Renderer;
  settings: SettingsStore;
  /** 阶段1B：真机设备（可选）。缺省即纯键盘模式，可玩性不受任何影响。 */
  device?: DeviceBundle;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/** 结算星星：实心/空心（少文字、多图形）。 */
function starsHtml(n: number): string {
  let s = "";
  for (let i = 0; i < 3; i++) s += `<span class="star ${i < n ? "on" : ""}">★</span>`;
  return s;
}

export class GameApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly overlay: HTMLElement;
  private readonly music: MusicEngine;
  private readonly input: InputSource;
  private readonly renderer: Renderer;
  private readonly settings: SettingsStore;
  /** 阶段1B：真机设备（可选）。为空时走纯键盘模式。 */
  private readonly device: DeviceBundle | null;

  private readonly scene: Scene;
  private engine: GameEngine | null = null;

  /** 当前谱面（动态加载，startGame 时更新）。 */
  private chart: Chart | null = null;
  /** 当前选中的歌曲。 */
  private activeSong: SongEntry = SONGS[0];

  private screen: ScreenName = "home";
  private hitQueue: HitEvent[] = [];
  private rafId = 0;
  private lastFrameMs = 0;
  private result: EngineResult | null = null;
  private endRequested = false;
  private leadInMs = 0;
  private lengthBeats = 1;

  // DOM refs
  private screens: Record<ScreenName, HTMLElement> = {} as Record<ScreenName, HTMLElement>;
  private countEl!: HTMLElement;
  private hudBar!: HTMLElement;
  private settingsModal!: HTMLElement;
  private resultStars!: HTMLElement;
  private resultScore!: HTMLElement;
  private resultMsg!: HTMLElement;
  private resultCombo!: HTMLElement;
  private diffButtons: HTMLElement[] = [];
  private songCards: HTMLElement[] = [];
  private unsubSettings: (() => void) | null = null;

  // ---- 阶段1B：真机接入状态 ----
  /** 每轨道「最近一次命中的来源」，在逐条喂给 engine 前写入；onHit 同步回调时读它决定是否发合成鼓。 */
  private lastSourceByLane: ("keyboard" | "serial")[] = ["keyboard", "keyboard", "keyboard", "keyboard"];
  /** 本局是否以「硬件鼓」模式进行（开局时已连接）：用于断连处理与提示。 */
  private hardwareMode = false;
  /** 上一次看到的连接态，用于检测 true→false 断连、false→true 重连的边沿。 */
  private prevConnected = false;
  /** 断连导致的自动暂停（重连后提示点继续）。 */
  private pausedByDisconnect = false;
  /** S7(i=6) 上次被接受的按下沿墙钟时间戳(ms)：20–30ms 去重，防一次按键抖动触发两次暂停/继续切换。 */
  private lastS7WallMs = Number.NEGATIVE_INFINITY;
  /** S7 长按检测定时器：按住 ≥500ms 才触发暂停/继续/开始，防止敲 S1–S4 时误触 S7。 */
  private s7PressTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubDevice: (() => unknown) | null = null;
  private deviceSupported = true;
  /** 阶段3：上一次看到的 appmode，用于检测 game↔drum 切换边沿。 */
  private prevAppmode = "";
  // 设备相关 DOM
  private deviceDock!: HTMLElement;
  private connectBtn!: HTMLButtonElement;
  private deviceStatus!: HTMLElement;
  private deviceToast!: HTMLElement;
  private toastTimer: number | null = null;
  /** 阶段3：首页模式指示器 + 鼓机模式提示。 */
  private modeIndicator!: HTMLElement;
  private drumModeHint!: HTMLElement;

  constructor(deps: GameAppDeps) {
    this.canvas = deps.canvas;
    this.ctx = deps.ctx;
    this.overlay = deps.overlay;
    this.music = deps.music;
    this.input = deps.input;
    this.renderer = deps.renderer;
    this.settings = deps.settings;
    this.device = deps.device ?? null;

    const s = this.settings.get();
    // 场景初始化：先用默认歌曲的 lanes（如果有），否则用空数组
    this.scene = new Scene(s.reduceMotion, 2800);
    this.scene.setTheme(s.theme, { reduceMotion: s.reduceMotion });
    this.lengthBeats = 96; // 默认值，startGame 时会根据实际谱面更新

    this.buildDom();
    this.applySettings(s);
    this.unsubSettings = this.settings.subscribe((ns) => this.applySettings(ns));

    this.input.start((e) => this.onInput(e));
    this.initDevice();
    this.resize();

    // 异步加载默认歌曲的谱面，用于首页场景渲染
    this.loadChartForSong(this.activeSong).then((chart) => {
      this.chart = chart;
      this.scene.setLanes(chart.lanes);
      this.lengthBeats = chartLengthBeats(chart);
    }).catch(() => {
      // 首页加载失败不影响，startGame 时会重试
    });
  }

  /** 加载指定歌曲的谱面。 */
  private async loadChartForSong(song: SongEntry): Promise<Chart> {
    const url = import.meta.env.BASE_URL + song.chartPath+'?v='+(import.meta.env.VITE_KELE_RELEASE??'aligned-recording');
    const resp = await fetch(url,{cache:'no-store'});
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.json();
    return parseChart(raw);
  }

  /** 启动主循环（常驻，home 也让背景/吉祥物动起来）。 */
  start(): void {
    this.setScreen("home");
    if (!this.rafId) {
      this.lastFrameMs = 0;
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  dispose(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.setRecordFrozen(false);
    this.input.stop();
    this.device?.serial.stop();
    this.unsubDevice?.();
    this.unsubDevice = null;
    if (this.toastTimer != null) window.clearTimeout(this.toastTimer);
    if (this.s7PressTimer) clearTimeout(this.s7PressTimer);
    this.music.dispose();
    this.unsubSettings?.();
  }

  // ===================== 阶段1B：真机接入 =====================

  /** 初始化设备：启动串行输入源、S7 开始信号、订阅连接态、静默自动重连。 */
  private initDevice(): void {
    const dev = this.device;
    if (!dev) {
      // 无设备束：纯键盘模式（仍把 UI 置为不支持，不影响可玩）。
      this.deviceSupported = false;
      this.updateDeviceUi("unsupported");
      return;
    }
    this.deviceSupported = typeof navigator !== "undefined" && "serial" in navigator;
    // 串行输入源与键盘共用 onInput（命中带 source，供上层抑制合成鼓）。
    dev.serial.start((e) => this.onInput(e));
    // S7(i=6) 按下/抬起沿：长按 500ms 才触发开始/暂停/继续，防止误触。
    dev.serial.setStartSignalStateHandler((v) => this.onDeviceS7State(v));
    // 订阅连接态：驱动 UI + 断连/重连边沿处理（subscribe 会立即回调一次）。
    this.unsubDevice = dev.link.subscribe((st) =>
      this.handleLinkState({ connected: st.connected, sync: st.sync, deviceName: st.deviceName, appmode: st.appmode }),
    );
    // 尝试静默自动重连已授权端口（无需手势）；不支持则忽略。
    if (this.deviceSupported) {
      void dev.link.connect().catch(() => {
        this.deviceSupported = false;
        this.updateDeviceUi("unsupported");
      });
    }
  }

  private handleLinkState(st: { connected: boolean; sync: string; deviceName: string; appmode?: string }): void {
    const connected = !!st.connected;
    const phase: "unsupported" | "disconnected" | "connecting" | "connected" = !this.deviceSupported
      ? "unsupported"
      : connected
        ? "connected"
        : st.sync === "connecting"
          ? "connecting"
          : "disconnected";
    this.updateDeviceUi(phase, st.deviceName);

    if (this.prevConnected && !connected) this.onDeviceDisconnected();
    else if (!this.prevConnected && connected) this.onDeviceReconnected();
    this.prevConnected = connected;

    // 阶段3：appmode 边沿检测 → 模式联动
    const am = st.appmode ?? "";
    if (am && am !== this.prevAppmode) {
      this.onAppmodeChanged(am);
    }
    this.prevAppmode = am;
  }

  /** 阶段3：appmode 变化时响应 UI + 游戏状态。 */
  private onAppmodeChanged(mode: string): void {
    // 更新首页模式指示器
    if (this.modeIndicator) {
      this.modeIndicator.textContent = mode === "drum" ? "🥁 鼓机模式" : "🎮 游戏模式";
    }
    if (this.drumModeHint) {
      this.drumModeHint.hidden = mode !== "drum";
    }
    if (mode === "drum") {
      // 切到鼓机模式：暂停游戏 + 提示
      if (this.screen === "play") {
        this.music.pause();
        this.setScreen("paused");
      }
      this.showDeviceToast("已切换回鼓机模式，游戏暂停", 0);
    } else if (mode === "game") {
      // 切回游戏模式：隐藏提示
      this.hideDeviceToast();
    }
  }

  private updateDeviceUi(
    phase: "unsupported" | "disconnected" | "connecting" | "connected",
    name?: string,
  ): void {
    if (!this.deviceDock) return;
    this.deviceDock.dataset.phase = phase;
    const btn = this.connectBtn;
    const label = btn.querySelector("[data-label]");
    switch (phase) {
      case "unsupported":
        btn.hidden = true;
        this.deviceStatus.innerHTML = `<span class="dot"></span>此浏览器不支持连鼓板 · 可用键盘玩`;
        break;
      case "connecting":
        btn.hidden = false;
        btn.disabled = true;
        if (label) label.textContent = "连接中";
        this.deviceStatus.innerHTML = `<span class="dot"></span>连接中…`;
        break;
      case "connected": {
        btn.hidden = false;
        btn.disabled = false;
        if (label) label.textContent = "重新连接";
        const modeLabel = this.prevAppmode === "drum" ? " · 🥁 鼓机模式" : this.prevAppmode === "game" ? " · 🎮 游戏模式" : "";
        this.deviceStatus.innerHTML = `<span class="dot on"></span>已连接${name ? " · " + name : ""}${modeLabel}，可以开始`;
        break;
      }
      default:
        btn.hidden = false;
        btn.disabled = false;
        if (label) label.textContent = "连接鼓板";
        this.deviceStatus.innerHTML = `<span class="dot"></span>未连接鼓板 · 也能用键盘玩`;
    }
  }

  /** 点「连接鼓板」：触发浏览器原生串口选择弹窗（requestPort）。 */
  private async connectDevice(): Promise<void> {
    const dev = this.device;
    if (!dev) return;
    if (!this.deviceSupported) {
      this.showDeviceToast("此浏览器不支持连接鼓板，请用 Chrome / Edge，或用键盘玩");
      return;
    }
    this.updateDeviceUi("connecting");
    try {
      await dev.link.requestPort();
      this.showDeviceToast("已连接，可以开始！按 S7 或点开始");
    } catch {
      // 用户取消或浏览器拒绝：回到未连接，不报错吓人（儿童友好）。
      this.updateDeviceUi("disconnected");
      this.showDeviceToast("没连上也没关系，可以用键盘玩");
    }
  }

  /**
   * S7 按下/抬起双态回调：长按 500ms 才触发暂停/继续/开始。
   * 按下时启动 500ms 定时器，抬起时取消；定时器到期即执行对应操作。
   * 短按（<500ms）不触发任何操作，防止敲 S1–S4 时误触 S7。
   */
  private onDeviceS7State(v: 0 | 1): void {
    if (v === 1) {
      // 按下：去重 + 启动 500ms 长按定时器
      const nowWall = performance.now();
      if (nowWall - this.lastS7WallMs < 25) return;
      this.lastS7WallMs = nowWall;
      if (this.s7PressTimer) clearTimeout(this.s7PressTimer);
      this.s7PressTimer = setTimeout(() => {
        this.s7PressTimer = null;
        this.handleS7LongPress();
      }, 500);
    } else {
      // 抬起：取消定时器（短按忽略）
      if (this.s7PressTimer) {
        clearTimeout(this.s7PressTimer);
        this.s7PressTimer = null;
      }
    }
  }

  /** S7 长按 500ms 触发：按当前界面路由——首页开始、游玩中暂停、暂停面板继续。 */
  private handleS7LongPress(): void {
    switch (this.screen) {
      case "home":
        void this.startGame();
        break;
      case "play":
      case "paused":
        this.togglePause();
        break;
      default:
        break; // 结算页等：S7 行为保持不动
    }
  }

  /** 断连：仅在硬件模式开局时自动暂停 + 友好提示（link 已在自动重连）。 */
  private onDeviceDisconnected(): void {
    if (!this.hardwareMode) return;
    if (this.screen === "play") {
      this.music.pause();
      this.pausedByDisconnect = true;
      this.setScreen("paused");
    }
    this.showDeviceToast("鼓板断开了，请重新连接板子（正在自动重连…）", 0);
  }

  /** 重连/首次连接：硬件模式下提示点继续，并重新下发 record 冻结。 */
  private onDeviceReconnected(): void {
    // 无论是否硬件模式，首页时都重置边沿基线：
    // 首次连接时 hardwareMode 尚未置 true（只在开局时检测），
    // 如果不在此处 resetEdges，S7/S1–S4 的 false→true 边沿检测会因 prev 与
    // 连接握手期间推送的 keysDown 不同步而失败（Bug 1 根因）。
    if (this.screen === "home") this.device?.serial.resetEdges();

    if (!this.hardwareMode) return;
    if (this.screen === "play" || this.screen === "paused") this.setRecordFrozen(true);
    this.showDeviceToast(this.pausedByDisconnect ? "已重新连接，点 ▶ 继续" : "已重新连接", 0);
  }

  /** 下发/解除 record 冻结（锁定 S7 换挡/Fill、S8/编码器运输，防游戏中误触）。未连接时自动 no-op。 */
  private setRecordFrozen(armed: boolean): void {
    this.device?.link.sendRecord(armed);
  }

  private showDeviceToast(msg: string, ms = 2800): void {
    if (!this.deviceToast) return;
    this.deviceToast.textContent = msg;
    this.deviceToast.classList.add("show");
    if (this.toastTimer != null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (ms > 0) {
      this.toastTimer = window.setTimeout(() => {
        this.deviceToast.classList.remove("show");
        this.toastTimer = null;
      }, ms);
    }
  }

  private hideDeviceToast(): void {
    if (this.toastTimer != null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.deviceToast?.classList.remove("show");
  }

  /** 画布尺寸变化（DPR 感知）。渲染用 CSS 像素坐标系。 */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scene.resize(w, h);
  }

  // ===================== DOM =====================

  private buildDom(): void {
    this.overlay.innerHTML = "";

    // ---- 首页 / 选歌 ----
    const home = el("div", "screen screen-home");
    home.innerHTML = `
      <div class="home-inner">
        <h1 class="game-title">星空小鼓手</h1>
        <p class="subtitle">跟着节奏，一起敲鼓吧</p>
        <div class="song-row" data-song-row></div>
        <div class="diff-row" data-diff-row></div>
        <button class="btn btn-start" type="button" data-start>
          <span class="btn-ico">▶</span><span>开始</span>
        </button>
        <div class="device-dock" data-device-dock>
          <p class="mode-indicator" data-mode-indicator></p>
          <button class="btn btn-device" type="button" data-connect>
            <span class="btn-ico">🔌</span><span data-label>连接鼓板</span>
          </button>
          <p class="device-status" data-device-status><span class="dot"></span>未连接鼓板 · 也能用键盘玩</p>
          <p class="drum-mode-hint" data-drum-hint hidden>长按 S1+S5 进入游戏模式</p>
        </div>
      </div>
      <button class="icon-btn gear" type="button" data-settings title="家长设置">⚙</button>
    `;
    this.overlay.appendChild(home);
    this.screens.home = home;

    // 动态生成歌曲卡片
    const songRow = home.querySelector("[data-song-row]") as HTMLElement;
    this.songCards = SONGS.map((song, i) => {
      const isAvailable = song.hasAudio || song.id === "twinkle";
      const card = el("button", `song-card${i === 0 ? " active" : ""}${!isAvailable ? " locked" : ""}`);
      card.type = "button";
      if (!isAvailable) card.disabled = true;
      card.innerHTML = `
        <span class="song-ico">${song.icon}</span>
        <span class="song-name">${isAvailable ? song.title : "敬请期待"}</span>
        ${song.tag ? `<span class="song-tag">${song.tag}</span>` : ""}
      `;
      card.addEventListener("click", () => {
        if (!isAvailable) return;
        this.selectSong(i);
      });
      songRow.appendChild(card);
      return card;
    });

    // 难度按钮
    const diffRow = home.querySelector("[data-diff-row]") as HTMLElement;
    this.diffButtons = DIFFICULTIES.map((d) => {
      const b = el("button", "diff-btn", `<span class="diff-label">${DIFFICULTY_LABEL[d]}</span><span class="diff-bpm">${d==='easy'?'少量鼓点':d==='normal'?'跟着拍子':'节奏变化'}</span>`);
      b.type = "button";
      b.addEventListener("click", () => this.settings.update({ difficulty: d }));
      diffRow.appendChild(b);
      return b;
    });

    home.querySelector("[data-start]")!.addEventListener("click", () => void this.startGame());
    home.querySelector("[data-settings]")!.addEventListener("click", () => this.openSettings());

    // 阶段1B：设备连接坞（按钮 + 状态）
    this.deviceDock = home.querySelector("[data-device-dock]") as HTMLElement;
    this.connectBtn = home.querySelector("[data-connect]") as HTMLButtonElement;
    this.deviceStatus = home.querySelector("[data-device-status]") as HTMLElement;
    this.modeIndicator = home.querySelector("[data-mode-indicator]") as HTMLElement;
    this.drumModeHint = home.querySelector("[data-drum-hint]") as HTMLElement;
    this.connectBtn.addEventListener("click", () => void this.connectDevice());

    // ---- 游玩期顶部按钮条（回家 / 暂停）----
    this.hudBar = el("div", "hud-bar");
    this.hudBar.innerHTML = `
      <button class="icon-btn" type="button" data-home title="回家">🏠</button>
      <button class="icon-btn" type="button" data-pause title="暂停">⏸</button>
    `;
    this.overlay.appendChild(this.hudBar);
    this.hudBar.querySelector("[data-home]")!.addEventListener("click", () => this.goHome());
    this.hudBar.querySelector("[data-pause]")!.addEventListener("click", () => this.togglePause());

    // ---- 3-2-1 倒数（覆盖在游玩画面上）----
    this.countEl = el("div", "countdown");
    this.overlay.appendChild(this.countEl);

    // ---- 暂停面板 ----
    const paused = el("div", "screen screen-pause");
    paused.innerHTML = `
      <div class="panel">
        <h2 class="panel-title">休息一下</h2>
        <p class="panel-hint">长按 S7 也可继续</p>
        <button class="btn btn-primary" type="button" data-resume><span class="btn-ico">▶</span><span>继续</span></button>
        <button class="btn" type="button" data-retry><span class="btn-ico">↻</span><span>重来</span></button>
        <button class="btn" type="button" data-home2><span class="btn-ico">🏠</span><span>回家</span></button>
        <button class="btn btn-ghost" type="button" data-settings2><span class="btn-ico">⚙</span><span>设置</span></button>
      </div>
    `;
    this.overlay.appendChild(paused);
    this.screens.paused = paused;
    paused.querySelector("[data-resume]")!.addEventListener("click", () => this.togglePause());
    paused.querySelector("[data-retry]")!.addEventListener("click", () => void this.startGame());
    paused.querySelector("[data-home2]")!.addEventListener("click", () => this.goHome());
    paused.querySelector("[data-settings2]")!.addEventListener("click", () => this.openSettings());

    // ---- 结算 ----
    const result = el("div", "screen screen-result");
    result.innerHTML = `
      <div class="panel result-panel">
        <div class="result-stars" data-stars></div>
        <div class="result-msg" data-msg></div>
        <div class="result-score" data-score>0</div>
        <div class="result-combo" data-combo></div>
        <div class="result-btns">
          <button class="btn btn-primary" type="button" data-retry><span class="btn-ico">↻</span><span>再来一次</span></button>
          <button class="btn" type="button" data-home3><span class="btn-ico">🎵</span><span>换首歌</span></button>
        </div>
      </div>
    `;
    this.overlay.appendChild(result);
    this.screens.result = result;
    this.resultStars = result.querySelector("[data-stars]") as HTMLElement;
    this.resultMsg = result.querySelector("[data-msg]") as HTMLElement;
    this.resultScore = result.querySelector("[data-score]") as HTMLElement;
    this.resultCombo = result.querySelector("[data-combo]") as HTMLElement;
    result.querySelector("[data-retry]")!.addEventListener("click", () => void this.startGame());
    result.querySelector("[data-home3]")!.addEventListener("click", () => this.goHome());

    // ---- 家长设置弹窗（孩子主界面不暴露）----
    this.settingsModal = el("div", "modal");
    this.settingsModal.innerHTML = `
      <div class="panel settings-panel">
        <div class="settings-head">
          <h2 class="panel-title">家长设置</h2>
          <button class="settings-close" type="button" data-close-top aria-label="关闭设置">×</button>
        </div>
        <label class="set-row">
          <span>减少动效</span>
          <input type="checkbox" data-reduce />
        </label>
        <label class="set-row">
          <span>音量</span>
          <input type="range" min="0" max="100" step="1" data-volume />
        </label>
        <label class="set-row">
          <span>音频延迟校准</span>
          <input type="range" min="-200" max="200" step="5" data-calib />
          <output data-calib-out>0ms</output>
        </label>
        <p class="set-hint">校准：若感觉音符与声音不同步，左右微调直到舒服。</p>
        <div class="set-row set-row-col">
          <span>主题背景</span>
          <div class="theme-row" data-theme-row></div>
        </div>
        <button class="btn btn-primary" type="button" data-close>完成</button>
      </div>
    `;
    this.overlay.appendChild(this.settingsModal);
    this.wireSettings();

    // ---- 阶段1B：设备提示条（连接/断连/重连）----
    this.deviceToast = el("div", "device-toast");
    this.overlay.appendChild(this.deviceToast);
  }

  private wireSettings(): void {
    const m = this.settingsModal;
    const reduce = m.querySelector("[data-reduce]") as HTMLInputElement;
    const volume = m.querySelector("[data-volume]") as HTMLInputElement;
    const calib = m.querySelector("[data-calib]") as HTMLInputElement;
    const calibOut = m.querySelector("[data-calib-out]") as HTMLOutputElement;

    reduce.addEventListener("change", () => this.settings.update({ reduceMotion: reduce.checked }));
    volume.addEventListener("input", () =>
      this.settings.update({ volume: Number(volume.value) / 100 }),
    );
    calib.addEventListener("input", () => {
      const v = Number(calib.value);
      calibOut.textContent = `${v}ms`;
      this.settings.update({ calibrationMs: v });
    });
    m.querySelector("[data-close-top]")!.addEventListener("click", () => this.closeSettings());
    m.querySelector("[data-close]")!.addEventListener("click", () => this.closeSettings());
    m.addEventListener("click", (ev) => {
      if (ev.target === m) this.closeSettings();
    });

    // 用当前设置初始化控件
    const s = this.settings.get();
    reduce.checked = s.reduceMotion;
    volume.value = String(Math.round(s.volume * 100));
    calib.value = String(s.calibrationMs);
    calibOut.textContent = `${s.calibrationMs}ms`;

    // 主题卡片（动态生成）
    const themeRow = m.querySelector("[data-theme-row]") as HTMLElement;
    themeRow.innerHTML = "";
    for (const t of THEMES) {
      const card = document.createElement("div");
      card.className = "theme-card";
      card.dataset.theme = t.id;
      card.innerHTML = `<span class="theme-icon">${t.icon}</span><span class="theme-label">${t.label}</span>`;
      card.addEventListener("click", () => {
        this.settings.update({ theme: t.id });
        themeRow.querySelectorAll(".theme-card").forEach(c => c.classList.remove("active"));
        card.classList.add("active");
      });
      themeRow.appendChild(card);
    }
    // 初始化当前选中态
    this.syncThemeCards(themeRow, s.theme);
  }

  private openSettings(): void {
    const s = this.settings.get();
    const m = this.settingsModal;
    (m.querySelector("[data-reduce]") as HTMLInputElement).checked = s.reduceMotion;
    (m.querySelector("[data-volume]") as HTMLInputElement).value = String(Math.round(s.volume * 100));
    (m.querySelector("[data-calib]") as HTMLInputElement).value = String(s.calibrationMs);
    (m.querySelector("[data-calib-out]") as HTMLOutputElement).textContent = `${s.calibrationMs}ms`;
    // 同步主题卡片选中态
    const themeRow = m.querySelector("[data-theme-row]") as HTMLElement;
    this.syncThemeCards(themeRow, s.theme);
    m.classList.add("show");
    document.body.classList.add("settings-open");
    (m.querySelector("[data-close-top]") as HTMLButtonElement)?.focus();
  }

  /** 同步主题卡片的 active 类名。 */
  private syncThemeCards(row: HTMLElement, activeId: string): void {
    if (!row) return;
    row.querySelectorAll(".theme-card").forEach(c => {
      c.classList.toggle("active", (c as HTMLElement).dataset.theme === activeId);
    });
  }

  private closeSettings(): void {
    this.settingsModal.classList.remove("show");
    document.body.classList.remove("settings-open");
  }

  /** 设置变化 → 实时应用到场景/音频/UI。 */
  private applySettings(s: Settings): void {
    this.scene.setReduceMotion(s.reduceMotion);
    this.scene.setTheme(s.theme, { reduceMotion: s.reduceMotion });
    this.music.setVolume(s.volume);
    const cur = DIFFICULTIES.indexOf(s.difficulty);
    this.diffButtons.forEach((b, i) => b.classList.toggle("active", i === cur));
    document.body.classList.toggle("reduce-motion", s.reduceMotion);
  }

  // ===================== 屏幕切换 =====================

  private setScreen(name: ScreenName): void {
    this.screen = name;
    this.screens.home.classList.toggle("active", name === "home");
    this.screens.paused.classList.toggle("active", name === "paused");
    this.screens.result.classList.toggle("active", name === "result");
    this.hudBar.classList.toggle("active", name === "play" || name === "paused");
    if (name !== "play") this.countEl.classList.remove("show");
  }

  // ===================== 流程动作 =====================

  /** 选择歌曲：更新 active 状态。 */
  private selectSong(index: number): void {
    this.activeSong = SONGS[index];
    this.songCards.forEach((card, i) => card.classList.toggle("active", i === index));
  }

  private starting = false;
  private startGeneration = 0;

  private async startGame(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    const generation = ++this.startGeneration;
    const button = this.screens.home.querySelector('[data-start]') as HTMLButtonElement;
    const label = button.innerHTML;
    button.disabled = true;
    button.textContent = '歌曲加载中…';
    try {
      await this.prepareGame(generation);
    } catch (error) {
      if (generation !== this.startGeneration) return;
      this.music.stop();
      this.engine = null;
      this.setScreen('home');
      this.showDeviceToast('歌曲音频加载失败，请检查网络后重试', 5000);
      console.error('歌曲启动失败', error);
    } finally {
      this.starting = false;
      button.disabled = false;
      button.innerHTML = label;
    }
  }

  private async prepareGame(generation: number): Promise<void> {
    // 先停掉可能残留的旧音乐/排程（重来 / 回家后重开 / 结算后重开 均需干净起点）
    this.music.stop();

    const s = this.settings.get();
    let bpm = DIFFICULTY_BPM[s.difficulty];

    await this.music.unlock();
    if (generation !== this.startGeneration) return;
    this.music.setVolume(s.volume);

    // 动态加载谱面
    const song = this.activeSong;
    let chart: Chart;
    try {
      chart = await this.loadChartForSong(song);
    } catch (err) {
      console.error(`加载谱面失败: ${import.meta.env.BASE_URL}${song.chartPath}`, err);
      // 加载失败时用友好提示，不崩溃
      this.showDeviceToast(`歌曲加载失败，请检查文件是否存在`, 3000);
      return;
    }
    if (generation !== this.startGeneration) return;
    if(chart.meta.audioFile){bpm=chart.meta.bpm;chart=chartForDifficulty(chart,s.difficulty);}
    this.leadInMs = msPerBeat(bpm) * LEAD_IN_BEATS;
    this.chart = chart;
    this.music.setDrumKit(chart.meta.drumKit==='groove');
    this.scene.setLanes(chart.lanes);
    this.lengthBeats = chartLengthBeats(chart);

    this.endRequested = false;
    this.result = null;
    this.hitQueue.length = 0;
    this.scene.reset();
    this.lastSourceByLane = ["keyboard", "keyboard", "keyboard", "keyboard"];
    this.pausedByDisconnect = false;
    this.hideDeviceToast();
    // 开局若已连接硬件：进入「硬件鼓」模式（鼓声由板子喇叭本地发），并冻结 S7/S8/编码器防误触。
    this.hardwareMode = !!this.device?.link.getState().connected;
    if (this.hardwareMode) this.setRecordFrozen(true);

    this.engine = new GameEngine(
      chart,
      this.music,
      { bpm, calibrationMs: s.calibrationMs, leadInMs: this.leadInMs },
      {
        onHit: (note, grade) => {
          // 硬件鼓模式：命中来自板子(serial) 时鼓声已由板子本地发出，电脑端抑制合成鼓，避免双重发声。
          if (shouldPlaySynthDrum(this.lastSourceByLane[note.lane])) this.music.triggerDrum(note.lane, note.vel);
          this.scene.onHit(note.lane, grade as HitGrade);
          // 阶段3：敲对闪灯——不同判定等级不同颜色
          this.sendHitLed(grade as HitGrade);
        },
        onExtraTap: (lane) => {
          // 同理：空敲也只在非硬件来源时给合成反馈，不判罚。
          if (shouldPlaySynthDrum(this.lastSourceByLane[lane])) this.music.triggerDrum(lane, 48);
          this.scene.onExtraTap(lane);
        },
        onMiss: (note) => {
          this.music.triggerMiss();
          this.scene.onMiss(note.lane);
        },
        onCombo: (_combo, milestone) => {
          this.music.triggerCombo(milestone);
          this.scene.onCombo(milestone);
          // 阶段3：连击里程碑彩虹闪（红→绿→蓝，各 100ms）
          this.sendComboRainbowLed();
        },
        onEnd: (r) => {
          this.result = r;
          this.endRequested = true;
        },
      },
    );

    // 重置串口输入边沿基线：回家/结算后再开局时，已按住的键不会误判为按下沿，
    // 同时清除去重记录让 S1–S4 新一轮敲击立即可检测（Bug 4 修复）。
    this.device?.serial.resetEdges();

    // 获取 MP3 路径（如果有）
    const audioFile = chart.meta.audioFile;
    await this.music.play(bpm, this.lengthBeats, LEAD_IN_BEATS, audioFile);
    if (generation !== this.startGeneration) return;
    this.setScreen("play");
  }

  private togglePause(): void {
    if (this.screen === "play") {
      this.music.pause();
      this.setScreen("paused");
    } else if (this.screen === "paused") {
      this.music.resume();
      this.pausedByDisconnect = false;
      this.hideDeviceToast();
      this.setScreen("play");
    }
  }

  private goHome(): void {
    ++this.startGeneration;
    this.countEl.classList.remove('show');
    this.music.stop();
    this.setRecordFrozen(false); // 退出解除 S7/S8/编码器冻结
    this.hardwareMode = false;
    this.pausedByDisconnect = false;
    this.hideDeviceToast();
    this.engine = null;
    this.hitQueue.length = 0;
    this.closeSettings();
    this.setScreen("home");
  }

  // ===================== 阶段3：LED 灯带反馈 =====================

  /** 命中闪灯：太棒了=金色、很好=绿色、不错=蓝色，整条灯带 300ms 自动熄灭。 */
  private sendHitLed(grade: HitGrade): void {
    const link = this.device?.link;
    if (!link) return;
    let r: number, g: number, b: number;
    switch (grade) {
      case "great":  r = 255; g = 220; b = 100; break; // 金色
      case "good":   r = 100; g = 255; b = 150; break; // 绿色
      case "ok":     r = 100; g = 180; b = 255; break; // 蓝色
      default: return;
    }
    link.sendLed(-1, r, g, b, 300);
  }

  /** 连击里程碑彩虹闪：红→绿→蓝，各 100ms，总 300ms < 3Hz 红线。 */
  private sendComboRainbowLed(): void {
    const link = this.device?.link;
    if (!link) return;
    const steps: [number, number, number][] = [
      [255, 50, 50],   // 红
      [50, 255, 50],   // 绿
      [50, 100, 255],  // 蓝
    ];
    steps.forEach(([r, g, b], i) => {
      window.setTimeout(() => link.sendLed(-1, r, g, b, 100), i * 100);
    });
  }

  private goResult(): void {
    this.music.stop();
    this.setRecordFrozen(false); // 结束解除冻结
    this.hardwareMode = false;
    this.pausedByDisconnect = false;
    this.hideDeviceToast();
    const r = this.result;
    if (r) {
      this.resultStars.innerHTML = starsHtml(r.stars);
      this.resultMsg.textContent = encourageMessage(r.stars);
      this.resultScore.textContent = String(r.score);
      this.resultCombo.textContent = `最高连击 ${r.maxCombo}`;
      window.dispatchEvent(new CustomEvent('kele-drum-result', { detail: {
        songId: this.activeSong.id, songTitle: this.activeSong.title,
        difficulty: this.settings.get().difficulty,
        score: r.score, maxCombo: r.maxCombo, stars: r.stars,
      } }));
      // 结算小庆祝（柔和钟声 + 彩带），永远 ≥1 星。
      this.music.triggerCombo(50);
      this.scene.onCombo(50);
    }
    this.engine = null;
    this.setScreen("result");
  }

  private timingHits: HitEvent[] = [];
  /** Read-only recording diagnostics, exposed only with timingDebug URL flag. */
  timingSnapshot(){return {screen:this.screen,bpm:this.engine?.bpm,leadInMs:this.leadInMs,clockMs:this.music.nowMs(),score:this.engine?.score.score,notes:this.engine?.notes.slice(0,24).map(n=>({timeMs:n.timeMs,lane:n.lane,status:n.status})),hits:this.timingHits.map(h=>({...h}))};}
  private onInput(e: HitEvent): void {
    if (this.screen !== "play" || !this.engine) return;
    if(new URLSearchParams(location.search).has('timingDebug'))this.timingHits=[...this.timingHits.slice(-23),{...e}];
    if (this.hitQueue.length < 32) this.hitQueue.push(e);
  }

  // ===================== 主循环 =====================

  private frame = (tMs: number): void => {
    this.rafId = requestAnimationFrame(this.frame);
    const dt = this.lastFrameMs ? Math.min(0.05, (tMs - this.lastFrameMs) / 1000) : 0;
    this.lastFrameMs = tMs;
    this.tick(dt);
  };

  private tick(dt: number): void {
    const reduce = this.settings.get().reduceMotion;
    this.renderer.setHardwareMode(this.hardwareMode); // 硬件模式：受体只显鼓图标 + S1–S4

    if (this.screen === "home") {
      this.scene.setMusicBeat(null); // 未被音乐驱动 → 背景自走（小火车匀速前进）
      this.scene.update(dt, this.scene.targetScore, 0);
      this.renderer.draw(this.scene, [], this.hud(0, false), reduce, "idle");
      return;
    }

    if (this.screen === "result") {
      const r = this.result;
      this.scene.setMusicBeat(null);
      this.scene.update(dt, r ? r.score : this.scene.targetScore, r ? r.maxCombo : 0);
      this.renderer.draw(this.scene, [], this.hud(0, false), reduce, "result");
      return;
    }

    // play / paused
    const engine = this.engine;
    if (!engine) {
      this.scene.setMusicBeat(null);
      this.scene.update(dt, this.scene.targetScore, 0);
      this.renderer.draw(this.scene, [], this.hud(0, false), reduce, "idle");
      return;
    }

    if (this.screen === "play") {
      // 1) 喂输入（用音频时钟时间戳，逐条判定）
      for (const e of this.hitQueue) {
        // 先记录该轨道本次命中来源；handleHit 会同步触发 onHit/onExtraTap，回调据此决定是否发合成鼓。
        this.lastSourceByLane[e.lane] = e.source;
        engine.handleHit(e.lane, e.timeMs);
      }
      this.hitQueue.length = 0;
      // 2) 推进引擎（miss 检测 + 结束判定）
      engine.update();
    }

    // 3) 视觉推进 + 投影 + 渲染（暂停时 dt=0 冻结背景/烟雾/星点，游戏时间本就已冻结）
    // 枕木随音乐节拍滚动：把权威音频时钟的当前拍喂给背景（暂停时 Transport 冻结 → 枕木静止）。
    this.scene.setMusicBeat(engine.currentBeat());
    this.scene.update(this.screen === "paused" ? 0 : dt, engine.score.score, engine.score.combo);
    const now = engine.nowMs();
    const notes = projectNotes(engine.notes, this.scene.layout, this.scene.laneDefs, now);
    const progress = Math.max(0, Math.min(1, engine.currentBeat() / this.lengthBeats));
    this.renderer.draw(this.scene, notes, this.hud(engine.score.combo, true, progress), reduce, "play");

    // 4) 预备拍倒数（3-2-1）
    this.updateCountdown(now);

    // 5) 结束 → 结算
    if (this.endRequested && this.screen === "play") {
      this.endRequested = false;
      this.goResult();
    }
  }

  private updateCountdown(nowMs: number): void {
    const remainBeats = (this.leadInMs - nowMs) / msPerBeat(this.engine?.bpm ?? 84);
    if (remainBeats <= 0.02) {
      this.countEl.classList.remove("show");
      return;
    }
    const n = Math.ceil(remainBeats);
    this.countEl.textContent = n > 3 ? "准备～" : String(n);
    this.countEl.classList.add("show");
  }

  private hud(combo: number, showHud: boolean, progress = 0) {
    const s = this.settings.get();
    return {
      score: this.scene.displayScore,
      combo,
      songTitle: this.chart?.meta.title ?? this.activeSong.title,
      difficultyLabel: DIFFICULTY_LABEL[s.difficulty],
      progress,
      showHud,
    };
  }
}
