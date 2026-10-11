# THIRD-PARTY NOTICES · 第三方来源与许可

本项目（drumRhythmGame）**只使用 MIT / CC0 / OFL** 三种许可的第三方内容；**不含任何 AGPL/GPL 代码**，
**不含任何商业音游 IP**（无太鼓达人 / 节奏大师等名称、角色、皮肤、素材）。

---

## 1. 运行时依赖（npm）

| 包 | 版本 | 许可 | 用途 |
| --- | --- | --- | --- |
| tone | 15.1.22 | MIT | Web Audio 合成（八音盒旋律 + 4 鼓）与权威音频时钟 |
| vite | 6.x | MIT | 开发服务器 / 打包 |
| vitest | 3.x | MIT | 单元测试 |
| typescript | 5.9.x | Apache-2.0 | 类型检查（strict）。Apache-2.0 与 MIT 同为宽松许可，兼容 |

> 完整依赖树与各自许可以 `pnpm-lock.yaml` 为准；上表仅列直接依赖。

## 2. 设备接入层（阶段1B，同源复制）

以下 4 个文件从**同一仓库**的 `easyinput-beatbox/app/src/` **逐字复制**到 `src/device/`，
仅在每个文件顶部添加了「来源注释」，未改动其逻辑（唯一适配：`pattern.ts` 的 `clearPattern(tracks)`
参数改名为 `_tracks` 以满足本项目 tsconfig 的 `noUnusedParameters`）：

| 本项目文件 | 来源 | 许可 |
| --- | --- | --- |
| `src/device/link.ts` | `easyinput-beatbox/app/src/link.ts` | MIT |
| `src/device/protocol.ts` | `easyinput-beatbox/app/src/protocol.ts` | MIT |
| `src/device/device-store.ts` | `easyinput-beatbox/app/src/device-store.ts` | MIT |
| `src/device/pattern.ts` | `easyinput-beatbox/app/src/pattern.ts` | MIT |

- 版权：Copyright (c) 2026 Zhaohan Wang（见 `easyinput-beatbox/LICENSE`，MIT License）。
- `pattern.ts` 是 `link.ts` / `device-store.ts` 的既有依赖，故一并复制以保持三件套自洽编译。
- `src/device/web-serial.d.ts` 为本项目自建的 Web Serial 类型声明（源自 Vite 的 `vite-env.d.ts` 风格），
  Web Serial API 类型定义遵循 W3C/WHATWG 规范，无第三方版权限制。
- `src/device/serial-source.ts` 为本项目**原创**（阶段1B），实现 1A 定义的 `InputSource` 接口。

## 3. 字体（阶段1B · 已去掉 Google Fonts CDN）

**当前状态**：构建环境无法联网下载字体文件，故**尚未打包任何字体二进制**，
`index.html` 已移除 Google Fonts 的 CDN `<link>`，`src/styles.css` 与 `renderer.ts` 改用
**「系统圆体优先」字体栈**（Baloo 2 / ZCOOL KuaiLe / Yuanti SC / 幼圆 / PingFang SC / Microsoft YaHei / system-ui …）。
即当前运行时**不加载、不分发任何第三方字体文件**，零外链、零 404。

**将来若本地打包字体**，计划使用以下任一 **SIL Open Font License 1.1 (OFL)** 字体（OFL 允许自由打包分发）：

| 字体 | 许可 | 来源 | 版权 |
| --- | --- | --- | --- |
| Baloo 2 | SIL OFL 1.1 | https://fonts.google.com/specimen/Baloo+2 | Copyright (c) 2015 Ek Type (www.ektype.in) |
| 站酷快乐体 ZCOOL KuaiLe | SIL OFL 1.1 | https://fonts.google.com/specimen/ZCOOL+KuaiLe | Copyright (c) 2018 ZCOOL & HelloFont |

启用步骤见 `public/fonts/README.txt`：把 woff2 放进 `public/fonts/`，取消 `src/styles.css` 顶部
`@font-face` 注释即可（字体名已与字体栈对应）。放入字体后请在下表补记实际版本与 OFL 版权声明全文。

> OFL 1.1 全文可在 https://openfontlicense.org/ 获取；打包字体时须随附其 `OFL.txt` 与版权声明。

## 4. 美术 / 音频素材

- 全部为**程序化生成**（Canvas 2D 绘制 + Tone.js 合成），**未下载、未内嵌任何第三方图片 / 音频素材**。
- 夜行小火车背景、卡通鼓图标、吉祥物、命中特效均为本项目原创代码绘制（`src/render/`）。
- 《小星星》(Twinkle Twinkle Little Star) 旋律为**公有领域 (Public Domain)** 传统儿歌，无版权限制。

---

如需核对任一依赖的确切许可，可运行：`pnpm licenses list`（或查阅 `node_modules/<pkg>/package.json` 的 `license` 字段）。
