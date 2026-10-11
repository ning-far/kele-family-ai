/**
 * debugLog — 语音链路日志埋点。用于定位"根本没采到声音"到底断在哪一步。
 *
 * 输出到 console（带 [ASR] 前缀）和一个可折叠的屏幕面板：
 *   - URL 加 ?debug=1 自动展开面板
 *   - 按 Ctrl+Shift+D 切换面板
 *   - 点左下角 🐛 按钮切换
 *   - 面板内有「🎤 测麦克风」按钮：直接用 getUserMedia 测麦克风是否在工作、
 *     并实时显示说话时的音量 RMS（这是判断"有没有采到声音"的最直接证据）
 */
let panel = null;
let toggleBtn = null;
let probeBtn = null;
let clearBtn = null;
let netBtn = null;
let visible = false;
const MAX = 400;
const buffer = [];

function now() {
  const d = new Date();
  return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

function ensurePanel() {
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "asr-debug-panel";
  panel.style.cssText =
    "position:fixed;right:8px;bottom:8px;width:400px;max-height:46vh;display:flex;flex-direction:column;" +
    "background:rgba(8,12,16,.9);color:#b6f7c1;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;" +
    "border-radius:8px;z-index:99999;border:1px solid #2a6;box-shadow:0 4px 16px rgba(0,0,0,.5);overflow:hidden";

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;gap:6px;padding:6px;background:rgba(255,255,255,.06);align-items:center;flex-wrap:wrap";
  const title = document.createElement("span");
  title.textContent = "🐛 语音日志";
  title.style.cssText = "flex:1;font-weight:bold";
  probeBtn = document.createElement("button");
  probeBtn.textContent = "🎤 测麦克风";
  probeBtn.style.cssText = "font-size:11px;padding:3px 6px;cursor:pointer";
  netBtn = document.createElement("button");
  netBtn.textContent = "🌐 测网络";
  netBtn.style.cssText = "font-size:11px;padding:3px 6px;cursor:pointer";
  clearBtn = document.createElement("button");
  clearBtn.textContent = "清空";
  clearBtn.style.cssText = "font-size:11px;padding:3px 6px;cursor:pointer";
  header.append(title, probeBtn, netBtn, clearBtn);

  const logBox = document.createElement("div");
  logBox.id = "asr-debug-log";
  logBox.style.cssText = "flex:1;overflow:auto;padding:6px 10px;white-space:pre-wrap";
  panel.append(header, logBox);
  panel._log = logBox;

  document.body.appendChild(panel);
  return panel;
}

function ensureBtn() {
  if (toggleBtn) return toggleBtn;
  toggleBtn = document.createElement("button");
  toggleBtn.id = "asr-debug-btn";
  toggleBtn.textContent = "🐛 日志";
  toggleBtn.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:99999;padding:6px 10px;border-radius:8px;" +
    "border:1px solid #2a6;background:#13202b;color:#b6f7c1;font:12px sans-serif;cursor:pointer";
  toggleBtn.addEventListener("click", toggleDebug);
  document.body.appendChild(toggleBtn);
  return toggleBtn;
}

export function debugLog(msg, level = "info") {
  const line = `[${now()}] [${level}] ${msg}`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn("[ASR]", msg);
  buffer.push(line);
  if (buffer.length > MAX) buffer.shift();
  if (visible && panel && panel._log) {
    const div = document.createElement("div");
    div.textContent = line;
    if (level === "error") div.style.color = "#ff9b9b";
    else if (level === "warn") div.style.color = "#ffe08a";
    panel._log.appendChild(div);
    panel._log.scrollTop = panel._log.scrollHeight;
  }
}

export function setDebugVisible(v) {
  visible = v;
  ensurePanel().style.display = v ? "flex" : "none";
}

export function toggleDebug() {
  setDebugVisible(!visible);
}

export function getLog() {
  return buffer.join("\n");
}

/** 直接探测麦克风：是否可访问 + 说话时音量是否变化（判断"有没有采到声音"）。 */
export async function probeMic() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    debugLog("getUserMedia 不可用：可能是非安全上下文(http 局域网)或旧浏览器", "warn");
    return;
  }
  debugLog("麦克风探测：调用 getUserMedia({audio:true}) …");
  let stream, ctx, analyser, data, timer;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    debugLog(`getUserMedia 失败：${e.name} ${e.message}（麦克风被拒绝或不存在）`, "error");
    return;
  }
  debugLog("getUserMedia 成功 ✅ 麦克风可访问", "info");
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    debugLog("AudioContext 不可用，无法测音量（但麦克风权限已通过）", "warn");
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  ctx = new AC();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {}
  }
  const src = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  data = new Uint8Array(analyser.frequencyBinCount);
  let n = 0;
  timer = setInterval(() => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    debugLog(
      `麦克风音量 RMS=${rms.toFixed(3)} ${rms > 0.02 ? "🔊 有声音" : "（安静）"}`,
      rms > 0.02 ? "info" : "warn"
    );
    if (++n >= 14) {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      try {
        ctx.close();
      } catch {}
      debugLog("麦克风探测结束（已停止，请对照上面 RMS 是否随你说话变化）", "info");
    }
  }, 250);
}

/**
 * 一键网络探测：Google（被墙？）+ HF 国内镜像（Whisper 模型来源）是否可达。
 * 用来确认「为什么 Web Speech 没结果」以及「本地 Whisper 在这里能不能用」。
 */
export async function probeNetwork() {
  debugLog("🌐 网络探测开始：运行库 CDN + 本地模型 + 下载镜像可达性 …");
  const origin = (typeof location !== "undefined" && location.origin) || "";
  const targets = [
    ["jsdelivr(Whisper 运行库+ort wasm)", "https://cdn.jsdelivr.net/npm/onnxruntime-web@1/dist/ort.min.js"],
    ["ModelScope(模型下载镜像)", "https://modelscope.cn/"],
    ["HF 国内镜像(hf-mirror)", "https://hf-mirror.com/"],
  ];
  for (const [name, url] of targets) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      debugLog(`🌐 ${name}: 可访问 ✅`, "info");
    } catch (e) {
      clearTimeout(timer);
      debugLog(`🌐 ${name}: 不可访问 ❌ (${e?.name || e})`, "error");
    }
  }
  // 本地模型是否就绪（这是运行时真正依赖的，零外网）
  if (origin) {
    try {
      const r = await fetch(`${origin}/models/whisper-base/config.json`, { cache: "no-store" });
      if (r.ok)
        debugLog("📦 本地模型 /models/whisper-tiny: 已就绪 ✅（运行时零外网，无需翻墙）", "info");
      else
        debugLog("📦 本地模型 /models/whisper-tiny: 缺失 ❌ → 请运行 node scripts/fetch-whisper-model.mjs", "error");
    } catch (e) {
      debugLog(`📦 本地模型检查失败 ❌ (${e?.name || e}) → 请运行 node scripts/fetch-whisper-model.mjs`, "error");
    }
  }
  debugLog(
    "解读：Whisper 运行库走 jsdelivr（国内可达 ✅）。模型已改为「脚本一次性下载到本地 /models，浏览器离线读取」，" +
      "运行时零外网、无需翻墙。若本地模型缺失，点上面提示运行下载脚本（脚本用 ModelScope/hf-mirror，均为国内镜像）。",
    "warn"
  );
}

export function initDebug() {
  if (typeof document === "undefined") return;
  ensureBtn();
  const p = ensurePanel();
  // Match the initial visible=false state; keep the diagnostics off the game.
  p.style.display = visible ? "flex" : "none";
  if (probeBtn) probeBtn.addEventListener("click", () => probeMic());
  if (netBtn) netBtn.addEventListener("click", () => probeNetwork());
  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      buffer.length = 0;
      if (p._log) p._log.innerHTML = "";
    });
  if (typeof location !== "undefined" && location.search.includes("debug")) setDebugVisible(true);
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        toggleDebug();
      }
    });
    window.__asrDebug = { log: getLog, toggle: toggleDebug, probe: probeMic, probeNet: probeNetwork };
  }
  debugLog("🐛 调试面板就绪：Ctrl+Shift+D 切换；URL 加 ?debug=1 自动展开；点「🎤 测麦克风」验证麦克风");
}
