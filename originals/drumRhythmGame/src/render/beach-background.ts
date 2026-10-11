/**
 * BeachBackground：「海边沙滩」横向视差背景。
 *
 * 视差层次：
 *  - 远景 0.1x：渐变蓝天 + 金黄色太阳 + 海鸥剪影（2-3 只缓慢飞翔）
 *  - 中景 0.3x：远海（深蓝波浪，正弦曲线 <1Hz）+ 地平线
 *  - 近景 1.0x：金黄色沙滩 + 贝壳/海星 + 小螃蟹（横向移动）
 *  - 前景 1.5x：白色浪花（泡沫效果，周期性涌上退去 <0.5Hz）
 *
 * 儿童红线：所有频率 < 3Hz；reduceMotion 冻结视差/粒子/动画。
 * 纯 canvas 程序化绘制，零外部资源。
 */

import { clamp } from "../core/clock";
import { type BackgroundLayer } from "./effects";

interface Seagull {
  nx: number;
  ny: number;
  speed: number;
  wingPhase: number;
}

interface Shell {
  nx: number;
  ny: number;
  type: "shell" | "starfish";
  size: number;
  color: string;
}

interface FoamPatch {
  nx: number;
  phase: number;
  width: number;
}

export interface BeachBackgroundOptions {
  reduceMotion?: boolean;
  idleBpm?: number;
}

export class BeachBackground implements BackgroundLayer {
  private readonly rng = Math.random;
  private readonly idleBpm: number;
  private reduceMotion: boolean;

  private scrollBeats = 0;
  private driven = false;

  private skyGrad: CanvasGradient | null = null;
  private skyGradH = -1;
  private seaGrad: CanvasGradient | null = null;
  private seaGradH = -1;

  private readonly seagulls: Seagull[] = [];
  private readonly shells: Shell[] = [];
  private readonly foamPatches: FoamPatch[] = [];

  private wavePhase = 0;
  private crabX = 0.5;
  private crabDir = 1;
  private hopT = 99;

  constructor(opts: BeachBackgroundOptions = {}) {
    this.reduceMotion = !!opts.reduceMotion;
    this.idleBpm = opts.idleBpm ?? 76;

    // 海鸥 3 只
    for (let i = 0; i < 3; i++) {
      this.seagulls.push({
        nx: this.rng(),
        ny: 0.1 + this.rng() * 0.15,
        speed: 8 + this.rng() * 12,
        wingPhase: this.rng() * Math.PI * 2,
      });
    }
    // 贝壳/海星 ~10
    const shellColors = ["#f0d8b0", "#e8c8a0", "#d4b090", "#f5e0c0"];
    for (let i = 0; i < 10; i++) {
      this.shells.push({
        nx: this.rng(),
        ny: 0.78 + this.rng() * 0.12,
        type: this.rng() < 0.5 ? "shell" : "starfish",
        size: 3 + this.rng() * 5,
        color: shellColors[Math.floor(this.rng() * shellColors.length)] ?? "#f0d8b0",
      });
    }
    // 浪花 ~8
    for (let i = 0; i < 8; i++) {
      this.foamPatches.push({
        nx: this.rng(),
        phase: this.rng() * Math.PI * 2,
        width: 0.06 + this.rng() * 0.08,
      });
    }
    this.crabX = 0.3 + this.rng() * 0.4;
  }

  setScrollBeats(beats: number | null): void {
    if (beats == null || !Number.isFinite(beats)) {
      this.driven = false;
      return;
    }
    this.driven = true;
    this.scrollBeats = beats;
  }

  onHitPulse(_strength: number): void {
    if (this.reduceMotion) return;
    this.hopT = 0;
  }

  update(dt: number, reduceMotion: boolean): void {
    this.reduceMotion = reduceMotion;

    if (!this.driven && !reduceMotion) {
      this.scrollBeats += dt * (this.idleBpm / 60);
    }

    this.hopT += dt;

    if (reduceMotion) return;

    // 海鸥
    for (const g of this.seagulls) {
      g.nx += g.speed * dt / 1000;
      g.wingPhase += dt * 2.5;
      if (g.nx > 1.2) g.nx = -0.2;
    }
    // 海浪
    this.wavePhase += dt * 1.2;
    // 螃蟹横向移动 <1Hz
    this.crabX += this.crabDir * dt * 0.02;
    if (this.crabX > 0.85) this.crabDir = -1;
    if (this.crabX < 0.15) this.crabDir = 1;
    // 浪花
    for (const f of this.foamPatches) {
      f.phase += dt * 0.8;
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
    this.drawSeagulls(ctx, w, h, farShift);
    this.drawSea(ctx, w, h, midShift);
    this.drawSand(ctx, w, h);
    this.drawShells(ctx, w, h, nearShift);
    this.drawCrab(ctx, w, h, nearShift);
    this.drawFoam(ctx, w, h, fgShift);
  }

  private drawSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.skyGrad || this.skyGradH !== Math.round(h)) {
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      g.addColorStop(0, "#3a8ad0");
      g.addColorStop(0.5, "#5aaae0");
      g.addColorStop(1, "#a0d4f0");
      this.skyGrad = g;
      this.skyGradH = Math.round(h);
    }
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, w, h * 0.55);
  }

  private drawSun(ctx: CanvasRenderingContext2D, w: number, h: number, farShift: number): void {
    const cx = w * 0.78 + farShift * 0.1;
    const cy = h * 0.12;
    const r = Math.min(w, h) * 0.06;
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.8);
    glow.addColorStop(0, "rgba(255,220,100,0.45)");
    glow.addColorStop(1, "rgba(255,220,100,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd633";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSeagulls(ctx: CanvasRenderingContext2D, w: number, h: number, farShift: number): void {
    ctx.save();
    ctx.strokeStyle = "#4a5a6a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const g of this.seagulls) {
      const gx = g.nx * w + farShift;
      const gy = g.ny * h;
      const wing = this.reduceMotion ? 0 : Math.sin(g.wingPhase) * 6;
      const span = 12;
      ctx.beginPath();
      ctx.moveTo(gx - span, gy + wing);
      ctx.quadraticCurveTo(gx - span * 0.3, gy - Math.abs(wing) * 0.5, gx, gy);
      ctx.quadraticCurveTo(gx + span * 0.3, gy - Math.abs(wing) * 0.5, gx + span, gy + wing);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSea(ctx: CanvasRenderingContext2D, w: number, h: number, midShift: number): void {
    const seaTop = h * 0.45;
    const seaBot = h * 0.65;
    if (!this.seaGrad || this.seaGradH !== Math.round(h)) {
      const g = ctx.createLinearGradient(0, seaTop, 0, seaBot);
      g.addColorStop(0, "#2a7ab8");
      g.addColorStop(0.5, "#3090d0");
      g.addColorStop(1, "#60b8e0");
      this.seaGrad = g;
      this.seaGradH = Math.round(h);
    }
    ctx.fillStyle = this.seaGrad;
    ctx.fillRect(0, seaTop, w, seaBot - seaTop);

    // 波浪线
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    for (let row = 0; row < 3; row++) {
      const ry = seaTop + (seaBot - seaTop) * (0.25 + row * 0.25);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const t = (x + midShift + row * 40) * 0.015 + this.wavePhase;
        const y = ry + Math.sin(t) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSand(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const y = h * 0.65;
    const g = ctx.createLinearGradient(0, y, 0, h);
    g.addColorStop(0, "#f0d890");
    g.addColorStop(0.3, "#e8c870");
    g.addColorStop(1, "#d4b060");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, h - y);
  }

  private drawShells(ctx: CanvasRenderingContext2D, w: number, h: number, nearShift: number): void {
    ctx.save();
    for (const s of this.shells) {
      const sx = ((s.nx * w + nearShift) % (w + 40) + (w + 40)) % (w + 40) - 20;
      const sy = s.ny * h;
      ctx.fillStyle = s.color;
      if (s.type === "shell") {
        // 螺旋贝壳
        ctx.beginPath();
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(160,120,80,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, s.size * 0.6, 0, Math.PI * 1.5);
        ctx.stroke();
      } else {
        // 海星（五角星）
        this.drawStarfish(ctx, sx, sy, s.size * 0.5, s.size, s.color);
      }
    }
    ctx.restore();
  }

  private drawStarfish(ctx: CanvasRenderingContext2D, cx: number, cy: number, innerR: number, outerR: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const ang = (Math.PI / 5) * i - Math.PI / 2;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawCrab(ctx: CanvasRenderingContext2D, w: number, h: number, nearShift: number): void {
    const cx = this.crabX * w + nearShift * 0.3;
    const cy = h * 0.85;
    const S = clamp(Math.min(w, h) * 0.03, 12, 30);
    ctx.save();
    ctx.translate(cx, cy);
    // 身体
    ctx.fillStyle = "#e05040";
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 1.2, S * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = "#2a2020";
    ctx.beginPath();
    ctx.arc(-S * 0.4, -S * 0.6, S * 0.15, 0, Math.PI * 2);
    ctx.arc(S * 0.4, -S * 0.6, S * 0.15, 0, Math.PI * 2);
    ctx.fill();
    // 钳子
    ctx.fillStyle = "#d04030";
    const clawAnim = this.reduceMotion ? 0 : Math.sin(this.wavePhase * 1.5) * 0.2;
    ctx.save();
    ctx.translate(-S * 1.2, -S * 0.2);
    ctx.rotate(-0.3 + clawAnim);
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 0.5, S * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(S * 1.2, -S * 0.2);
    ctx.rotate(0.3 - clawAnim);
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 0.5, S * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 腿（3 对）
    ctx.strokeStyle = "#c04030";
    ctx.lineWidth = Math.max(1.5, S * 0.12);
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const lx = -S * 0.6 + i * S * 0.6;
      const legAnim = this.reduceMotion ? 0 : Math.sin(this.wavePhase * 2 + i) * S * 0.1;
      ctx.beginPath();
      ctx.moveTo(lx - S * 0.3, S * 0.4);
      ctx.lineTo(lx - S * 0.6 + legAnim, S * 0.9);
      ctx.moveTo(lx + S * 0.3, S * 0.4);
      ctx.lineTo(lx + S * 0.6 - legAnim, S * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFoam(ctx: CanvasRenderingContext2D, w: number, h: number, fgShift: number): void {
    if (this.reduceMotion) return;
    ctx.save();
    const foamBaseY = h * 0.66;
    for (const f of this.foamPatches) {
      const fx = ((f.nx * w + fgShift) % (w + 60) + (w + 60)) % (w + 60) - 30;
      const advance = Math.sin(f.phase) * h * 0.03;
      const fy = foamBaseY + advance;
      const fw = f.width * w;
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(f.phase);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(fx, fy, fw, h * 0.012, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
