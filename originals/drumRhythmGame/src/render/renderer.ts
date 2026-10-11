/**
 * Renderer：Canvas 2D 渲染器（纯绘制，读取 Scene + 投影后的音符 + HUD 状态）。
 *
 * 视觉规范（几何糖果风）：
 *  - 高明度中低饱和糖果色、圆角（≥元素 20%）、禁尖角（三角/星都用 round join 圆化）；
 *  - 同色系深色描边（darken()，不用纯黑）；
 *  - 判定线在 82% 高，柔和发光；受体（鼓垫）常驻，标注 S1–S4 + 键盘键 + 颜色 + 形状；
 *  - 色盲友好：颜色 + 形状双编码。
 *
 * 字体（阶段1B）：已去 Google CDN，改本地/系统圆体优先。拿到 OFL 圆体后放入 public/fonts/ 并启用 @font-face 即可。
 */

import type { LaneShape } from "../core/chart";
import { clamp } from "../core/clock";
import { drawStar, roundRect } from "./effects";
import type { NoteView, Scene } from "./scene";

const FONT_STACK =
  '"Baloo 2","ZCOOL KuaiLe","Yuanti SC","YouYuan","幼圆","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
const cnFont = (px: number, w = 400) => `${w} ${px}px ${FONT_STACK}`;

/** 受体上显示的键盘键（1A 用键盘；1B 换真机时这里换成只显示 S1–S4）。 */
const KEY_LABELS = ["D", "F", "J", "K"];

export interface HudState {
  score: number; // 已缓动的显示分（可含温和回滚）
  combo: number;
  songTitle: string;
  difficultyLabel: string;
  progress: number; // 0..1 整曲进度
  showHud: boolean;
}

/** 渲染阶段：决定画哪些子集（首页只要背景+吉祥物，结算只要背景+彩带）。 */
export type Stage = "idle" | "countdown" | "play" | "result";

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 同色系加深（描边用，避免纯黑）。 */
function darken(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  const d = (v: number) => Math.round(clamp(v * (1 - f), 0, 255));
  return `rgb(${d(r)},${d(g)},${d(b)})`;
}

function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export class Renderer {
  /** 硬件鼓模式：受体只显示鼓图标 + S1–S4，不显示键盘键（鼓声由板子喇叭本地发出）。 */
  private hardwareMode = false;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  setHardwareMode(v: boolean): void {
    this.hardwareMode = v;
  }

  draw(
    scene: Scene,
    notes: NoteView[],
    hud: HudState,
    reduceMotion: boolean,
    stage: Stage,
  ): void {
    const ctx = this.ctx;
    const { width: w, height: h } = scene.layout;
    ctx.clearRect(0, 0, w, h);

    // 背景层（1A 夜空；1B 可替换）
    scene.background.draw(ctx, w, h);

    // 连击欢呼时的全屏柔光脉动（低频，绝不快闪）
    if (scene.cheerPulse > 0) {
      const a = scene.cheerPulse * 0.16;
      const g = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, Math.max(w, h) * 0.7);
      g.addColorStop(0, `rgba(255,224,150,${a})`);
      g.addColorStop(1, "rgba(255,224,150,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    const field = stage === "countdown" || stage === "play";
    if (field) {
      this.drawLanes(scene);
      this.drawJudgeLine(scene, reduceMotion);
    }
    if (stage === "play") this.drawNotes(notes);
    if (field) this.drawReceptors(scene);

    scene.burst.draw(ctx);
    scene.confetti.draw(ctx);
    this.drawMascot(scene);
    scene.popups.draw(ctx, cnFont(46), cnFont(30));
    if (stage === "play" && hud.showHud) this.drawHud(scene, hud);
  }

  // ---- 轨道 ----
  private drawLanes(scene: Scene): void {
    const ctx = this.ctx;
    const { judgeY, spawnY } = scene.layout;
    for (let i = 0; i < scene.layout.lanes.length; i++) {
      const lane = scene.layout.lanes[i];
      if (!lane) continue;
      const def = scene.laneDefs[i];
      const color = def?.color ?? "#ffffff";
      const glow = scene.laneGlow[i] ?? 0;
      const top = Math.max(0, spawnY);
      const hgt = judgeY - top + 40;
      const g = ctx.createLinearGradient(0, top, 0, top + hgt);
      g.addColorStop(0, withAlpha(color, 0.02));
      g.addColorStop(0.75, withAlpha(color, 0.06 + glow * 0.16));
      g.addColorStop(1, withAlpha(color, 0.12 + glow * 0.22));
      ctx.fillStyle = g;
      const pad = lane.width * 0.12;
      roundRect(ctx, lane.left + pad, top, lane.width - pad * 2, hgt, lane.width * 0.22);
      ctx.fill();
    }
  }

  // ---- 判定线 ----
  private drawJudgeLine(scene: Scene, reduceMotion: boolean): void {
    const ctx = this.ctx;
    const { judgeY, fieldLeft, fieldRight } = scene.layout;
    ctx.save();
    const g = ctx.createLinearGradient(fieldLeft, 0, fieldRight, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,246,214,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 4;
    ctx.shadowColor = "rgba(255,236,180,0.9)";
    ctx.shadowBlur = reduceMotion ? 8 : 18;
    ctx.beginPath();
    ctx.moveTo(fieldLeft, judgeY);
    ctx.lineTo(fieldRight, judgeY);
    ctx.stroke();
    ctx.restore();
  }

  // ---- 下落音符 ----
  private drawNotes(notes: NoteView[]): void {
    const ctx = this.ctx;
    for (const nv of notes) {
      const missed = nv.state === "missed";
      const base = missed ? "#9aa0b5" : nv.color;
      const alpha = missed ? clamp(1.35 - nv.progress, 0, 1) * 0.75 : 1;
      const r = nv.radius;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (!missed) {
        ctx.shadowColor = withAlpha(nv.color, 0.6);
        ctx.shadowBlur = 14;
      }
      this.fillShape(nv.shape, nv.x, nv.y, r, base, missed ? "#6f7590" : darken(nv.color, 0.34));
      // 高光点，增加糖果质感
      if (!missed) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(nv.x - r * 0.28, nv.y - r * 0.3, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** 按形状填充（round join 圆化尖角）。 */
  private fillShape(
    shape: LaneShape,
    x: number,
    y: number,
    r: number,
    fill: string,
    outline: string,
  ): void {
    const ctx = this.ctx;
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, r * 0.28);
    ctx.strokeStyle = outline;
    ctx.fillStyle = fill;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (shape === "round") {
      roundRect(ctx, x - r, y - r, r * 2, r * 2, r * 0.42);
      ctx.fill();
      ctx.stroke();
    } else if (shape === "triangle") {
      ctx.beginPath();
      const h = r * 1.15;
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + r * 1.05, y + h * 0.72);
      ctx.lineTo(x - r * 1.05, y + h * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // star：圆化尖点
      drawStar(ctx, x, y, r * 0.52, r * 1.12, 5);
      ctx.fill();
      ctx.stroke();
    }
  }

  // ---- 受体（鼓垫，常驻）----
  private drawReceptors(scene: Scene): void {
    const ctx = this.ctx;
    const { judgeY } = scene.layout;
    for (let i = 0; i < scene.layout.lanes.length; i++) {
      const lane = scene.layout.lanes[i];
      const def = scene.laneDefs[i];
      if (!lane || !def) continue;
      const glow = scene.laneGlow[i] ?? 0;
      const r = scene.layout.noteBaseRadius * (1 + glow * 0.12);
      const x = lane.centerX;
      const y = judgeY;
      const belowY = y + r + Math.max(15, r * 0.55);

      // 鼓垫：形状 + 颜色（色盲双编码），命中时柔光
      ctx.save();
      ctx.globalAlpha = 0.5 + glow * 0.5;
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(3, r * 0.24);
      ctx.strokeStyle = withAlpha(def.color, 0.85);
      ctx.fillStyle = withAlpha(def.color, 0.14 + glow * 0.3);
      this.traceShape(def.shape, x, y, r);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (this.hardwareMode) {
        // 硬件鼓模式：鼓垫中央放可爱鼓图标（板子键位），下方标 S 几。
        this.drawDrumIcon(def.shape, x, y, r * 0.8, def.color, glow);
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = cnFont(Math.max(13, r * 0.5), 800);
        ctx.fillStyle = withAlpha(def.color, 0.95);
        ctx.fillText(def.key, x, belowY);
        ctx.restore();
      } else {
        // 键盘模式：鼓垫中央大字键盘键（孩子按它）；下方常驻「鼓图标 + S 几」。
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = cnFont(r * 0.9, 800);
        ctx.fillStyle = glow > 0.2 ? "#fff6d8" : "rgba(255,246,216,0.9)";
        ctx.fillText(KEY_LABELS[i] ?? "", x, y);
        ctx.restore();
        // 下方一行：小鼓图标 + S 几（颜色 + 形状 + 图标 + 文字，多重双编码）
        const iconR = Math.max(9, r * 0.32);
        const gx = x - iconR * 1.5;
        this.drawDrumIcon(def.shape, gx, belowY, iconR, def.color, glow);
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = cnFont(Math.max(12, r * 0.46), 700);
        ctx.fillStyle = withAlpha(def.color, 0.95);
        ctx.fillText(def.key, gx + iconR + 3, belowY);
        ctx.restore();
      }
    }
  }

  /** 只描形状路径（受体用，填充/描边由调用方设置）。 */
  private traceShape(shape: LaneShape, x: number, y: number, r: number): void {
    const ctx = this.ctx;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
    } else if (shape === "round") {
      roundRect(ctx, x - r, y - r, r * 2, r * 2, r * 0.42);
    } else if (shape === "triangle") {
      const h = r * 1.15;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + r * 1.05, y + h * 0.72);
      ctx.lineTo(x - r * 1.05, y + h * 0.72);
      ctx.closePath();
    } else {
      drawStar(ctx, x, y, r * 0.52, r * 1.12, 5);
    }
  }

  /**
   * 可爱鼓图标（纯 canvas，糖果色 + 同色系深色描边）：
   *  circle=闭镲（两片合拢） / triangle=开镲（两片张开） / round=拍手（两只小手掌） / star=边击（一根小棒）。
   */
  private drawDrumIcon(shape: LaneShape, x: number, y: number, r: number, color: string, glow: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.92 + glow * 0.08;
    const stroke = darken(color, 0.34);
    const lw = Math.max(1.4, r * 0.12);
    if (shape === "circle") {
      // 闭镲：两片合拢（上下两个浅椭圆贴合）+ 中轴
      ctx.fillStyle = color;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.1, r * 0.92, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, r * 0.16, r * 0.92, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(0, r * 0.55);
      ctx.stroke();
    } else if (shape === "triangle") {
      // 开镲：两片张开（上下分离 + 轻微外倾）
      ctx.fillStyle = color;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.save();
      ctx.rotate(-0.14);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.42, r * 0.9, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.rotate(0.14);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.42, r * 0.9, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.12);
      ctx.lineTo(0, r * 0.12);
      ctx.stroke();
    } else if (shape === "round") {
      // 拍手：两只小手掌相对
      this.drawHand(-r * 0.44, 0, r * 0.52, color, stroke, false);
      this.drawHand(r * 0.44, 0, r * 0.52, color, stroke, true);
    } else {
      // 边击：一根小棒（斜置鼓槌 + 圆头）
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(2, r * 0.2);
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.62);
      ctx.lineTo(r * 0.32, -r * 0.32);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(r * 0.44, -r * 0.44, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 一只小手掌（mitten 风：四指并拢朝上 + 掌 + 拇指），mirror=true 画右手（镜像）。 */
  private drawHand(cx: number, cy: number, r: number, fill: string, stroke: string, mirror: boolean): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    if (mirror) ctx.scale(-1, 1);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1.1, r * 0.14);
    for (let i = 0; i < 4; i++) {
      const fx = -r * 0.34 + i * r * 0.23;
      ctx.beginPath();
      ctx.ellipse(fx, -r * 0.42, r * 0.12, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.12, r * 0.5, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(r * 0.44, r * 0.04, r * 0.14, r * 0.24, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ---- 吉祥物：一颗会表情的小星星（呼应《小星星》）----
  private drawMascot(scene: Scene): void {
    const ctx = this.ctx;
    const m = scene.mascot;
    const { fieldLeft, judgeY, height } = scene.layout;
    const roomy = fieldLeft >= 92;
    const x = roomy ? fieldLeft * 0.5 : 42;
    const baseY = roomy ? judgeY - 34 : height - 60;
    const r = roomy ? Math.min(46, fieldLeft * 0.4) : 30;

    // 摆动/跳动（低频，<3Hz）
    const bobFreq = m.mood === "cheer" ? 1.6 : 0.6;
    const bobAmp = m.mood === "cheer" ? r * 0.18 : r * 0.06;
    const y = baseY - Math.abs(Math.sin(m.bob * Math.PI * bobFreq)) * bobAmp;

    ctx.save();
    ctx.translate(x, y);
    const tilt = m.mood === "oops" ? 0.12 : m.mood === "cheer" ? Math.sin(m.bob * 6) * 0.06 : 0;
    ctx.rotate(tilt);

    // 手臂（cheer 时上举）
    ctx.strokeStyle = "#e0a94a";
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = "round";
    const armUp = m.mood === "cheer";
    const armY = armUp ? -r * 0.5 : r * 0.15;
    const armX = r * 0.85;
    ctx.beginPath();
    ctx.moveTo(-armX * 0.6, r * 0.1);
    ctx.lineTo(-armX, armY);
    ctx.moveTo(armX * 0.6, r * 0.1);
    ctx.lineTo(armX, armY);
    ctx.stroke();

    // 星星身体（圆化尖点）
    ctx.lineJoin = "round";
    ctx.lineWidth = r * 0.14;
    ctx.strokeStyle = "#e0a94a";
    ctx.fillStyle = "#ffe9a8";
    ctx.shadowColor = "rgba(255,225,150,0.55)";
    ctx.shadowBlur = 16;
    drawStar(ctx, 0, 0, r * 0.5, r * 1.05, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // 脸
    const eyeY = -r * 0.05;
    const eyeDX = r * 0.26;
    ctx.strokeStyle = "#4a4470";
    ctx.fillStyle = "#4a4470";
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.lineCap = "round";
    if (m.mood === "cheer") {
      // ^ ^ 开心眼
      ctx.beginPath();
      ctx.arc(-eyeDX, eyeY + r * 0.06, r * 0.13, Math.PI * 1.1, Math.PI * 1.9);
      ctx.arc(eyeDX, eyeY + r * 0.06, r * 0.13, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (m.mood === "oops") {
      // 温柔下垂眼（不哭、不难过）
      ctx.beginPath();
      ctx.arc(-eyeDX, eyeY, r * 0.1, Math.PI * 0.15, Math.PI * 0.85);
      ctx.arc(eyeDX, eyeY, r * 0.1, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-eyeDX, eyeY, r * 0.075, 0, Math.PI * 2);
      ctx.arc(eyeDX, eyeY, r * 0.075, 0, Math.PI * 2);
      ctx.fill();
    }
    // 腮红
    ctx.fillStyle = "rgba(255,150,170,0.55)";
    ctx.beginPath();
    ctx.arc(-eyeDX - r * 0.06, eyeY + r * 0.24, r * 0.12, 0, Math.PI * 2);
    ctx.arc(eyeDX + r * 0.06, eyeY + r * 0.24, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    // 嘴
    ctx.strokeStyle = "#4a4470";
    ctx.lineWidth = Math.max(2, r * 0.075);
    ctx.beginPath();
    if (m.mood === "oops") {
      ctx.arc(0, eyeY + r * 0.34, r * 0.1, 0, Math.PI * 2); // 小 o
    } else {
      ctx.arc(0, eyeY + r * 0.2, r * 0.2, Math.PI * 0.15, Math.PI * 0.85); // 微笑
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- HUD ----
  private drawHud(scene: Scene, hud: HudState): void {
    const ctx = this.ctx;
    const { width: w } = scene.layout;
    const padX = 20;
    // 顶部 DOM 的「回家 / 暂停」大按钮高 56、top:14 → 底边 70；分数块整体下移到 80 起，
    // 标签与数字再拉开行距，保证「分数」与大分值上下分开、不重叠、不压按钮。
    const topY = 80;
    const numY = topY + 22; // 标签(15px)在 topY..topY+15，数字(40px)在 numY 起，中间留 ~7px 空隙

    // 分数（左上，避开按钮）
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = cnFont(15, 700);
    ctx.fillStyle = "rgba(255,246,216,0.75)";
    ctx.fillText("分数", padX, topY);
    ctx.font = cnFont(40, 800);
    ctx.fillStyle = "#fff6d8";
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 6;
    ctx.fillText(String(Math.round(hud.score)), padX, numY);
    ctx.restore();

    // 歌名 + 进度（顶部居中，位于两个按钮之间）
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = cnFont(20, 400);
    ctx.fillStyle = "rgba(255,246,216,0.9)";
    ctx.fillText(`${hud.songTitle} · ${hud.difficultyLabel}`, w / 2, 16);
    const barW = Math.min(240, w * 0.4);
    const barX = w / 2 - barW / 2;
    const barY = 44;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, barX, barY, barW, 8, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,224,150,0.9)";
    roundRect(ctx, barX, barY, Math.max(8, barW * clamp(hud.progress, 0, 1)), 8, 4);
    ctx.fill();
    ctx.restore();

    // 连击（右上，避开按钮，≥2 才显示）
    if (hud.combo >= 2) {
      ctx.save();
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      const big = scene.cheerPulse > 0.2;
      ctx.font = cnFont(big ? 46 : 38, 800);
      ctx.fillStyle = "#ffe066";
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 6;
      ctx.fillText(String(hud.combo), w - padX, topY);
      ctx.font = cnFont(16, 700);
      ctx.fillStyle = "rgba(255,246,216,0.85)";
      ctx.fillText("连击", w - padX, topY + (big ? 50 : 42));
      ctx.restore();
    }
  }
}
