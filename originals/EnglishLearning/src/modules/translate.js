/**
 * Module 4 — Translation (任意翻译)
 *
 * 孩子【按住 S1】用中文说一句话，例如 "苹果用英语怎么说？" / "早上好"，松手即停。
 * 语音识别结果（中文）送到 server 的 /api/baidu/translate：
 *   - 百度云模式：百度 ASR 出中文 → 百度「文本翻译」出英文 → 百度 TTS 朗读（全链路百度）。
 *   - 本地模式：浏览器/Whisper ASR 出中文 → server 调用百度文本翻译（或 MyMemory 兜底）→ 朗读。
 *
 * 交互改进：S1 长按说话、松手停止，启动不再播 "Ask now"；类型框已彻底移除。
 * Board (appmode = english): 按住 S1 = PTT (zh-CN)，S5 = ask another，S6 = home。
 */
import { el } from "../ui/dom.js";
import { translateZhToEn } from "../content/lessons.js";
import { ROLE } from "../board/protocol.js";
import { miniKeypad } from "../ui/widgets.js";
import { moduleShell } from "../ui/shell.js";
import { phraseIPA } from "./flow.js";
import { debugLog } from "../speech/debugLog.js";

const MAX_TRANSLATION_LEN = 120; // 翻译结果最长字符数，超过则截断，避免界面被撑爆

/** 去掉"请翻译一下 / 用英语怎么说"之类的命令词，只留要翻译的核心内容。 */
function cleanCommand(t) {
  let s = String(t || "").replace(/[。.!！?？~～]/g, " ").trim();
  const lead = ["请翻译一下", "请翻译", "翻译一下", "翻译", "帮我翻译", "帮翻译", "用英语说", "用英语讲"];
  for (const p of lead) {
    if (s.startsWith(p)) {
      s = s.slice(p.length).trim();
      break;
    }
  }
  const trail = ["用英语怎么说", "用英语", "英语怎么说", "怎么说呢", "怎么说", "英文怎么说", "英文", "的英文"];
  for (const p of trail) {
    if (s.endsWith(p)) {
      s = s.slice(0, -p.length).trim();
      break;
    }
  }
  return s;
}

/**
 * 边界处理：
 *   1) 过长翻译截断到 MAX_TRANSLATION_LEN，加 "…"
 *   2) 明显的重复灌水（如识别/翻译错乱产生的大量重复词）判为异常，返回空。
 *
 * 注意：用「词频」判断而不是通用正则，避免把正常的列举句
 * （“我喜欢苹果香蕉橘子葡萄” → "I like apples, I like bananas..."）误判成垃圾。
 */
export function sanitizeTranslation(src, dst) {
  const s = String(dst || "").trim();
  if (!s) return "";
  if (looksSpammy(s)) {
    debugLog("翻译结果检测到灌水重复，视为异常", "warn");
    return "";
  }
  if (s.length > MAX_TRANSLATION_LEN) {
    return s.slice(0, MAX_TRANSLATION_LEN).replace(/\s+\S*$/, "") + "…";
  }
  return s;
}

/** 同一词出现 >=6 次，或最高频词占比 >=50%，或同一长串连续重复 3+ 次，视为灌水垃圾。 */
function looksSpammy(s) {
  const toks = s.toLowerCase().match(/[a-z0-9']+/g) || [];
  if (toks.length >= 6) {
    const freq = {};
    for (const t of toks) freq[t] = (freq[t] || 0) + 1;
    const max = Math.max(...Object.values(freq));
    if (max >= 6 || max / toks.length >= 0.5) return true;
  }
  // 连续重复的长串（如 "Subtitles: Guo Wengui. " 反复刷屏）
  return /(.{8,})\1{2,}/s.test(s);
}

export function mountTranslate(ctx) {
  const sh = moduleShell(ctx, { title: "Magic Translator" });
  const pad = miniKeypad(ctx.keypad);

  const heardBox = el("div", { class: "word-bubble", style: "font-size:clamp(18px,4vw,28px)" });
  const resultEn = el("div", { class: "word-bubble", style: "color:#6db7ff;font-size:clamp(22px,5vw,34px)" });
  const resultIpa = el("div", { class: "spell-out", style: "opacity:0;transition:opacity .2s" });
  const resultZh = el("div", { class: "hint" });
  const hint = el("p", { class: "hint" });
  const recordBtn = el("button", { class: "btn big hold", style: "touch-action:none" }, "🎤 Hold S1 (Chinese)");

  sh.stage.append(
    el("div", { class: "stage-inner" }, [
      heardBox, resultEn, resultIpa, resultZh, hint, recordBtn,
    ])
  );
  sh.stage.append(pad.node);

  function reset() {
    heardBox.textContent = "";
    resultEn.textContent = "";
    resultIpa.textContent = "";
    resultIpa.style.opacity = "0";
    resultZh.textContent = "";
    hint.textContent = "按住 S1 说一句中文（如“早上好”），松手就翻译并读给你听。";
    recordBtn.textContent = "🎤 Hold S1 (Chinese)";
    recordBtn.classList.remove("recording");
    sh.hideBanner();
  }

  async function onResult({ transcript }) {
    debugLog("ASR 返回(翻译): '" + transcript + "'");
    const raw = (transcript || "").trim();
    if (!raw) {
      sh.setBanner("I didn't catch that — hold S1 and say it again! 💡", "encourage");
      return;
    }
    const text = cleanCommand(raw);
    heardBox.textContent = raw;
    if (!text) {
      sh.setBanner("再说清楚一点呀～", "reveal");
      return;
    }
    try {
      const resp = await fetch("/api/baidu/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text }),
      });
      if (!resp.ok) throw new Error("http " + resp.status);
      const j = await resp.json();
      const dst = sanitizeTranslation(text, j.dst);
      if (!dst) throw new Error("translation-suspicious");
      showResult(dst, j.to, j.engine);
    } catch {
      const { en, found } = translateZhToEn(text);
      if (found) showResult(en, "en", "offline");
      else {
        resultEn.textContent = "?";
        resultIpa.textContent = "";
        resultIpa.style.opacity = "0";
        resultZh.textContent = "翻译太长了，或者这个词还没学过，试试：苹果、猫、太阳…";
        sh.setBanner("离线模式只认少量词 🤔", "reveal");
        ctx.flashLed(0xff5e9c);
        ctx.tts.speak("I don't know that word yet.", { lang: "en-US" });
      }
    }
  }

  function showResult(dst, to, engine) {
    if (!dst) return;
    const isEn = to !== "zh";
    resultEn.textContent = dst;
    const ipa = isEn ? phraseIPA(dst) : "";
    resultIpa.textContent = ipa;
    resultIpa.style.opacity = ipa ? "1" : "0";
    resultZh.textContent = isEn ? "" : "中文: " + dst;
    sh.setBanner("Here you go! 🌟", "good");
    ctx.flashLed(0x6db7ff);
    ctx.tts.speak(dst, { lang: isEn ? "en-US" : "zh-CN" });
    if (engine === "offline") hint.textContent = "（离线词典，连上 server 可翻任意句子）";
  }

  const onState = (rec) => {
    debugLog("onState: " + rec);
    recordBtn.classList.toggle("recording", rec);
    recordBtn.textContent = rec ? "Listening… (hold)" : "🎤 Hold S1 (Chinese)";
  };
  const onInterim = (text) => {
    heardBox.textContent = text + " …";
  };
  const onNoResult = () => {
    debugLog("onNoResult（本次无语音结果）", "warn");
    sh.setBanner("I didn't catch that — hold S1 and say it again! 💡", "encourage");
  };
  const onSpeechError = (err) => {
    debugLog("onSpeechError: " + err, "error");
    if (err === "not-allowed" || err === "service-not-allowed") {
      sh.setBanner("请允许浏览器使用麦克风 🔒 点地址栏的麦克风图标 → 允许", "reveal");
    } else if (err === "not-secure-context") {
      sh.setBanner("语音需要 HTTPS 或 localhost；刷新页面用麦克风录音 🔒", "reveal");
    } else if (err === "not-supported") {
      sh.setBanner("当前浏览器不支持语音识别，请用 Chrome/Edge 打开 💡", "reveal");
    } else {
      onNoResult();
    }
  };

  function startRecording() {
    ctx.recorder.start("zh-CN", { onResult, onNoResult, onError: onSpeechError, onState, onInterim });
  }
  function stopRecording() {
    ctx.recorder.release();
  }

  const unsubKey = ctx.keypad.onKey((i, down) => {
    if (i === ROLE.PTT) {
      if (down) startRecording();
      else stopRecording();
      return;
    }
    if (!down) return;
    if (i === ROLE.NEXT) reset();
    else if (i === ROLE.HOME) ctx.goHome();
  });
  recordBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); startRecording(); });
  recordBtn.addEventListener("pointerup", () => stopRecording());
  recordBtn.addEventListener("pointerleave", () => stopRecording());
  recordBtn.addEventListener("pointercancel", () => stopRecording());

  reset();

  return {
    unmount() {
      unsubKey();
      pad.unsub();
      ctx.recorder.stop();
      ctx.tts.cancel();
    },
  };
}
