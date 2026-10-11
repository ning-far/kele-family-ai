/**
 * SnowWorldBackground：「冰天雪地」横向视差背景。
 *
 * 视差层次：
 *  - 远景 0.1x：灰蓝白天空 + 飘雪粒子（~60 白色小圆点）+ 冷色月亮
 *  - 中景 0.3x：白色雪山轮廓 + 深绿松树剪影
 *  - 近景 1.0x：冰面/雪地 + 卡通小木屋
 *  - 前景 1.5x：大雪花飘落（~15 个，缓慢旋转）
 *
 * 儿童红线：所有频率 < 3Hz；reduceMotion 冻结视差/粒子/动画。
 * 纯 canvas 程序化绘制，零外部资源。
 */

import { clamp } from "../core/clock";
import { type BackgroundLayer } from "./effects";

interface Snowflake {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  phase: number;
}

interface BigFlake {
  x: number;
  y: number;
  r: number;
  vy: number;
  rot: number;
  vrot: number;
  phase: number;
}

interface Tree {
  nx: number;
  h: number;
  w: number;
}

interface Mountain {
  nx: number;
  peakH: number;
  halfW: number;
}

export interface SnowBackgroundOptions {
  reduceMotion?: boolean;
  idleBpm?: number;
}

export class SnowWorldBackground implements BackgroundLayer {
  private readonly rng = Math.random;
  private readonly idleBpm: number;
  private reduceMotion: boolean;

  private scrollBeats = 0;
  private driven = false;

  // 天空渐变缓存
  private skyGrad: CanvasGradient | null = null;
  private skyGradH = -1;

  // 远景飘雪
  private readonly snowflakes: Snowflake[] = [];
  // 前景大雪花
  private readonly bigFlakes: BigFlake[] = [];
  // 中景山
  private readonly mountains: Mountain[] = [];
  // 中景树
  private readonly trees: Tree[] = [];

  // 命中脉冲
  private hopT = 99;

  constructor(opts: SnowBackgroundOptions = {}) {
    this.reduceMotion = !!opts.reduceMotion;
    this.idleBpm = opts.idleBpm ?? 72;

    // 初始化飘雪粒子 ~60
    for (let i = 0; i < 60; i++) {
      this.snowflakes.push({
        x: this.rng(),
        y: this.rng(),
        r: 1.2 + this.rng() * 2.5,
        vy: 12 + this.rng() * 18,
        vx: (this.rng() - 0.5) * 8,
        phase: this.rng() * Math.PI * 2,
      });
    }
    // 前景大雪花 ~15
    for (let i = 0; i < 15; i++) {
      this.bigFlakes.push({
        x: this.rng(),
        y: this.rng(),
        r: 4 + this.rng() * 6,
        vy: 18 + this.rng() * 14,
        rot: this.rng() * Math.PI * 2,
        vrot: (this.rng() - 0.5) * 0.8,
        phase: this.rng() * Math.PI * 2,
      });
    }
    // 山 3 座
    for (let i = 0; i < 3; i++) {
      this.mountains.push({
        nx: 0.15 + i * 0.35 + (this.rng() - 0.5) * 0.1,
        peakH: 0.25 + this.rng() * 0.15,
        halfW: 0.18 + this.rng() * 0.1,
      });
    }
    // 松树 7 棵
    for (let i = 0; i < 7; i++) {
      this.trees.push({
        nx: this.rng(),
        h: 0.06 + this.rng() * 0.05,
        w: 0.025 + this.rng() * 0.015,
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

    // 飘雪
    for (const s of this.snowflakes) {
      s.y += s.vy * dt;
      s.phase += dt * 1.2;
      s.x += (s.vx + Math.sin(s.phase) * 6) * dt;
      if (s.y > 1.05) { s.y = -0.05; s.x = this.rng(); }
      if (s.x > 1.1) s.x = -0.1;
      if (s.x < -0.1) s.x = 1.1;
    }
    // 大雪花
    for (const f of this.bigFlakes) {
      f.y += f.vy * dt;
      f.rot += f.vrot * dt;
      f.phase += dt * 0.9;
      f.x += Math.sin(f.phase) * 10 * dt;
      if (f.y > 1.05) { f.y = -0.05; f.x = this.rng(); }
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
    this.drawMoon(ctx, w, h, farShift);
    this.drawSnowflakes(ctx, w, h);
    this.drawMountains(ctx, w, h, midShift);
    this.drawTrees(ctx, w, h, midShift);
    this.drawGround(ctx, w, h);
    this.drawCabin(ctx, w, h, nearShift);
    this.drawBigFlakes(ctx, w, h, fgShift);
  }

  private drawSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.skyGrad || this.skyGradH !== Math.round(h)) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#5a7a9e");
      g.addColorStop(0.4, "#7a9ab8");
      g.addColorStop(0.75, "#a8bdd0");
      g.addColorStop(1, "#c8d8e4");
      this.skyGrad = g;
      this.skyGradH = Math.round(h);
    }
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, w, h);
  }

  private drawMoon(ctx: CanvasRenderingContext2D, w: number, h: number, farShift: number): void {
    const cx = w * 0.8 + farShift * 0.12;
    const cy = h * 0.14;
    const r = Math.min(w, h) * 0.055;
    ctx.save();
    // 月晕
    const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.2);
    glow.addColorStop(0, "rgba(200,220,240,0.3)");
    glow.addColorStop(1, "rgba(200,220,240,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    // 月面
    ctx.fillStyle = "#dce8f0";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSnowflakes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (const s of this.snowflakes) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(s.phase);
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMountains(ctx: CanvasRenderingContext2D, w: number, h: number, shift: number): void {
    ctx.save();
    for (const m of this.mountains) {
      const cx = m.nx * w + shift;
      const peakY = h * (1 - m.peakH);
      const hw = m.halfW * w;
      const baseY = h * 0.78;
      // 山体
      ctx.fillStyle = "#e8eef4";
      ctx.beginPath();
      ctx.moveTo(cx - hw, baseY);
      ctx.lineTo(cx, peakY);
      ctx.lineTo(cx + hw, baseY);
      ctx.closePath();
      ctx.fill();
      // 阴影面
      ctx.fillStyle = "rgba(160,185,210,0.35)";
      ctx.beginPath();
      ctx.moveTo(cx, peakY);
      ctx.lineTo(cx + hw, baseY);
      ctx.lineTo(cx + hw * 0.3, baseY);
      ctx.closePath();
      ctx.fill();
      // 雪顶
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.15, peakY + h * 0.03);
      ctx.lineTo(cx, peakY);
      ctx.lineTo(cx + hw * 0.15, peakY + h * 0.03);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawTrees(ctx: CanvasRenderingContext2D, w: number, h: number, shift: number): void {
    ctx.save();
    const baseY = h * 0.78;
    for (const t of this.trees) {
      const tx = t.nx * w + shift;
      const th = t.h * h;
      const tw = t.w * w;
      // 树干
      ctx.fillStyle = "#5a3a2a";
      ctx.fillRect(tx - tw * 0.12, baseY - th * 0.2, tw * 0.24, th * 0.25);
      // 三层三角
      ctx.fillStyle = "#2a5a3a";
      for (let layer = 0; layer < 3; layer++) {
        const ly = baseY - th * 0.15 - layer * th * 0.28;
        const lw = tw * (1 - layer * 0.2);
        ctx.beginPath();
        ctx.moveTo(tx - lw, ly);
        ctx.lineTo(tx, ly - th * 0.35);
        ctx.lineTo(tx + lw, ly);
        ctx.closePath();
        ctx.fill();
      }
      // 雪点缀
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let layer = 0; layer < 3; layer++) {
        const ly = baseY - th * 0.15 - layer * th * 0.28;
        const lw = tw * (1 - layer * 0.2) * 0.5;
        ctx.beginPath();
        ctx.moveTo(tx - lw, ly - th * 0.05);
        ctx.lineTo(tx, ly - th * 0.35);
        ctx.lineTo(tx + lw, ly - th * 0.05);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const y = h * 0.78;
    const g = ctx.createLinearGradient(0, y, 0, h);
    g.addColorStop(0, "#dce8f0");
    g.addColorStop(0.3, "#c8d8e4");
    g.addColorStop(1, "#b0c4d4");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, h - y);
    // 冰面高光
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, y, w, h * 0.02);
    ctx.restore();
  }

  private drawCabin(ctx: CanvasRenderingContext2D, w: number, h: number, nearShift: number): void {
    const cx = w * 0.65 + nearShift * 0.3;
    const baseY = h * 0.78;
    const S = clamp(Math.min(w, h) * 0.08, 30, 70);
    ctx.save();
    ctx.translate(cx, baseY);
    // 墙体
    ctx.fillStyle = "#8b6b4a";
    ctx.fillRect(-S * 0.6, -S * 0.8, S * 1.2, S * 0.8);
    // 屋顶
    ctx.fillStyle = "#6a3a2a";
    ctx.beginPath();
    ctx.moveTo(-S * 0.8, -S * 0.8);
    ctx.lineTo(0, -S * 1.4);
    ctx.lineTo(S * 0.8, -S * 0.8);
    ctx.closePath();
    ctx.fill();
    // 屋顶雪
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-S * 0.7, -S * 0.85);
    ctx.lineTo(0, -S * 1.35);
    ctx.lineTo(S * 0.7, -S * 0.85);
    ctx.closePath();
    ctx.fill();
    // 窗户（暖光）
    ctx.fillStyle = "rgba(255,220,150,0.85)";
    ctx.fillRect(-S * 0.35, -S * 0.65, S * 0.25, S * 0.25);
    ctx.fillRect(S * 0.1, -S * 0.65, S * 0.25, S * 0.25);
    // 门
    ctx.fillStyle = "#5a3020";
    ctx.fillRect(-S * 0.12, -S * 0.45, S * 0.24, S * 0.45);
    ctx.restore();
  }

  private drawBigFlakes(ctx: CanvasRenderingContext2D, w: number, h: number, fgShift: number): void {
    if (this.reduceMotion) return;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;
    for (const f of this.bigFlakes) {
      const fx = f.x * w + fgShift;
      const fy = f.y * h;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(f.rot);
      // 六角雪花
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const ex = Math.cos(ang) * f.r;
        const ey = Math.sin(ang) * f.r;
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // 小分支
        const mx = ex * 0.6;
        const my = ey * 0.6;
        const branchR = f.r * 0.3;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(ang + 0.6) * branchR, my + Math.sin(ang + 0.6) * branchR);
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(ang - 0.6) * branchR, my + Math.sin(ang - 0.6) * branchR);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
