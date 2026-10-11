/**
 * 特效系统：星空闪烁、命中柔和爆发、连击彩带、判定文字浮出。
 *
 * 儿童红线：
 *  - 所有「闪烁/脉动」频率都 < 3Hz（星空默认 0.2–0.6Hz，且可用「减少动效」关掉）；
 *  - 特效柔和不刺眼：低饱和糖果色、圆润形状、快速淡出、无硬闪白；
 *  - 「减少动效」开启时：星空静止、彩带/粒子大幅精简或跳过。
 *
 * 全部为纯代码程序化生成，无外部美术素材。dt 一律用「秒」。
 */

import { clamp } from "../core/clock";

export type Rng = () => number;
export const defaultRng: Rng = () => Math.random();

type PShape = "circle" | "rect" | "star";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 剩余寿命（秒）
  maxLife: number;
  size: number;
  color: string;
  shape: PShape;
  rot: number;
  vrot: number;
  gravity: number;
}

function stepParticle(p: Particle, dt: number): void {
  p.life -= dt;
  p.vy += p.gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rot += p.vrot * dt;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const a = clamp(p.life / p.maxLife, 0, 1);
  ctx.save();
  ctx.globalAlpha = a * 0.9;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  if (p.shape === "rect") {
    const s = p.size;
    roundRect(ctx, -s / 2, -s / 2, s, s * 0.6, s * 0.28);
    ctx.fill();
  } else if (p.shape === "star") {
    drawStar(ctx, 0, 0, p.size * 0.6, p.size, 5);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 圆角矩形路径（禁尖角，圆角≥元素 20%）。 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 五角星路径（lane3 音符 / 彩带用）。 */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  points = 5,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---- 星空 ----

interface Star {
  nx: number; // 归一化坐标 0..1（resize 无需重算）
  ny: number;
  r: number;
  phase: number;
  speed: number; // 角速度，控制闪烁频率（<3Hz）
}

/** 程序化闪烁星点。闪烁用 sin 缓动，speed 控制在 0.2–0.6Hz。 */
export class StarField {
  private stars: Star[] = [];

  constructor(count: number, rng: Rng = defaultRng) {
    for (let i = 0; i < count; i++) {
      this.stars.push({
        nx: rng(),
        ny: rng() * 0.9,
        r: 0.6 + rng() * 1.8,
        phase: rng() * Math.PI * 2,
        // freq = speed / 2π → speed∈[0.4π,1.2π] ⇒ freq∈[0.2,0.6]Hz，远低于 3Hz
        speed: Math.PI * (0.4 + rng() * 0.8),
      });
    }
  }

  update(dt: number, reduceMotion: boolean): void {
    if (reduceMotion) return; // 静止
    for (const s of this.stars) s.phase += s.speed * dt;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, reduceMotion: boolean): void {
    ctx.save();
    for (const s of this.stars) {
      const tw = reduceMotion ? 0.7 : 0.55 + 0.45 * Math.sin(s.phase);
      ctx.globalAlpha = clamp(tw, 0, 1) * 0.9;
      ctx.fillStyle = "#fdf6d8";
      ctx.beginPath();
      ctx.arc(s.nx * w, s.ny * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---- 命中柔和爆发 ----

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

/** 命中特效：一圈柔和扩散环 + 少量上飘粒子。快速淡出，不刺眼。 */
export class HitBurst {
  private rings: Ring[] = [];
  private parts: Particle[] = [];

  spawn(
    x: number,
    y: number,
    color: string,
    strength: number,
    reduceMotion: boolean,
    rng: Rng = defaultRng,
  ): void {
    this.rings.push({
      x,
      y,
      r: 6,
      maxR: 34 + strength * 34,
      life: 0.42,
      maxLife: 0.42,
      color,
    });
    if (reduceMotion) return;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + rng() * 0.4;
      const sp = 40 + rng() * 60;
      this.parts.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 30,
        life: 0.4,
        maxLife: 0.4,
        size: 5 + strength * 5,
        color,
        shape: "circle",
        rot: 0,
        vrot: 0,
        gravity: 120,
      });
    }
  }

  update(dt: number): void {
    for (const r of this.rings) {
      r.life -= dt;
      const t = 1 - clamp(r.life / r.maxLife, 0, 1);
      r.r = 6 + (r.maxR - 6) * t;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const p of this.parts) stepParticle(p, dt);
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  clear(): void {
    this.rings = [];
    this.parts = [];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const r of this.rings) {
      const a = clamp(r.life / r.maxLife, 0, 1);
      ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 + a * 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.parts) drawParticle(ctx, p);
    ctx.restore();
  }
}

// ---- 连击彩带 ----

/** 连击里程碑彩带：从顶部洒落，柔和糖果色，圆角/星形。 */
export class Confetti {
  private parts: Particle[] = [];
  private readonly palette = ["#ffb0d0", "#7cc5ff", "#ffe6a0", "#74e0b8", "#c9b6ff"];

  burst(width: number, reduceMotion: boolean, rng: Rng = defaultRng, amount = 42): void {
    if (reduceMotion) return; // 减少动效：不放彩带
    const n = amount;
    for (let i = 0; i < n; i++) {
      const shape: PShape = rng() < 0.5 ? "rect" : rng() < 0.6 ? "star" : "circle";
      this.parts.push({
        x: rng() * width,
        y: -20 - rng() * 120,
        vx: (rng() - 0.5) * 40,
        vy: 60 + rng() * 90,
        life: 2.2 + rng() * 0.8,
        maxLife: 3,
        size: 8 + rng() * 8,
        color: this.palette[Math.floor(rng() * this.palette.length)] ?? "#ffffff",
        shape,
        rot: rng() * Math.PI,
        vrot: (rng() - 0.5) * 4,
        gravity: 30,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.parts) stepParticle(p, dt);
    this.parts = this.parts.filter((p) => p.life > 0 && p.y < 2000);
  }

  clear(): void {
    this.parts = [];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.parts) drawParticle(ctx, p);
  }
}

// ---- 判定文字浮出 ----

export interface PopupItem {
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
  big: boolean;
}

/** 判定文字（太棒了/很好/不错/加油）：上浮 + 淡出，少文字多颜色。 */
export class Popups {
  private items: PopupItem[] = [];

  spawn(text: string, x: number, y: number, color: string, big = false): void {
    this.items.push({ text, x, y, color, life: 0.75, maxLife: 0.75, big });
    if (this.items.length > 12) this.items.shift();
  }

  update(dt: number): void {
    for (const it of this.items) {
      it.life -= dt;
      it.y -= dt * 46;
    }
    this.items = this.items.filter((it) => it.life > 0);
  }

  clear(): void {
    this.items = [];
  }

  draw(ctx: CanvasRenderingContext2D, fontBig: string, fontSmall: string): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const it of this.items) {
      const t = clamp(it.life / it.maxLife, 0, 1);
      const pop = it.big ? 1 + (1 - t) * 0.15 : 1;
      ctx.globalAlpha = clamp(t * 1.3, 0, 1);
      ctx.font = it.big ? fontBig : fontSmall;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.scale(pop, pop);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(35,32,72,0.55)";
      ctx.strokeText(it.text, 0, 0);
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ---- 背景层（可替换：1A 夜空，1B 换成横向视差「夜行小火车穿越星空山谷」）----

/** 背景层接口：renderer 只依赖它，1B 直接换一个实现即可。 */
export interface BackgroundLayer {
  update(dt: number, reduceMotion: boolean): void;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  /**
   * 可选：由音乐节拍驱动横向滚动（「随音乐滚动的枕木节拍尺」）。
   * 传数字=以该拍位为滚动基准；传 null=释放为自走（首页/结算时缓慢漂移）。
   */
  setScrollBeats?(beats: number | null): void;
  /** 可选：命中时让角色柔和跳一下（单次缓动，<3Hz；减少动效下实现应忽略）。 */
  onHitPulse?(strength: number): void;
}

/** 画一轮带柔光与笑脸的月亮（程序化，可爱风）。 */
export function drawMoon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  // 月晕
  const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.4);
  glow.addColorStop(0, "rgba(255,238,190,0.32)");
  glow.addColorStop(1, "rgba(255,238,190,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  // 月面
  ctx.fillStyle = "#ffeec2";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // 环形山
  ctx.fillStyle = "rgba(226,201,150,0.7)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.32, cy - r * 0.18, r * 0.16, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.28, cy + r * 0.28, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // 笑脸（闭眼微笑，温柔）
  ctx.strokeStyle = "#8a7a4a";
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.lineCap = "round";
  const eyeY = cy - r * 0.1;
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, eyeY, r * 0.14, Math.PI * 0.15, Math.PI * 0.85);
  ctx.arc(cx + r * 0.3, eyeY, r * 0.14, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.16, r * 0.3, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
}

/** 1A 背景：夜空（深蓝渐变）+ 闪烁星点（<3Hz）+ 笑脸月亮。 */
export class StarNightBackground implements BackgroundLayer {
  private readonly stars: StarField;
  private reduceMotion = false;

  constructor(rng: Rng = defaultRng) {
    this.stars = new StarField(110, rng);
  }

  update(dt: number, reduceMotion: boolean): void {
    this.reduceMotion = reduceMotion;
    this.stars.update(dt, reduceMotion);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#26356f");
    g.addColorStop(0.5, "#16204f");
    g.addColorStop(1, "#0a1030");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 地平线柔光（山谷感占位）
    const horizon = ctx.createLinearGradient(0, h * 0.7, 0, h);
    horizon.addColorStop(0, "rgba(120,150,255,0)");
    horizon.addColorStop(1, "rgba(120,150,255,0.14)");
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);

    this.stars.draw(ctx, w, h, this.reduceMotion);
    drawMoon(ctx, w * 0.82, h * 0.16, Math.min(w, h) * 0.075);
  }
}
