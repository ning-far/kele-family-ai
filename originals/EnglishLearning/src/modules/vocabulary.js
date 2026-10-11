/**
 * Module 1 — Vocabulary Challenge (生词挑战)
 *
 * Flow: 显示一张图 + "What is this?"，小朋友【按住 S1】说话，松手即停，
 * 说的词与图片匹配即算对。
 *   - correct            -> reward (Wonderful!/Great!/...) +10，自动下一题
 *   - wrong (1st try)    -> "Try again!"（同图，一次重试）
 *   - wrong (2nd try)    -> 揭示答案，自动下一题（不扣分）
 *
 * 交互改进（按需求）：
 *   - S1 改为「长按说话、松手停止」（不再两次触发）
 *   - 启动时不再播 "Speak now" 之类的多余提示，按住就直接说
 *   - 彻底去掉 "Type it" 输入框（避免误触/按键串到输入框）
 *   - 近音纠错更宽松，鼓励为主
 *
 * 训练词库可选：全部 / 生词库 / 易错词库（顶部切换条）。
 * Board (appmode = english): 按住 S1 = PTT，S5 = next，S6 = home。
 */
import { el } from "../ui/dom.js";
import { WORDS, pickFrom } from "../content/words.js";
import { wordImage } from "../content/wordImage.js";
import { recordResult } from "../content/vocabStore.js";
import { LIBRARIES, getLibrary, setLibrary, getTrainingPool, libCount, getWordsByLevel } from "../content/library.js";
import { scorePronunciation } from "../speech/scorer.js";
import { randomPractice } from '../content/practiceRandom.js';
import { ROLE } from "../board/protocol.js";
import { miniKeypad } from "../ui/widgets.js";
import { moduleShell } from "../ui/shell.js";
import { classifyAttempt, afterSpeak, pronunciationHint } from "./flow.js";
import { getModuleLevel } from "../content/progress.js";
import { debugLog } from "../speech/debugLog.js";

const MODULE_KEY = "vocab";
const MAX_ATTEMPTS = 2;

export function mountVocabulary(ctx) {
  const sh = moduleShell(ctx, { title: "Vocabulary Challenge", moduleKey: MODULE_KEY });
  const pad = miniKeypad(ctx.keypad);

  const pictureBox = el("div", { class: "picture" });
  const wordBubble = el("div", { class: "word-bubble" });
  const spellBox = el("div", { class: "spell-out", style: "opacity:0;transition:opacity .2s" });
  const hint = el("p", { class: "hint" });
  const recordBtn = el("button", { class: "btn big hold", style: "touch-action:none" }, "🎤 Hold S1 & say it");

  sh.stage.append(
    el("div", { class: "stage-inner" }, [
      pictureBox, wordBubble, spellBox, hint, recordBtn,
    ])
  );
  sh.stage.append(pad.node);

  // —— 训练词库选择：全部 / 生词 / 易错 ——
  const libBar = el("div", { class: "lib-bar" });
  let library = getLibrary();
  function renderLibBar() {
    libBar.innerHTML = "";
    for (const L of LIBRARIES) {
      const n = L.key !== "all" ? libCount(L.key) : 0;
      libBar.appendChild(
        el("button", {
          class: "lib-btn" + (L.key === library ? " active" : ""),
          text: n ? `${L.label}（${n}）` : L.label,
          onClick: () => {
            library = L.key;
            setLibrary(library);
            renderLibBar();
            startRound();
          },
        })
      );
    }
  }
  sh.stage.insertBefore(libBar, sh.stage.firstChild);
  renderLibBar();

  let words = [];
  let total = 0;
  let idx = 0;
  let attempts = 0;
  let locked = false;
  let finished = false;
  let fragCount = 0;       // 连续「没听清」次数（防止半截识别卡死）
  let advanceTimer = null; // 延迟进下一题的定时器（卸载时清理）
  let detached = false;    // 模块是否已卸载（防止朗读结束后再写游离 DOM）

  function startRound() {
    const level = getModuleLevel(MODULE_KEY);
    const levelPool = getWordsByLevel(level);
    // 优先用用户选的库，再按等级过滤；如果选「生词/易错」则仍用该库，但难度会自动跟随等级
    const pool = library === "all" ? levelPool : getTrainingPool().filter((w) =>
      levelPool.some((x) => x.word === w.word)
    );
    words = randomPractice(pool.length ? pool : levelPool, 10, 'vocab-'+level+'-'+library);
    if (!words.length) {
      words = pickFrom(levelPool, 10);
      sh.setBanner(
        `「${library === "new" ? "生词库" : "易错词库"}」还是空的，先用全部单词库练练吧～`,
        "encourage"
      );
    }
    total = words.length;
    idx = 0;
    finished = false;
    sh.score.set(0);
    render();
  }

  function render() {
    const w = words[idx];
    pictureBox.innerHTML = wordImage(w);
    wordBubble.textContent = "";
    spellBox.textContent = "";
    spellBox.style.opacity = "0";
    hint.textContent = "Hold S1 and say the word — let go to stop.";
    recordBtn.textContent = "🎤 Hold S1 & say it";
    recordBtn.classList.remove("recording");
    attempts = 0;
    fragCount = 0;
    locked = false;
    sh.setProgress(idx + 1, total);
    sh.hideBanner();
    ctx.tts.speak("What is this?", { lang: "en-US" });
  }

  function handle(transcript) {
    debugLog(`handle('${transcript}')`);
    if (locked) return;
    const w = words[idx];
    if (!w || !w.word) {
      sh.setBanner("Oops, no word ready — press S5 to skip. 💡", "encourage");
      return;
    }
    const r = scorePronunciation({ target: w.word, actual: transcript, wordMode: true, level:getModuleLevel(MODULE_KEY) });
    // 半截识别（如 "g"/"h"）或空文本：当作「没听清」，不扣分、不消耗重试次数。
    if (r.fragment) {
      fragCount += 1;
      if (fragCount < 3) {
        sh.setBanner("I didn't hear that — hold S1 and say it again! 💡", "encourage");
        return;
      }
      // 连续多次仍没听清：不再卡住，揭示答案后进入下一题。
      locked = true;
      wordBubble.textContent = w.word;
      spellBox.textContent = pronunciationHint(w.word);
      spellBox.style.opacity = "1";
      sh.setBanner("Let's read it together: " + w.word, "reveal");
      ctx.flashLed(0xff5e9c);
      afterSpeak(ctx.tts.speak(w.word, { lang: "en-US", kind: "answer" }), {
        fn: advance,
        gap: 700,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
      return;
    }
    debugLog(`评分: target=${w.word} actual='${transcript}' match=${r.correct} Δ=${r.distance}`);
    attempts += 1;
    const heard = transcript.trim();
    const decision = classifyAttempt({ correct: r.correct, attemptsUsed: attempts, maxAttempts: MAX_ATTEMPTS });
    if (decision === "correct") {
      locked = true;
      sh.score.set(sh.score.get() + 10);
      wordBubble.textContent = w.word;
      spellBox.textContent = pronunciationHint(w.word);
      spellBox.style.opacity = "1";
      sh.setBanner("Correct! I heard '" + heard + "'. +10", "good");
      ctx.flashLed(0x74d39a);
      sh.reward("Wonderful!");
      recordResult(w.word, w.meaning, true);
      afterSpeak(ctx.tts.speak("Great! " + w.word, { lang: "en-US" }), {
        fn: advance,
        gap: 700,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
    } else if (decision === "retry") {
      ctx.fx?.wrong?.();
      sh.setBanner("I heard '" + heard + "'. Try again! 💪", "encourage");
      ctx.tts.speak("Try again!", { lang: "en-US" });
    } else {
      locked = true;
      ctx.fx?.reveal?.();
      wordBubble.textContent = w.word;
      spellBox.textContent = pronunciationHint(w.word);
      spellBox.style.opacity = "1";
      sh.setBanner("I heard '" + heard + "'. It is " + w.word + ".", "reveal");
      ctx.flashLed(0xff5e9c);
      recordResult(w.word, w.meaning, false, "wrong");
      // 等答案音真正读完再进下一题，避免被下一题的提问打断
      afterSpeak(ctx.tts.speak("It is " + w.word, { lang: "en-US", kind: "answer" }), {
        fn: advance,
        gap: 700,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
    }
  }

  function advance() {
    if (finished) return;
    clearTimeout(advanceTimer); // 手动推进时取消待触发的自动推进，避免连跳两题
    idx += 1;
    if (idx >= total) {
      finished = true;
      sh.finale({
        score: sh.score.get(),
        max: total * 10,
        onReplay: () => {
          sh.score.set(0);
          idx = 0;
          finished = false;
          sh.setLevel(getModuleLevel(MODULE_KEY));
          startRound();
          render();
        },
        onHome: () => ctx.goHome(),
      });
    } else {
      render();
    }
  }

  const onState = (rec) => {
    debugLog("onState: " + rec);
    recordBtn.classList.toggle("recording", rec);
    recordBtn.textContent = rec ? "Listening… (hold)" : "🎤 Hold S1 & say it";
    // 不再播 "Speak now" 之类的引导词：按住就直接说
  };
  const onInterim = (text) => {
    recordBtn.textContent = "🎤 " + text;
  };
  const onSpeech = (r) => { debugLog("ASR 返回: '" + r.transcript + "'"); handle(r.transcript); };
  const onNoResult = () => {
    debugLog("onNoResult（本次无语音结果）", "warn");
    sh.setBanner("I didn't hear that — hold S1 and say it again! 💡", "encourage");
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
    if (locked) return;
    ctx.recorder.start("en-US", { onResult: onSpeech, onNoResult, onError: onSpeechError, onState, onInterim });
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
    // 已锁定（刚答完等待自动进入下一题）时忽略 NEXT，避免跳过一题
    if (i === ROLE.NEXT) {
      if (locked) return;
      clearTimeout(advanceTimer);
      advance();
    } else if (i === ROLE.HOME) ctx.goHome();
  });
  recordBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); startRecording(); });
  recordBtn.addEventListener("pointerup", () => stopRecording());
  recordBtn.addEventListener("pointerleave", () => stopRecording());
  recordBtn.addEventListener("pointercancel", () => stopRecording());

  startRound();

  return {
    unmount() {
      detached = true;
      unsubKey();
      pad.unsub();
      clearTimeout(advanceTimer);
      ctx.recorder.stop();
      ctx.tts.cancel();
    },
  };
}
