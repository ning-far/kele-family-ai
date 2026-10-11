/**
 * DesertBackground：「沙漠骆驼」横向视差背景。
 *
 * 视差层次：
 *  - 远景 0.1x：橙红渐变天空 + 大太阳（金黄）+ 热浪纹（透明波纹）
 *  - 中景 0.3x：金黄色沙丘（bezier 多层叠加）+ 仙人掌剪影（2-3 棵）
 *  - 近景 1.0x：沙漠商路 + 骆驼队（2-3 只，简单卡通，腿部动画 <2Hz）
 *  - 前景 1.5x：热浪扭曲效果（透明正弦波纹缓慢波动）
 *
 * 儿童红线：所有频率 < 3Hz；reduceMotion 冻结视差/粒子/动画。
 * 纯 canvas 程序化绘制，零外部资源。
 */

import { clamp } from "../core/clock";
import { type BackgroundLayer } from "./effects";

interface Cactus {
  nx: number;
  h: number;
  armSide: number; // 1 = right, -1 = left
}

interface Camel {
  nx: number;
  size: number;
  legPhase: number;
}

export interface DesertBackgroundOptions {
  reduceMotion?: boolean;
  idleBpm?: number;
}

export class DesertBackground implements BackgroundLayer {
  private readonly rng = Math.random;
  private readonly idleBpm: number;
  private reduceMotion: boolean;

  private scrollBeats = 0;
  private driven = false;

  private skyGrad: CanvasGradient | null = null;
  private skyGradH = -1;

  private readonly cacti: Cactus[] = [];
  private readonly camels: Camel[] = [];

  private heatWavePhase = 0;
  private fgHeatPhase = 0;
  private hopT = 99;
  private hopStrength = 0;

  constructor(opts: DesertBackgroundOptions = {}) {
    this.reduceMotion = !!opts.reduceMotion;
    this.idleBpm = opts.idleBpm ?? 68;

    // 仙人掌 3 棵
    for (let i = 0; i < 3; i++) {
      this.cacti.push({
        nx: 0.2 + i * 0.3 + (this.rng() - 0.5) * 0.1,
        h: 0.08 + this.rng() * 0.06,
        armSide: this.rng() < 0.5 ? 1 : -1,
      });
    }
    // 骆驼队 3 只
    for (let i = 0; i < 3; i++) {
      this.camels.push({
        nx: 0.3 + i * 0.12,
        size: 0.9 + this.rng() * 0.2,
        legPhase: i * 0.8,
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

    // 热浪
    this.heatWavePhase += dt * 0.6;
    this.fgHeatPhase += dt * 0.8;
    // 骆驼腿部 <2Hz
    for (const c of this.camels) {
      c.legPhase += dt * 3.5;
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
    this.drawHeatWavesFar(ctx, w, h, farShift);
    this.drawDunes(ctx, w, h, midShift);
    this.drawCacti(ctx, w, h, midShift);
    this.drawGround(ctx, w, h);
    this.drawPath(ctx, w, h, nearShift);
    this.drawCamels(ctx, w, h, nearShift);
    this.drawHeatWavesFg(ctx, w, h, fgShift);
  }

  private drawSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.skyGrad || this.skyGradH !== Math.round(h)) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#c84420");
      g.addColorStop(0.3, "#e07030");
      g.addColorStop(0.6, "#f0a050");
      g.addColorStop(1, "#f8d080");
      this.skyGrad = g;
      this.skyGradH = Math.round(h);
    }
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, w, h);
  }

  private drawSun(ctx: CanvasRenderingContext2D, w: number, h: number, farShift: number): void {
    const cx = w * 0.75 + farShift * 0.08;
    const cy = h * 0.18;
    const r = Math.min(w, h) * 0.08;
    ctx.save();
    // 大光晕
    const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 3.5);
    glow.addColorStop(0, "rgba(255,210,80,0.5)");
    glow.addColorStop(0.5, "rgba(255,180,60,0.15)");
    glow.addColorStop(1, "rgba(255,180,60,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 3.5, 0, Math.PI * 2);
    ctx.fill();
    // 太阳
    ctx.fillStyle = "#ffc830";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawHeatWavesFar(ctx: CanvasRenderingContext2D, w: number, h: number, farShift: number): void {
    if (this.reduceMotion) return;
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    const baseY = h * 0.4;
    for (let row = 0; row < 3; row++) {
      const ry = baseY + row * h * 0.06;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const t = (x + farShift + row * 30) * 0.008 + this.heatWavePhase;
        const y = ry + Math.sin(t) * 4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawDunes(ctx: CanvasRenderingContext2D, w: number, h: number, midShift: number): void {
    // 远层沙丘
    ctx.save();
    ctx.fillStyle = "#e0a840";
    ctx.beginPath();
    ctx.moveTo(0, h);
    const baseY1 = h * 0.55;
    for (let x = 0; x <= w; x += 8) {
      const t = (x + midShift) * 0.003;
      const y = baseY1 - h * 0.08 * (Math.sin(t) * 0.5 + Math.sin(t * 2.2 + 1.5) * 0.5);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 近层沙丘
    ctx.fillStyle = "#d49830";
    ctx.beginPath();
    ctx.moveTo(0, h);
    const baseY2 = h * 0.65;
    for (let x = 0; x <= w; x += 8) {
      const t = (x + midShift * 1.2) * 0.004;
      const y = baseY2 - h * 0.06 * (Math.sin(t + 0.8) * 0.6 + Math.sin(t * 1.9 + 2.5) * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCacti(ctx: CanvasRenderingContext2D, w: number, h: number, midShift: number): void {
    ctx.save();
    const baseY = h * 0.68;
    for (const c of this.cacti) {
      const cx = ((c.nx * w + midShift) % (w + 60) + (w + 60)) % (w + 60) - 30;
      const ch = c.h * h;
      const cw = ch * 0.25;
      // 主干
      ctx.fillStyle = "#2a6a30";
      ctx.beginPath();
      ctx.moveTo(cx - cw * 0.5, baseY);
      ctx.lineTo(cx - cw * 0.4, baseY - ch);
      ctx.lineTo(cx + cw * 0.4, baseY - ch);
      ctx.lineTo(cx + cw * 0.5, baseY);
      ctx.closePath();
      ctx.fill();
      // 手臂
      const armY = baseY - ch * 0.6;
      const armLen = cw * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + c.armSide * cw * 0.4, armY);
      ctx.lineTo(cx + c.armSide * (cw * 0.4 + armLen), armY);
      ctx.lineTo(cx + c.armSide * (cw * 0.4 + armLen), armY - armLen * 0.6);
      ctx.lineTo(cx + c.armSide * (cw * 0.4 + armLen * 0.6), armY - armLen * 0.6);
      ctx.lineTo(cx + c.armSide * (cw * 0.4 + armLen * 0.6), armY + cw * 0.15);
      ctx.lineTo(cx + c.armSide * cw * 0.4, armY + cw * 0.15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const y = h * 0.7;
    const g = ctx.createLinearGradient(0, y, 0, h);
    g.addColorStop(0, "#c88828");
    g.addColorStop(0.5, "#b87820");
    g.addColorStop(1, "#a06818");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, h - y);
  }

  private drawPath(ctx: CanvasRenderingContext2D, w: number, h: number, nearShift: number): void {
    ctx.save();
    const baseY = h * 0.8;
    ctx.fillStyle = "rgba(180,140,90,0.5)";
    ctx.beginPath();
    ctx.moveTo(0, baseY + h * 0.03);
    for (let x = 0; x <= w; x += 10) {
      const t = (x + nearShift) * 0.003;
      const y = baseY + Math.sin(t) * h * 0.015;
      ctx.lineTo(x, y);
    }
    for (let x = w; x >= 0; x -= 10) {
      const t = (x + nearShift) * 0.003;
      const y = baseY + h * 0.05 + Math.sin(t) * h * 0.01;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCamels(ctx: CanvasRenderingContext2D, w: number, h: number, nearShift: number): void {
    for (let i = 0; i < this.camels.length; i++) {
      const c = this.camels[i];
      const cx = c.nx * w + nearShift * 0.4;
      const cy = h * 0.78;
      const S = clamp(Math.min(w, h) * 0.07 * c.size, 30, 70);
      this.drawCamel(ctx, cx, cy, S, c.legPhase, i === 0);
    }
  }

  private drawCamel(ctx: CanvasRenderingContext2D, cx: number, cy: number, S: number, legPhase: number, isLeader: boolean): void {
    // 命中跳动（仅领头骆驼）
    let hop = 0;
    if (isLeader && !this.reduceMotion && this.hopT < 0.4) {
      const t = this.hopT / 0.4;
      hop = -Math.sin(t * Math.PI) * (S * 0.05 + this.hopStrength * S * 0.07);
    }

    ctx.save();
    ctx.translate(cx, cy + hop);

    // 身体
    ctx.fillStyle = "#a07040";
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.45, S * 0.5, S * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // 驼峰
    ctx.beginPath();
    ctx.ellipse(-S * 0.1, -S * 0.65, S * 0.15, S * 0.12, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(S * 0.15, -S * 0.63, S * 0.13, S * 0.1, 0, Math.PI, 0);
    ctx.fill();

    // 脖子
    ctx.fillStyle = "#906838";
    ctx.beginPath();
    ctx.moveTo(S * 0.4, -S * 0.5);
    ctx.quadraticCurveTo(S * 0.55, -S * 0.8, S * 0.5, -S * 0.95);
    ctx.lineTo(S * 0.42, -S * 0.95);
    ctx.quadraticCurveTo(S * 0.45, -S * 0.75, S * 0.32, -S * 0.5);
    ctx.closePath();
    ctx.fill();

    // 头
    ctx.fillStyle = "#a07040";
    ctx.beginPath();
    ctx.ellipse(S * 0.48, -S * 1.0, S * 0.12, S * 0.08, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#2a2020";
    ctx.beginPath();
    ctx.arc(S * 0.54, -S * 1.02, S * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // 腿（4 条，行走动画 <2Hz）
    ctx.strokeStyle = "#8a6030";
    ctx.lineWidth = Math.max(2, S * 0.06);
    ctx.lineCap = "round";
    const legLen = S * 0.35;
    const legXs = [-S * 0.3, -S * 0.12, S * 0.12, S * 0.3];
    for (let i = 0; i < 4; i++) {
      const phase = this.reduceMotion ? 0 : Math.sin(legPhase + i * Math.PI * 0.5) * S * 0.06;
      const lx = legXs[i];
      ctx.beginPath();
      ctx.moveTo(lx, -S * 0.25);
      ctx.lineTo(lx + phase, -S * 0.25 + legLen);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawHeatWavesFg(ctx: CanvasRenderingContext2D, w: number, h: number, fgShift: number): void {
    if (this.reduceMotion) return;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    const baseY = h * 0.85;
    for (let row = 0; row < 2; row++) {
      const ry = baseY + row * h * 0.05;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const t = (x + fgShift + row * 50) * 0.01 + this.fgHeatPhase;
        const y = ry + Math.sin(t) * 5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
