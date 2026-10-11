/**
 * PrairieBackground：「草原小马」横向视差背景。
 *
 * 视差层次：
 *  - 远景 0.1x：浅蓝天空 + 白色云朵（3-5 朵缓慢飘动）+ 暖色太阳
 *  - 中景 0.3x：绿色起伏草原（bezier）+ 彩色小花点缀
 *  - 近景 1.0x：草地小路 + 奔跑的小马（卡通几何，腿部动画 <3Hz）
 *  - 前景 1.5x：高草丛（细长三角形，随风摆动）
 *
 * 儿童红线：所有频率 < 3Hz；reduceMotion 冻结视差/粒子/动画。
 * 纯 canvas 程序化绘制，零外部资源。
 */

import { clamp } from "../core/clock";
import { type BackgroundLayer } from "./effects";

interface Cloud {
  nx: number;
  ny: number;
  w: number;
  h: number;
  speed: number;
}

interface Flower {
  nx: number;
  color: string;
  size: number;
}

interface GrassBlade {
  nx: number;
  h: number;
  phase: number;
}

export interface PrairieBackgroundOptions {
  reduceMotion?: boolean;
  idleBpm?: number;
}

export class PrairieBackground implements BackgroundLayer {
  private readonly rng = Math.random;
  private readonly idleBpm: number;
  private reduceMotion: boolean;

  private scrollBeats = 0;
  private driven = false;

  private skyGrad: CanvasGradient | null = null;
  private skyGradH = -1;

  private readonly clouds: Cloud[] = [];
  private readonly flowers: Flower[] = [];
  private readonly grassBlades: GrassBlade[] = [];

  private legPhase = 0;
  private hopT = 99;
  private hopStrength = 0;

  constructor(opts: PrairieBackgroundOptions = {}) {
    this.reduceMotion = !!opts.reduceMotion;
    this.idleBpm = opts.idleBpm ?? 80;

    // 云朵 4 朵
    for (let i = 0; i < 4; i++) {
      this.clouds.push({
        nx: this.rng(),
        ny: 0.08 + this.rng() * 0.15,
        w: 0.08 + this.rng() * 0.06,
        h: 0.025 + this.rng() * 0.015,
        speed: 3 + this.rng() * 5,
      });
    }
    // 花朵 ~20
    const flowerColors = ["#e85050", "#f0c040", "#b060d0", "#e87090", "#f0a030"];
    for (let i = 0; i < 20; i++) {
      this.flowers.push({
        nx: this.rng(),
        color: flowerColors[Math.floor(this.rng() * flowerColors.length)] ?? "#e85050",
        size: 2 + this.rng() * 3,
      });
    }
    // 前景草丛 ~18
    for (let i = 0; i < 18; i++) {
      this.grassBlades.push({
        nx: this.rng(),
        h: 0.04 + this.rng() * 0.05,
        phase: this.rng() * Math.PI * 2,
      });
    }
  }

  setScrollBeats(beats: number | null): void {
    if (beats == null || !Number.isFinite(beats)) {
      this.driven = false;
      return;
    }
    this.driven = true;
    this.scrollBeats = beats;
  }

  onHitPulse(strength: number): void {
    if (this.reduceMotion) return;
    this.hopT = 0;
    this.hopStrength = clamp(strength, 0, 1);
  }

  update(dt: number, reduceMotion: boolean): void {
    this.reduceMotion = reduceMotion;

    if (!this.driven && !reduceMotion) {
      this.scrollBeats += dt * (this.idleBpm / 60);
    }

    this.hopT += dt;

    if (reduceMotion) return;

    // 云朵飘动
    for (const c of this.clouds) {
      c.nx += c.speed * dt / 1000;
      if (c.nx > 1.15) c.nx = -0.15;
    }
    // 小马腿部动画 <2Hz
    this.legPhase += dt * 4.5;
    // 草丛摆动
    for (const g of this.grassBlades) {
      g.phase += dt * 1.8;
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const pxPerBeat = clamp(w / 22, 30, 56) * 4;
    const base = this.reduceMotion ? 0 : this.scrollBeats * pxPerBeat;
    const farShift = -base * 0.1;
    const midShift = -base * 0.3;
    const nearShift = -base * 1.0;
    const fgShift = -base * 1.5;

    this.drawSky(ctx, w, h);
    this.drawSun(ctx, w, h, farShift);
    this.drawClouds(ctx, w, h, farShift);
    this.drawHills(ctx, w, h, midShift);
    this.drawFlowers(ctx, w, h, midShift);
    this.drawGround(ctx, w, h);
    this.drawPath(ctx, w, h, nearShift);
    this.drawPony(ctx, w, h, nearShift);
    this.drawGrassBlades(ctx, w, h, fgShift);
  }

  private drawSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.skyGrad || this.skyGradH !== Math.round(h)) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#6ab4e8");
      g.addColorStop(0.45, "#8ecaf0");
      g.addColorStop(0.75, "#b8ddf5");
      g.addColorStop(1, "#d4ecfa");
      this.skyGrad = g;
      this.skyGradH = Math.round(h);
    }
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, w, h);
  }

  private drawSun(ctx: CanvasRenderingContext2D, w: number, h: number, farShift: number): void {
    const cx = w * 0.82 + farShift * 0.1;
    const cy = h * 0.13;
    const r = Math.min(w, h) * 0.06;
    ctx.save();
    // 光晕
    const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.5);
    glow.addColorStop(0, "rgba(255,230,140,0.4)");
    glow.addColorStop(1, "rgba(255,230,140,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    // 太阳
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawClouds(ctx: CanvasRenderingContext2D, w: number, h: number, farShift: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const c of this.clouds) {
      const cx = c.nx * w + farShift;
      const cy = c.ny * h;
      const cw = c.w * w;
      const ch = c.h * h;
      // 椭圆组合
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw * 0.5, ch, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - cw * 0.3, cy + ch * 0.2, cw * 0.35, ch * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + cw * 0.3, cy + ch * 0.15, cw * 0.3, ch * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawHills(ctx: CanvasRenderingContext2D, w: number, h: number, midShift: number): void {
    const baseY = h * 0.62;
    ctx.save();
    // 远层草原（浅绿）
    ctx.fillStyle = "#6abf6a";
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const t = (x + midShift) * 0.005;
      const y = baseY - h * 0.08 * (Math.sin(t) * 0.6 + Math.sin(t * 2.1 + 1) * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 近层草原（深绿）
    ctx.fillStyle = "#4da64d";
    ctx.beginPath();
    ctx.moveTo(0, h);
    const nearBaseY = h * 0.7;
    for (let x = 0; x <= w; x += 8) {
      const t = (x + midShift * 1.3) * 0.006;
      const y = nearBaseY - h * 0.05 * (Math.sin(t) * 0.5 + Math.sin(t * 1.8 + 2) * 0.5);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawFlowers(ctx: CanvasRenderingContext2D, w: number, h: number, midShift: number): void {
    ctx.save();
    const baseY = h * 0.72;
    for (const f of this.flowers) {
      const fx = ((f.nx * w + midShift) % (w + 40) + (w + 40)) % (w + 40) - 20;
      const fy = baseY + (f.nx * 30) % (h * 0.08);
      // 茎
      ctx.strokeStyle = "#3a8a3a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - f.size * 3);
      ctx.stroke();
      // 花朵
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(fx, fy - f.size * 3, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const y = h * 0.72;
    const g = ctx.createLinearGradient(0, y, 0, h);
    g.addColorStop(0, "#5aad5a");
    g.addColorStop(0.4, "#4a9a4a");
    g.addColorStop(1, "#3a7a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, h - y);
  }

  private drawPath(ctx: CanvasRenderingContext2D, w: number, h: number, nearShift: number): void {
    ctx.save();
    const baseY = h * 0.82;
    ctx.fillStyle = "#b08850";
    ctx.beginPath();
    ctx.moveTo(0, baseY + h * 0.04);
    for (let x = 0; x <= w; x += 10) {
      const t = (x + nearShift) * 0.004;
      const y = baseY + Math.sin(t) * h * 0.02;
      ctx.lineTo(x, y);
    }
    for (let x = w; x >= 0; x -= 10) {
      const t = (x + nearShift) * 0.004;
      const y = baseY + h * 0.06 + Math.sin(t) * h * 0.015;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawPony(ctx: CanvasRenderingContext2D, w: number, h: number, nearShift: number): void {
    const ponyX = w * 0.35 + nearShift * 0.2;
    const ponyY = h * 0.78;
    const S = clamp(Math.min(w, h) * 0.09, 40, 90);

    // 命中跳动
    let hop = 0;
    if (!this.reduceMotion && this.hopT < 0.4) {
      const t = this.hopT / 0.4;
      hop = -Math.sin(t * Math.PI) * (S * 0.06 + this.hopStrength * S * 0.08);
    }

    ctx.save();
    ctx.translate(ponyX, ponyY + hop);

    // 身体（椭圆）
    ctx.fillStyle = "#e8a050";
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.4, S * 0.45, S * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c07830";
    ctx.lineWidth = Math.max(1.5, S * 0.02);
    ctx.stroke();

    // 头
    ctx.fillStyle = "#e8a050";
    ctx.beginPath();
    ctx.ellipse(S * 0.45, -S * 0.6, S * 0.2, S * 0.18, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 眼睛
    ctx.fillStyle = "#3a3040";
    ctx.beginPath();
    ctx.arc(S * 0.52, -S * 0.65, S * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.fillStyle = "#d89040";
    ctx.beginPath();
    ctx.moveTo(S * 0.38, -S * 0.75);
    ctx.lineTo(S * 0.42, -S * 0.92);
    ctx.lineTo(S * 0.48, -S * 0.75);
    ctx.closePath();
    ctx.fill();

    // 鬃毛
    ctx.fillStyle = "#8b5a2a";
    ctx.beginPath();
    ctx.ellipse(S * 0.3, -S * 0.7, S * 0.08, S * 0.15, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // 尾巴
    ctx.strokeStyle = "#8b5a2a";
    ctx.lineWidth = Math.max(3, S * 0.05);
    ctx.lineCap = "round";
    const tailSwing = this.reduceMotion ? 0 : Math.sin(this.legPhase * 0.5) * S * 0.06;
    ctx.beginPath();
    ctx.moveTo(-S * 0.42, -S * 0.42);
    ctx.quadraticCurveTo(-S * 0.6 + tailSwing, -S * 0.3, -S * 0.55 + tailSwing, -S * 0.1);
    ctx.stroke();

    // 腿（4 条，奔跑动画 <2Hz）
    ctx.strokeStyle = "#d89040";
    ctx.lineWidth = Math.max(2.5, S * 0.06);
    const legLen = S * 0.3;
    const legBaseY = -S * 0.15;
    const legOffsets = [-S * 0.25, -S * 0.1, S * 0.1, S * 0.25];
    for (let i = 0; i < 4; i++) {
      const phase = this.reduceMotion ? 0 : Math.sin(this.legPhase + i * Math.PI * 0.5) * S * 0.08;
      const lx = legOffsets[i];
      ctx.beginPath();
      ctx.moveTo(lx, legBaseY);
      ctx.lineTo(lx + phase, legBaseY + legLen);
      ctx.stroke();
      // 蹄子
      ctx.fillStyle = "#5a3a1a";
      ctx.beginPath();
      ctx.arc(lx + phase, legBaseY + legLen, S * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawGrassBlades(ctx: CanvasRenderingContext2D, w: number, h: number, fgShift: number): void {
    if (this.reduceMotion) return;
    ctx.save();
    const baseY = h * 0.97;
    for (const g of this.grassBlades) {
      const gx = ((g.nx * w + fgShift) % (w + 30) + (w + 30)) % (w + 30) - 15;
      const gh = g.h * h;
      const sway = Math.sin(g.phase) * gh * 0.15;
      ctx.fillStyle = "#3a8a3a";
      ctx.beginPath();
      ctx.moveTo(gx - 3, baseY);
      ctx.lineTo(gx + sway, baseY - gh);
      ctx.lineTo(gx + 3, baseY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
