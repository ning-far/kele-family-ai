/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// 阶段1A：纯网页端，键盘游玩，不连硬件。
// base 用相对路径，方便 `vite build` 产物直接预览或塞进桌面壳。
export default defineConfig({
  base: "./",
  server: {
    // 避开 easyinput-beatbox 网页 App 常用的 5173，减少同时开发时的端口冲突。
    port: 5174,
    host: "127.0.0.1",
    // 不自动开浏览器（避免在无头/CI/代理环境下依赖 process 与弹出行为）。
    open: false,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
  test: {
    // 关键单测都是纯逻辑（谱面校验 / 判定窗口 / 计分），无需 DOM，用 node 环境即可，
    // 也避免把 Tone.js / canvas 拉进测试环境。
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
