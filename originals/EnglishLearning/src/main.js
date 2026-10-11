/**
 * Bootstrap for the EnglishLearning web app.
 *
 * Wires together:
 *   - Keypad        (single source of truth for S1..S8 + appmode)
 *   - SerialLink    (real EasyInput V2.0 board over Web Serial)
 *   - Simulator     (keyboard fallback so it runs without hardware)
 *   - WhisperRecognizer/TTS (本地 Whisper 离线识别 + 浏览器内置 speechSynthesis 离线 TTS)
 *   - App router    (welcome -> menu -> modules)
 *
 * Everything lives under D:\QoderCN\waytoAGILearning\EnglishLearning so no extra
 * disk is used on C:. No npm install is required (zero runtime dependencies).
 */
import { Keypad } from "./board/keypad.js";
import { SerialLink } from "./board/serial-link.js";
import { KeyboardSimulator } from "./board/simulator.js";
import { SpeechManager } from "./speech/speechManager.js";
import { Recorder } from "./speech/recorder.js";
import { CuteSounds } from "./speech/fx.js";
import { createApp } from "./app.js";
import { el, toast } from "./ui/dom.js";
import { initDebug, probeMic, debugLog } from "./speech/debugLog.js";

const screen = document.getElementById("screen");
const statusBar = document.getElementById("status-bar");

const keypad = new Keypad();
const serial = new SerialLink();
const speech = new SpeechManager();
const fx = new CuteSounds();
// 代理对象：永远转发到「当前引擎」的 recognizer / tts，以便运行时切换引擎。
const recognizer = {
  get supported() {
    return speech.recognizer.supported;
  },
  get secureContext() {
    return speech.recognizer.secureContext;
  },
  start(...a) {
    return speech.recognizer.start(...a);
  },
  stop(...a) {
    return speech.recognizer.stop(...a);
  },
  abort() {
    return speech.recognizer.abort();
  },
};
const tts = {
  speak(...a) {
    return speech.tts.speak(...a);
  },
  cancel() {
    return speech.tts.cancel();
  },
  get supported() {
    return speech.tts.supported;
  },
};
const recorder = new Recorder(() => speech.recognizer);
const simulator = new KeyboardSimulator(keypad);

/* ---- status bar ---- */
const dotSerial = el("span", { class: "status-dot" });
const dotBoard = el("span", { class: "status-dot board" });
const dotMode = el("span", { class: "status-dot mode" });
const statusText = el("span", { text: "Not connected" });
const connectBtn = el("button", { class: "btn ghost", style: "font-size:14px;padding:6px 14px" }, "Connect board");
connectBtn.addEventListener("click", () => {
  serial
    .requestPort()
    .catch((e) => toast("Cannot connect: " + (e?.message || e)));
});
statusBar.append(dotSerial, statusText, connectBtn, dotBoard, dotMode);

/* ---- 语音引擎开关（本地标准版 / 本地高级版 / 百度云） ---- */
const engineSelect = el(
  "select",
  {
    class: "btn ghost",
    title: "语音引擎：本地标准版 / 本地高级版（离线） / 百度云（需 server .env 配置 Key）",
    style: "font-size:13px;padding:4px 8px",
  }
);
const optLocalBase = el("option", { value: "local-base" }, "🖥️ 本地·标准版 (base)");
const optLocalAdv = el("option", { value: "local-adv" }, "🚀 本地·高级版 (small.en)");
const optBaidu = el("option", { value: "baidu" }, "☁️ 百度云（英文易误识）");
engineSelect.append(optLocalBase, optLocalAdv, optBaidu);

// 一次性迁移：此前本地 whisper-base 缺 config/tokenizer 文件导致「本地」引擎直接失败，
// 于是只能用百度云，而百度的英文模型对孤立单词极易脑补成别的词（orange→outrage 等）。
// 现在本地模型已补全，且对英文明显更准，这里把引擎切回本地（标准版）一次并明确告知。
const ENGINE_MIGRATE_KEY = "el_engine_migrated_local_v2";
// 只有在确认本地模型真的可用时才迁移，避免把用户从"能用的百度"切到"坏掉的本地"
(async () => {
  try {
    if (localStorage.getItem("el_speech_engine") !== "baidu") return;
    if (localStorage.getItem(ENGINE_MIGRATE_KEY)) return; // 只做一次
    localStorage.setItem(ENGINE_MIGRATE_KEY, "1");
    const r = await fetch("/models/whisper-base/config.json", { cache: "no-store" });
    if (!r.ok) return; // 本地模型不可用：保持百度，不乱切
    speech.setEngine("local-base");
    engineSelect.value = "local-base";
    toast("已切到本地 Whisper（英文识别更准）；可在右上角改高级版或百度云");
  } catch {
    /* localStorage 不可用等：忽略，保持当前引擎 */
  }
})();

engineSelect.value = speech.engine;
engineSelect.addEventListener("change", () => {
  speech.setEngine(engineSelect.value);
  if (engineSelect.value === "baidu") {
    toast("已切换到百度云（需 server .env 配好 Key）");
  } else if (engineSelect.value === "local-adv") {
    toast("已用本地高级版 whisper-small.en（英文更准，首次加载稍慢）");
  } else {
    toast("已切回本地标准版 whisper-base（英文更准）");
  }
});
statusBar.append(engineSelect);

// 高级版模型若未下载，则禁用该选项并给出如何获取的提示（已下载则在 D 盘 models/whisper-small.en）。
fetch("/models/whisper-small.en/config.json", { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw new Error("missing");
  })
  .catch(() => {
    optLocalAdv.disabled = true;
    optLocalAdv.textContent = "🚀 本地·高级版(未下载)";
    const oldTitle = engineSelect.title;
    engineSelect.title =
      "高级版模型未下载：运行  node scripts/fetch-whisper-model.mjs whisper-small.en  后重启 server。" +
      (oldTitle ? "  " + oldTitle : "");
  });

// 问后端百度是否配置；未配置则禁用「百度云」选项并给出提示。
fetch("/api/config")
  .then((r) => r.json())
  .then((cfg) => {
    if (!cfg.baiduConfigured) {
      optBaidu.disabled = true;
      optBaidu.textContent = "☁️ 百度云(未配置)";
      // 追加而非覆盖，避免丢失「高级版未下载」的提示
      engineSelect.title =
        (engineSelect.title ? engineSelect.title + "  " : "") +
        "百度云未配置：在 server 同目录的 .env 里设置 BAIDU_API_KEY / BAIDU_SECRET_KEY 后重启 server";
    }
  })
  .catch((e) => debugLog?.("获取 /api/config 失败：" + (e?.message || e), "warn"));

function renderStatus() {
  const connected = serial.connected;
  dotSerial.classList.toggle("on", connected);
  dotBoard.classList.toggle("on", keypad.appmode !== "");
  dotMode.classList.toggle("on", keypad.isEnglish());
  const parts = [];
  parts.push(connected ? "Board connected" : "Board not connected");
  if (keypad.appmode) parts.push("mode: " + keypad.appmode);
  statusText.textContent = parts.join("  ·  ");
}

serial.onConnectionChange(() => renderStatus());
keypad.onAppMode(() => renderStatus());
renderStatus();

/* ---- route board messages into the keypad ---- */
serial.onMessage((msg) => {
  if (msg.t === "key" && typeof msg.i === "number") {
    keypad.setKey(msg.i, msg.v === 1);
  } else if ((msg.t === "hello" || msg.t === "state") && typeof msg.appmode === "string") {
    keypad.setAppMode(msg.appmode);
  }
});

/* ---- LED helper (best-effort board feedback) ---- */
function flashLed(hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  serial.sendLed(-1, r, g, b, 500);
}

/* ---- context handed to every module ---- */
const ctx = {
  screen,
  keypad,
  recognizer,
  tts,
  fx,
  recorder,
  board: serial,
  flashLed,
  toast,
  goHome: () => app.goHome(),
  goModule: (k) => app.goModule(k),
};

const app = createApp(ctx);

/* Keyboard always works as a fallback (and for testing without hardware). */
simulator.attach();
app.start();

/* ---- 语音链路调试埋点 ---- */
initDebug();
if (typeof navigator !== "undefined") {
  debugLog(
    `环境: URL=${location.href} secureContext=${recognizer.secureContext} ` +
      `recognizer.supported=${recognizer.supported} UA=${navigator.userAgent}`
  );
}
// 启动即探测麦克风（点调试面板里的「🎤 测麦克风」可随时重测）
probeMic().catch(() => {});

/* Try to auto-connect to an already-granted board. */
serial
  .connect()
  .catch(() => {
    /* no port yet; user can click "Connect board" */
  });

/* Gentle capability warnings. */
if (!recognizer.supported) {
  toast("当前浏览器不支持语音识别（请用 Chrome/Edge），可用打字代替。");
} else if (!recognizer.secureContext) {
  toast("语音识别需要 HTTPS 或 localhost；当前是局域网 http，已自动用打字模式。");
}
if (!serial.supported) {
  toast("Web Serial not available — keyboard mode only.");
}

window.__englishApp = { keypad, serial, app };
