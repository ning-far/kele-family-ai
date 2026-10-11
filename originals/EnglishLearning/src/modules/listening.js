/**
 * Module 2 — Listening Comprehension (听理解练习)
 *
 * 板子播一句英文（如 "Where is the apple?"），三个图片选项，孩子用
 * S1 / S2 / S3（或点按）选。训练词库可选：
 *   - 全部：用精选的 LISTENING 句型
 *   - 生词库 / 易错词库：从对应库的词动态生成听力题，专练薄弱环节
 *   - correct            -> reward +10，自动下一题
 *   - wrong (1st try)    -> "Not quite — try again!"（同题，一次重试）
 *   - wrong (2nd try)    -> 揭示答案，自动下一题（不扣分）
 *
 * Board (appmode = english): S1/S2/S3 choose, S4 replay, S5 next, S6 home。
 */
import { el, clear, pictureCard } from "../ui/dom.js";
import { LISTENING } from "../content/lessons.js";
import { WORDS, entryByWord, pickFrom } from "../content/words.js";
import { wordImage } from "../content/wordImage.js";
import { recordResult } from "../content/vocabStore.js";
import { scorePronunciation } from "../speech/scorer.js";
import { randomPractice } from '../content/practiceRandom.js';
import { debugLog } from "../speech/debugLog.js";
import { LIBRARIES, getLibrary, setLibrary, getTrainingPool, libCount, getWordsByLevel } from "../content/library.js";
import { ROLE } from "../board/protocol.js";
import { miniKeypad } from "../ui/widgets.js";
import { moduleShell } from "../ui/shell.js";
import { afterSpeak, pronunciationHint } from "./flow.js";
import { getModuleLevel } from "../content/progress.js";

const MODULE_KEY = "listen";
const MAX_ATTEMPTS = 2;

/** 从一组词（生词/易错）生成听力题：每题 3 个图片选项（答案 + 2 个干扰）。 */
function buildListeningItems(pool) {
  const items = [];
  for (const w of pool) {
    const others = pickFrom(
      WORDS.filter((x) => x.word !== w.word && x.emoji),
      2
    );
    const opts = pickFrom([w, ...others], 3); // 打乱顺序
    const answer = opts.findIndex((o) => o.word === w.word);
    const tmpl = pickFrom(
      [`Where is the ${w.word}?`, `Touch the ${w.word}.`, `Which one is ${w.word}?`, `Find the ${w.word}.`],
      1
    )[0];
    items.push({
      prompt: tmpl,
      options: opts.map((o) => ({ word: o.word, emoji: o.emoji, meaning: o.meaning })),
      answer,
    });
  }
  return items;
}

export function mountListening(ctx) {
  const sh = moduleShell(ctx, { title: "Listening Time", moduleKey: MODULE_KEY });
  const pad = miniKeypad(ctx.keypad);

  const promptBubble = el("div", { class: "word-bubble" });
  const hint = el("p", { class: "hint" });
  const optionsRow = el("div", { class: "row" });
  const replayBtn = el("button", { class: "btn yellow", onClick: () => playPrompt() }, "🔁 Play again (S4)");
  const speakBubble = el("div", { class: "word-bubble hidden", style: "font-size:clamp(20px,5vw,34px)" });
  const spellBox = el("div", { class: "spell-out hidden", style: "transition:opacity .2s" });
  const recordBtn = el("button", { class: "btn big hold hidden", style: "touch-action:none" }, "🎤 Hold S1 & say it");

  sh.stage.append(
    el("div", { class: "stage-inner" }, [promptBubble, hint, optionsRow, replayBtn, speakBubble, spellBox, recordBtn])
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

  let items = [];
  let total = 0;
  let maxPer = 10;
  let withSpeak = false;
  let idx = 0;
  let phase = "listen";
  let attempts = 0;
  let speakAttempts = 0;
  let locked = false;
  let finished = false;
  let cards = [];
  let fragCount = 0;       // 跟读时连续「没听清」次数
  let advanceTimer = null; // 延迟进下一题的定时器（卸载时清理）
  let detached = false;    // 模块是否已卸载（防止朗读结束后再写游离 DOM）

  function startRound() {
    withSpeak = library === "new" || library === "hard";
    maxPer = withSpeak ? 20 : 10;
    const level = getModuleLevel(MODULE_KEY);
    const levelPool = getWordsByLevel(level);
    if (withSpeak) {
      const pool = getTrainingPool().filter((w) =>
        levelPool.some((x) => x.word === w.word)
      );
      items = buildListeningItems(pool.length ? pool : levelPool);
      if (!items.length) {
        items = LISTENING.slice();
        sh.setBanner(
          `「${library === "new" ? "生词库" : "易错词库"}」还是空的，先用全部单词库练练吧～`,
          "encourage"
        );
      }
    } else {
      items = LISTENING.filter((it) =>
        levelPool.some((w) => w.word === it.options[it.answer]?.word)
      );
      if (!items.length) items = LISTENING.slice();
    }
    items=randomPractice(items,items.length,'listen-'+level+'-'+library);
    total = items.length;
    idx = 0;
    sh.score.set(0);
    render();
  }

  function playPrompt() {
    ctx.tts.speak(items[idx].prompt, { lang: "en-US", rate: 0.85 });
  }

  function render() {
    phase = "listen";
    renderListen();
  }

  function renderListen() {
    const it = items[idx];
    promptBubble.textContent = "";
    attempts = 0;
    fragCount = 0;
    locked = false;
    sh.setProgress(idx + 1, total);
    sh.hideBanner();
    hint.textContent = withSpeak
      ? "Listen, choose (S1/S2/S3) — then you'll say it! 🎤"
      : "Listen, then press S1, S2 or S3 to choose.";
    optionsRow.classList.remove("hidden");
    replayBtn.classList.remove("hidden");
    recordBtn.classList.add("hidden");
    speakBubble.classList.add("hidden");
    spellBox.classList.add("hidden");
    clear(optionsRow);
    cards = it.options.map((opt, i) => {
      const entry = entryByWord(opt.word) || { word: opt.word, emoji: opt.emoji, meaning: opt.meaning };
      const c = pictureCard(wordImage(entry, { noText: true }), "", () => choose(i));
      optionsRow.appendChild(c);
      return c;
    });
    playPrompt();
  }

  /** 生词/易错库：听完选完后，再让小朋友开口跟读这个单词。 */
  function renderSpeak() {
    phase = "speak";
    speakAttempts = 0;
    fragCount = 0;
    locked = false;
    const it = items[idx];
    const opt = it.options[it.answer];
    const w = opt.word;
    const entry = entryByWord(w) || { word: w, emoji: opt.emoji, meaning: opt.meaning };
    sh.setProgress(idx + 1, total);
    sh.hideBanner();
    promptBubble.textContent = "Now say it! 🎤";
    hint.textContent = "Hold S1 (or the button) and say the word — let go to stop.";
    optionsRow.classList.remove("hidden");
    replayBtn.classList.add("hidden");
    recordBtn.classList.remove("hidden");
    speakBubble.classList.remove("hidden");
    speakBubble.textContent = w;
    spellBox.textContent = pronunciationHint(w);
    spellBox.classList.remove("hidden");
    clear(optionsRow);
    optionsRow.appendChild(el("div", { class: "picture big", html: wordImage(entry, { noText: true }) }));
    ctx.tts.speak(w, { lang: "en-US", rate: 0.85 });
  }

  function choose(i) {
    if (locked) return;
    const it = items[idx];
    attempts += 1;
    if (i === it.answer) {
      locked = true;
      sh.score.set(sh.score.get() + 10);
      cards.forEach((c, j) => { if (j === it.answer) c.classList.add("correct"); });
      sh.setBanner("Good job! +10", "good");
      ctx.flashLed(0x74d39a);
      sh.reward("Great!");
      afterSpeak(ctx.tts.speak("Good job!", { lang: "en-US" }), {
        fn: afterListen,
        gap: 700,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
    } else {
      cards[i].classList.add("wrong");
      if (attempts < MAX_ATTEMPTS) {
        ctx.fx?.wrong?.();
        sh.setBanner("Not quite — try again!", "encourage");
        ctx.tts.speak("Try again!", { lang: "en-US" });
      } else {
        locked = true;
        ctx.fx?.reveal?.();
        cards.forEach((c, j) => { if (j === it.answer) c.classList.add("correct"); });
        const aw = it.options[it.answer].word;
        speakBubble.textContent = aw;
        speakBubble.classList.remove("hidden");
        spellBox.textContent = pronunciationHint(aw);
        spellBox.classList.remove("hidden");
        sh.setBanner("The answer is " + aw + ".", "reveal");
        ctx.flashLed(0xff5e9c);
        recordResult(aw, entryByWord(aw).meaning, false, "wrong");
        afterSpeak(ctx.tts.speak("The answer is " + aw, { lang: "en-US", kind: "answer" }), {
          fn: afterListen,
          gap: 700,
          alive: () => !detached,
          setTimer: (t) => { advanceTimer = t; },
        });
      }
    }
  }

  function afterListen() {
    if (finished) return;
    clearTimeout(advanceTimer);
    if (withSpeak) renderSpeak();
    else advance();
  }

  function advance() {
    if (finished) return;
    clearTimeout(advanceTimer);
    idx += 1;
    if (idx >= total) {
      finished = true;
      sh.finale({
        score: sh.score.get(),
        max: total * maxPer,
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

  const unsubKey = ctx.keypad.onKey((i, down) => {
    if (phase === "speak") {
      if (i === ROLE.PTT) {
        if (down) startSpeak();
        else stopSpeak();
      } else if (!down && i === ROLE.HOME) ctx.goHome();
      return;
    }
    if (!down) return;
    if (locked) return;
    if (i === ROLE.OPTION_B) choose(1);
    else if (i === ROLE.OPTION_C) choose(2);
    else if (i === ROLE.PTT) choose(0); // S1 = option A
    else if (i === ROLE.REPEAT) playPrompt();
    else if (i === ROLE.NEXT) { clearTimeout(advanceTimer); advance(); }
    else if (i === ROLE.HOME) ctx.goHome();
  });

  // —— 跟读（生词/易错库）：听完后开口说单词 ——
  const onSpeakState = (rec) => {
    recordBtn.classList.toggle("recording", rec);
    recordBtn.textContent = rec ? "Listening… (hold)" : "🎤 Hold S1 & say it";
  };
  const onSpeakInterim = (text) => { recordBtn.textContent = "🎤 " + text; };
  const onSpeech = (r) => { debugLog("ASR 返回(跟读): '" + r.transcript + "'"); handleSpeak(r.transcript); };
  const onSpeakNo = () => {
    sh.setBanner("I didn't hear that — hold S1 and say it again! 💡", "encourage");
  };
  const onSpeakErr = (err) => {
    if (err === "not-allowed" || err === "service-not-allowed")
      sh.setBanner("请允许浏览器使用麦克风 🔒 点地址栏的麦克风图标 → 允许", "reveal");
    else if (err === "not-secure-context")
      sh.setBanner("语音需要 HTTPS 或 localhost；刷新页面用麦克风录音 🔒", "reveal");
    else if (err === "not-supported")
      sh.setBanner("当前浏览器不支持语音识别，请用 Chrome/Edge 打开 💡", "reveal");
    else onSpeakNo();
  };
  function startSpeak() {
    if (phase !== "speak" || locked) return;
    ctx.recorder.start("en-US", {
      onResult: onSpeech, onNoResult: onSpeakNo, onError: onSpeakErr,
      onState: onSpeakState, onInterim: onSpeakInterim,
    });
  }
  function stopSpeak() { ctx.recorder.release(); }

  recordBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); startSpeak(); });
  recordBtn.addEventListener("pointerup", () => stopSpeak());
  recordBtn.addEventListener("pointerleave", () => stopSpeak());
  recordBtn.addEventListener("pointercancel", () => stopSpeak());

  function handleSpeak(transcript) {
    if (locked) return;
    const it = items[idx];
    if (!it || !it.options || !it.options[it.answer]) {
      sh.setBanner("Oops, no word ready — press S5 to skip. 💡", "encourage");
      return;
    }
    const w = it.options[it.answer].word;
    const r = scorePronunciation({ target: w, actual: transcript, wordMode: true, level:getModuleLevel(MODULE_KEY) });
    // 半截识别：当作「没听清」，不消耗重试次数；连续多次则给答案，避免卡死。
    if (r.fragment) {
      fragCount += 1;
      if (fragCount < 3) {
        sh.setBanner("I didn't hear that — hold S1 and say it again! 💡", "encourage");
        return;
      }
      locked = true;
      speakBubble.textContent = w;
      spellBox.textContent = pronunciationHint(w);
      spellBox.classList.remove("hidden");
      sh.setBanner("Let's read it: " + w, "reveal");
      ctx.flashLed(0xff5e9c);
      afterSpeak(ctx.tts.speak(w, { lang: "en-US", kind: "answer" }), {
        fn: advance,
        gap: 700,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
      return;
    }
    speakAttempts += 1;
    if (r.correct) {
      locked = true;
      sh.score.set(sh.score.get() + 10);
      speakBubble.textContent = w;
      spellBox.textContent = pronunciationHint(w);
      spellBox.classList.remove("hidden");
      sh.setBanner("Great! I heard '" + w + "'. +10", "good");
      ctx.flashLed(0x74d39a);
      sh.reward("Wonderful!");
      recordResult(w, entryByWord(w).meaning, true);
      afterSpeak(ctx.tts.speak("Great! " + w, { lang: "en-US" }), {
        fn: advance,
        gap: 700,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
    } else if (speakAttempts < MAX_ATTEMPTS) {
      ctx.fx?.wrong?.();
      sh.setBanner("I heard '" + transcript.trim() + "'. Try again! 💪", "encourage");
      ctx.tts.speak("Try again!", { lang: "en-US" });
    } else {
      locked = true;
      ctx.fx?.reveal?.();
      speakBubble.textContent = w;
      spellBox.textContent = pronunciationHint(w);
      spellBox.classList.remove("hidden");
      sh.setBanner("The word is " + w + ".", "reveal");
      ctx.flashLed(0xff5e9c);
      recordResult(w, entryByWord(w).meaning, false, "wrong");
      afterSpeak(ctx.tts.speak("The word is " + w, { lang: "en-US", kind: "answer" }), {
        fn: advance,
        gap: 700,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
    }
  }

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
