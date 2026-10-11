/**
 * TrainNightBackground：阶段1B 的「夜行小火车穿越星空山谷」横向视差背景。
 *
 * 全部纯 canvas 程序化绘制（圆/矩形/正弦山丘/渐变），不引 Pixi、不用 3D、不下载大图。
 *
 * 视差层次（滚动系数 = 相对「拍」的位移倍率，越近越快）：
 *  - 远景 0.1x：深蓝渐变夜空 + 笑脸月亮 + 缓慢闪烁星点（StarField，0.2–0.6Hz，<3Hz）；
 *  - 中景 0.3x：紫色正弦山丘剪影 + 零星呼吸的小灯塔（<3Hz）；
 *  - 近景 1.0x：高架铁轨 + 枕木（横带位于判定线以上 ~0.60h，避开底部受体/标签），
 *    枕木间距 = 一个 16 分步，随音乐节拍滚动（当「节拍尺」）；
 *  - 前景 1.5x：底部掠过的深色灌木剪影；卡通小火车（动物司机）锚定在高架轨道上，
 *    车轮随滚动转动、烟囱冒柔和烟、敲对时柔和跳一下（单次缓动 <3Hz）。
 *
 * 滚动来源：游玩期由 Scene.setMusicBeat(engine.currentBeat()) 经 setScrollBeats 驱动（与音乐同源）；
 * 首页/结算未被驱动时，update() 让 scrollBeats 缓慢自走，小火车像在匀速前进。
 *
 * 儿童红线：所有闪烁/呼吸/跳动频率 < 3Hz；「减少动效」下冻结视差滚动（含枕木节拍尺）、
 * 关掉自走漂移、烟雾、车轮转动、角色跳动与灯塔呼吸，只保留音符下落这一核心玩法。
 *
 * 性能：星空 ~90 点、枕木按屏宽 ~20–30 根、烟雾 ≤10 团、山丘按 12px 采样；天空渐变按高度缓存。
 */

import { clamp } from "../core/clock";
import { StarField, drawMoon, roundRect, defaultRng, type BackgroundLayer, type Rng } from "./effects";

interface Smoke {
  x: number;
  y: number;
  r: number;
  grow: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface Beacon {
  nx: number; // 归一化 x（0..1），随中景 0.3x 滚动
  ny: number; // 归一化 y
  phase: number;
}

export interface TrainBackgroundOptions {
  reduceMotion?: boolean;
  rng?: Rng;
  /** 自走（未被音乐节拍驱动）时模拟的 BPM，仅影响首页漂流感。默认 84。 */
  idleBpm?: number;
}

/** 正弦山丘在屏幕 x 处的高度（两层正弦叠加，自然起伏）。 */
function hillY(x: number, shift: number, baseY: number, amp: number, freq: number): number {
  const t = (x + shift) * freq;
  return baseY - amp * (Math.sin(t) * 0.62 + Math.sin(t * 2.3 + 1.7) * 0.38);
}

export class TrainNightBackground implements BackgroundLayer {
  private readonly stars: StarField;
  private readonly rng: Rng;
  private readonly beacons: Beacon[] = [];
  private readonly idleBpm: number;

  private w = 1;
  private h = 1;
  private sixteenthPx = 44; // 一个 16 分步 = 一根枕木的间距（节拍尺）
  private scrollBeats = 0; // 以「拍」为单位的滚动位置
  private driven = false; // true=音乐节拍驱动；false=自走漂移
  private reduceMotion: boolean;

  private wheelPhase = 0;
  private hopT = 99; // 命中跳动计时（秒）；>0.4 视为静止
  private hopStrength = 0;

  private smoke: Smoke[] = [];
  private smokeTimer = 0;

  // 天空渐变按高度缓存，避免每帧重建
  private skyGrad: CanvasGradient | null = null;
  private skyGradH = -1;

  constructor(opts: TrainBackgroundOptions = {}) {
    this.rng = opts.rng ?? defaultRng;
    this.reduceMotion = !!opts.reduceMotion;
    this.idleBpm = opts.idleBpm ?? 84;
    this.stars = new StarField(90, this.rng);
    for (let i = 0; i < 7; i++) {
      this.beacons.push({ nx: this.rng(), ny: 0.6 + this.rng() * 0.08, phase: this.rng() * Math.PI * 2 });
    }
  }

  // ---- BackgroundLayer 可选扩展 ----

  setScrollBeats(beats: number | null): void {
    if (beats == null || !Number.isFinite(beats)) {
      this.driven = false;
      return;
    }
    this.driven = true;
    this.scrollBeats = beats;
  }

  onHitPulse(strength: number): void {
    if (this.reduceMotion) return; // 减少动效：角色不跳
    this.hopT = 0;
    this.hopStrength = clamp(strength, 0, 1);
  }

  // ---- 主循环 ----

  update(dt: number, reduceMotion: boolean): void {
    this.reduceMotion = reduceMotion;
    this.stars.update(dt, reduceMotion);

    // 首页/结算（未被音乐驱动）时缓慢自走，模拟小火车匀速前进；减少动效则冻结。
    if (!this.driven && !reduceMotion) {
      this.scrollBeats += dt * (this.idleBpm / 60);
    }
    // 车轮随滚动转动（减少动效不转）。
    if (!reduceMotion) this.wheelPhase = this.scrollBeats * Math.PI * 2;

    this.hopT += dt;

    // 灯塔呼吸（<3Hz；减少动效静止）。
    if (!reduceMotion) for (const b of this.beacons) b.phase += dt * 1.1;

    this.updateSmoke(dt, reduceMotion);
  }

  private updateSmoke(dt: number, reduceMotion: boolean): void {
    if (reduceMotion) {
      this.smoke.length = 0;
      return;
    }
    // 行进时周期性冒烟（约 2.6 团/秒，低频、柔和）。
    this.smokeTimer += dt;
    if (this.smokeTimer > 0.38 && this.smoke.length < 10) {
      this.smokeTimer = 0;
      this.pendingPuff = true;
    }
    for (const s of this.smoke) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += s.grow * dt;
    }
    this.smoke = this.smoke.filter((s) => s.life > 0);
  }

  /** 由 draw 在知道烟囱世界坐标后置真，下一帧 update 落成一团烟。 */
  private pendingPuff = false;
  private chimneyWorld = { x: 0, y: 0 };

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.sixteenthPx = clamp(w / 22, 30, 56);
    const pxPerBeat = this.sixteenthPx * 4;
    // 减少动效：冻结所有视差滚动（含枕木节拍尺），只保留音符下落这一核心玩法；
    // 烟雾/车轮/角色跳动/灯塔呼吸/前景灌木也已在各自方法内收敛。
    const base = this.reduceMotion ? 0 : this.scrollBeats * pxPerBeat;
    const farShift = -base * 0.1;
    const midShift = -base * 0.3;
    const nearShift = -base * 1.0;
    const fgShift = -base * 1.5;

    this.drawSky(ctx, w, h);
    this.stars.draw(ctx, w, h, this.reduceMotion);
    drawMoon(ctx, w * 0.82 + farShift * 0.15, h * 0.15, Math.min(w, h) * 0.07);

    this.drawHills(ctx, w, h, farShift, h * 0.6, h * 0.06, 0.0042, "#272c60", null);
    this.drawHills(ctx, w, h, midShift, h * 0.68, h * 0.1, 0.0061, "#362c6b", this.beacons);
    this.drawGround(ctx, w, h);
    this.drawForegroundBushes(ctx, w, h, fgShift);

    // 高架铁轨横带放在「判定线以上」(0.60h)：受体圆圈 / 按键提示 / S1–S4 标签都在
    // ~0.76h 以下，因此火车与烟在任何滚动位置都不可能与其重叠；
    // 枕木仍随 nearShift(1.0x) 滚动，继续当节拍尺。
    const trackY = h * 0.6;
    this.drawTrack(ctx, w, h, nearShift, trackY);

    const trainX = clamp(w * 0.3, 130, w * 0.44);
    this.drawTrain(ctx, trainX, trackY);
    this.drawSmoke(ctx);
  }

  // ---- 各层绘制 ----

  private drawSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.skyGrad || this.skyGradH !== Math.round(h)) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#1b2a63");
      g.addColorStop(0.45, "#16204f");
      g.addColorStop(0.78, "#241f52");
      g.addColorStop(1, "#2c2459");
      this.skyGrad = g;
      this.skyGradH = Math.round(h);
    }
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, w, h);
  }

  private drawHills(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    shift: number,
    baseY: number,
    amp: number,
    freq: number,
    color: string,
    beacons: Beacon[] | null,
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    const step = 12;
    for (let x = 0; x <= w + step; x += step) {
      ctx.lineTo(x, hillY(x, shift, baseY, amp, freq));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    // 山脊柔光描边（同色系浅色，不用纯白）
    ctx.strokeStyle = "rgba(180,170,255,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 零星小灯塔（呼吸发光，<3Hz）
    if (beacons) {
      for (const b of beacons) {
        const bx = ((b.nx * w + shift) % (w + 60) + (w + 60)) % (w + 60) - 30;
        const by = hillY(bx, shift, baseY, amp, freq) - h * 0.012;
        const tw = this.reduceMotion ? 0.75 : 0.55 + 0.45 * Math.sin(b.phase);
        const r = Math.max(1.6, h * 0.004);
        const glow = ctx.createRadialGradient(bx, by, 0, bx, by, r * 5);
        glow.addColorStop(0, `rgba(255,230,160,${0.5 * tw})`);
        glow.addColorStop(1, "rgba(255,230,160,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(bx, by, r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,240,200,${0.85 * tw})`;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const y = h * 0.72;
    const g = ctx.createLinearGradient(0, y, 0, h);
    g.addColorStop(0, "#221c4d");
    g.addColorStop(1, "#161136");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, h - y);
  }

  /** 近景铁轨 + 枕木：枕木间距 = 一个 16 分步，随 nearShift 滚动（节拍尺）。 */
  private drawTrack(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    nearShift: number,
    trackY: number,
  ): void {
    const sp = this.sixteenthPx;
    const sleeperH = Math.max(10, h * 0.028);
    const sleeperW = Math.max(7, sp * 0.34);
    ctx.save();
    // 道砟床
    ctx.fillStyle = "rgba(20,16,48,0.85)";
    roundRect(ctx, 0, trackY - sleeperH * 0.2, w, sleeperH * 1.7, sleeperH * 0.5);
    ctx.fill();
    // 枕木（滚动）
    const startX = -(((nearShift % sp) + sp) % sp) - sp;
    ctx.fillStyle = "#4b3f72";
    for (let x = startX; x < w + sp; x += sp) {
      roundRect(ctx, x, trackY - sleeperH * 0.1, sleeperW, sleeperH, sleeperW * 0.4);
      ctx.fill();
    }
    // 两根钢轨（横向亮线）
    ctx.strokeStyle = "#8b90cf";
    ctx.lineWidth = Math.max(2.5, h * 0.006);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, trackY - sleeperH * 0.12);
    ctx.lineTo(w, trackY - sleeperH * 0.12);
    ctx.stroke();
    ctx.strokeStyle = "rgba(160,168,230,0.5)";
    ctx.lineWidth = Math.max(1.5, h * 0.003);
    ctx.beginPath();
    ctx.moveTo(0, trackY + sleeperH * 0.55);
    ctx.lineTo(w, trackY + sleeperH * 0.55);
    ctx.stroke();
    ctx.restore();
  }

  /** 前景深色灌木剪影（1.5x，最快），掠过画面最底部增加纵深。 */
  private drawForegroundBushes(ctx: CanvasRenderingContext2D, w: number, h: number, fgShift: number): void {
    if (this.reduceMotion) return; // 减少动效：不画快速前景
    const y = h * 0.985;
    const gap = w / 5;
    ctx.save();
    ctx.fillStyle = "rgba(12,9,32,0.72)";
    const off = -(((fgShift % gap) + gap) % gap);
    for (let x = off - gap; x < w + gap; x += gap) {
      const r = h * 0.05;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.3, r, 0, Math.PI, 0);
      ctx.ellipse(x + r * 0.9, y, r * 0.9, r * 0.75, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 卡通小火车（动物司机）+ 车厢，锚定在轨道上；敲对时柔和跳一下。 */
  private drawTrain(ctx: CanvasRenderingContext2D, trainX: number, trackY: number): void {
    const S = clamp(Math.min(this.w, this.h) * 0.12, 56, 120);
    // 命中柔和跳动：单次 0.4s 缓动（约 2.5Hz 上限，<3Hz），幅度小、不刺眼。
    let hop = 0;
    if (!this.reduceMotion && this.hopT < 0.4) {
      const t = this.hopT / 0.4;
      hop = -Math.sin(t * Math.PI) * (S * 0.05 + this.hopStrength * S * 0.07);
    }
    // 行驶中的轻微上下颤动（低频，<3Hz）
    const chug = this.reduceMotion ? 0 : Math.sin(this.scrollBeats * Math.PI * 2) * S * 0.012;

    ctx.save();
    ctx.translate(trainX, trackY + hop + chug);
    const wheelR = S * 0.15;
    const wheelY = -wheelR;

    // 车厢（在机车左侧/后方）
    this.drawCarriage(ctx, S, wheelR, wheelY);
    // 连接钩
    ctx.strokeStyle = "#3a3560";
    ctx.lineWidth = Math.max(2, S * 0.03);
    ctx.beginPath();
    ctx.moveTo(-S * 0.62, -S * 0.34);
    ctx.lineTo(-S * 0.9, -S * 0.34);
    ctx.stroke();

    // ---- 机车 ----
    const body = "#ffb0d0";
    const bodyDark = "#d9799f";
    // 锅炉
    ctx.lineJoin = "round";
    this.candy(ctx, body, bodyDark, S * 0.05);
    roundRect(ctx, -S * 0.62, -S * 0.62, S * 1.18, S * 0.44, S * 0.16);
    ctx.fill();
    ctx.stroke();
    // 司机室
    this.candy(ctx, "#7cc5ff", "#5a9ad6", S * 0.05);
    roundRect(ctx, S * 0.14, -S * 0.98, S * 0.5, S * 0.6, S * 0.14);
    ctx.fill();
    ctx.stroke();
    // 车顶
    this.candy(ctx, "#ffe6a0", "#e0b558", S * 0.045);
    roundRect(ctx, S * 0.06, -S * 1.06, S * 0.66, S * 0.14, S * 0.07);
    ctx.fill();
    ctx.stroke();
    // 烟囱
    this.candy(ctx, "#ffe6a0", "#e0b558", S * 0.04);
    roundRect(ctx, -S * 0.5, -S * 0.92, S * 0.18, S * 0.32, S * 0.07);
    ctx.fill();
    ctx.stroke();
    // 记录烟囱世界坐标，供冒烟
    this.chimneyWorld = { x: trainX - S * 0.41, y: trackY + hop + chug - S * 0.94 };
    // 前灯（柔光）
    const lampX = -S * 0.62;
    const lampY = -S * 0.5;
    const lg = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, S * 0.3);
    lg.addColorStop(0, "rgba(255,240,190,0.75)");
    lg.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lampX, lampY, S * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.arc(lampX, lampY, S * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // 动物司机（探出司机室，轻轻摆动）
    this.drawDriver(ctx, S);

    // 车轮（3 个，随滚动转动）
    this.drawWheel(ctx, -S * 0.36, wheelY, wheelR);
    this.drawWheel(ctx, S * 0.02, wheelY, wheelR);
    this.drawWheel(ctx, S * 0.4, wheelY, wheelR * 0.82);

    ctx.restore();
  }

  private drawCarriage(ctx: CanvasRenderingContext2D, S: number, wheelR: number, wheelY: number): void {
    this.candy(ctx, "#74e0b8", "#4fbd97", S * 0.05);
    roundRect(ctx, -S * 1.62, -S * 0.72, S * 1.0, S * 0.52, S * 0.14);
    ctx.fill();
    ctx.stroke();
    // 车窗（暖光）
    ctx.fillStyle = "rgba(255,240,200,0.85)";
    for (let i = 0; i < 2; i++) {
      roundRect(ctx, -S * 1.5 + i * S * 0.44, -S * 0.62, S * 0.3, S * 0.26, S * 0.08);
      ctx.fill();
    }
    this.drawWheel(ctx, -S * 1.4, wheelY, wheelR * 0.86);
    this.drawWheel(ctx, -S * 0.86, wheelY, wheelR * 0.86);
  }

  private drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.save();
    ctx.translate(x, y);
    // 轮胎
    ctx.fillStyle = "#3a3560";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // 轮毂
    ctx.fillStyle = "#ffe6a0";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    // 辐条（随 wheelPhase 转动）
    ctx.strokeStyle = "rgba(255,230,160,0.85)";
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const a = this.wheelPhase + (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * r * 0.8, -Math.sin(a) * r * 0.8);
      ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 动物司机：圆润小熊头，探出司机室，轻轻摆动（<3Hz）。 */
  private drawDriver(ctx: CanvasRenderingContext2D, S: number): void {
    const bob = this.reduceMotion ? 0 : Math.sin(this.scrollBeats * Math.PI * 2 + 0.6) * S * 0.02;
    const cx = S * 0.38;
    const cy = -S * 0.92 + bob;
    const r = S * 0.17;
    ctx.save();
    // 耳朵
    ctx.fillStyle = "#e8c39a";
    ctx.beginPath();
    ctx.arc(cx - r * 0.75, cy - r * 0.7, r * 0.4, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.75, cy - r * 0.7, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // 头
    ctx.fillStyle = "#f6dcc0";
    ctx.strokeStyle = "#c9a37e";
    ctx.lineWidth = Math.max(1.5, S * 0.02);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 眼睛（温柔闭笑或圆点）
    ctx.fillStyle = "#4a4470";
    ctx.beginPath();
    ctx.arc(cx - r * 0.34, cy - r * 0.05, r * 0.1, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.34, cy - r * 0.05, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // 鼻嘴
    ctx.strokeStyle = "#4a4470";
    ctx.lineWidth = Math.max(1.2, S * 0.016);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.28, r * 0.26, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    // 腮红
    ctx.fillStyle = "rgba(255,150,170,0.5)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.55, cy + r * 0.22, r * 0.16, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.55, cy + r * 0.22, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSmoke(ctx: CanvasRenderingContext2D): void {
    // 落成一团新烟（在知道烟囱世界坐标之后）
    if (this.pendingPuff && !this.reduceMotion) {
      this.pendingPuff = false;
      this.smoke.push({
        x: this.chimneyWorld.x,
        y: this.chimneyWorld.y,
        r: Math.max(4, Math.min(this.w, this.h) * 0.012),
        grow: Math.min(this.w, this.h) * 0.02,
        vx: -18 - Math.random() * 12,
        vy: -22 - Math.random() * 10,
        life: 1.5,
        maxLife: 1.5,
      });
    }
    ctx.save();
    for (const s of this.smoke) {
      const a = clamp(s.life / s.maxLife, 0, 1) * 0.4;
      ctx.fillStyle = `rgba(226,224,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 设置糖果色填充 + 同色系深色描边（圆角、不用纯黑）。 */
  private candy(ctx: CanvasRenderingContext2D, fill: string, stroke: string, lw: number): void {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
  }
}
