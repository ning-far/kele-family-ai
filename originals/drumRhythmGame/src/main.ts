/**
 * 应用入口：装配所有模块并启动游戏。
 *
 * 装配关系：
 *  - MusicEngine 同时是音频引擎与「权威音频时钟」(Clock)；
 *  - KeyboardSource 用同一 Clock 给每次敲击打时间戳（1B 换成 SerialSource 即可，上层不变）；
 *  - GameApp 负责屏幕状态机与 rAF 主循环。
 *
 * 谱面动态加载：根据用户在首页选择的歌曲，fetch 对应的 JSON（放 public/charts/）。
 */

import "./styles.css";
import { MusicEngine } from "./audio/music";
import { KeyboardSource } from "./input/keyboard";
import { BeatboxLink } from "./device/link";
import { SerialSource } from "./device/serial-source";
import { Renderer } from "./render/renderer";
import { SettingsStore } from "./settings";
import { GameApp } from "./flow/screens";

function bootstrap(): void {
  const canvas = document.getElementById("game") as HTMLCanvasElement | null;
  const overlay = document.getElementById("overlay") as HTMLElement | null;
  if (!canvas || !overlay) {
    throw new Error("缺少 #game 画布或 #overlay 覆盖层");
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法获取 Canvas 2D 上下文");

  const music = new MusicEngine();
  const input = new KeyboardSource(music); // music 即权威音频时钟
  const renderer = new Renderer(ctx);
  const settings = new SettingsStore();

  // 阶段1B：真机设备（Web Serial）。link 管连接/下行/状态，serial 把板子 S1–S4 按下沿变成 HitEvent。
  // 不连板也不影响：GameApp 会同时听键盘与串行两个源，未连接时只有键盘产生命中。
  const link = new BeatboxLink();
  const serial = new SerialSource(link, music); // 同一音频时钟打戳；仅 i0-3、同键 25ms 去重、忽略 note
  const device = import.meta.env.VITE_KELE_WIRELESS_ONLY === '1' ? undefined : { link, serial };

  const app = new GameApp({ canvas, ctx, overlay, music, input, renderer, settings, device });
  if(new URLSearchParams(location.search).has('timingDebug'))Object.defineProperty(window,'__drumTiming',{get:()=>app.timingSnapshot()});

  // 尺寸自适应（窗口变化 / 移动端旋转）。
  const onResize = (): void => app.resize();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // 字体就绪后再启动，避免首帧用回退字体抖动；超时也照常启动。
  const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  const go = (): void => {
    app.resize();
    app.start();
  };
  if (fontsReady && typeof fontsReady.then === "function") {
    void Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(go);
  } else {
    go();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
