/**
 * Module 3 — Speak (开口说：单词 → 短语 → 句子，按等级递进)
 *
 * 等级设计：
 *   Level 1：简单单词（apple, cat…）
 *   Level 2：短短语（a cat / red apple / I see a dog…）
 *   Level 3+：完整句子
 *
 * Board (appmode = english): 按住 S1 = PTT，S4 = replay，S5 = next，S6 = home。
 */
import { el } from "../ui/dom.js";
import { WORDS, entryByWord, pickFrom } from "../content/words.js";
import { wordImage } from "../content/wordImage.js";
import { getWordsByLevel } from "../content/library.js";
import { getModuleLevel } from "../content/progress.js";
import { scorePronunciation } from "../speech/scorer.js";
import { randomPractice } from '../content/practiceRandom.js';
import { recordResult } from '../content/vocabStore.js';
import { ROLE } from "../board/protocol.js";
import { miniKeypad } from "../ui/widgets.js";
import { moduleShell } from "../ui/shell.js";
import { classifyAttempt, afterSpeak, pronunciationHint } from "./flow.js";
import { debugLog } from "../speech/debugLog.js";

const MODULE_KEY = "speak";
const MAX_ATTEMPTS = 2;

const art = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");

export function buildLevel1Items() {
  const words = pickFrom(getWordsByLevel(1), 12);
  return words.map((w) => ({ text: w.word, word: w.word, level: 1 }));
}

export function buildLevel2Items() {
  const words = pickFrom(getWordsByLevel(2), 14);
  const colors = WORDS.filter((w) => w.category === "color");
  const verbs = ["see", "like", "want", "eat"];
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const c = colors[i % colors.length]?.word;
    switch (i % 5) {
      case 0:
        out.push({ text: `${art(w.word)} ${w.word}.`, word: w.word, level: 2 });
        break;
      case 1:
        out.push({ text: c ? `The ${c} ${w.word}.` : `${art(w.word)} ${w.word}.`, word: w.word, level: 2 });
        break;
      case 2:
        out.push({ text: `I ${pickFrom(verbs, 1)[0]} ${art(w.word)} ${w.word}.`, word: w.word, level: 2 });
        break;
      case 3:
        out.push({ text: `It is ${art(w.word)} ${w.word}.`, word: w.word, level: 2 });
        break;
      default:
        out.push({ text: `This is ${art(w.word)} ${w.word}.`, word: w.word, level: 2 });
    }
  }
  return out;
}

export function buildLevel3Items() {
  const nounCats = ["animals", "food", "fruit", "daily", "vehicle", "body", "nature", "clothing", "school", "place"];
  const nouns = WORDS.filter((w) => nounCats.includes(w.category) && !["water", "milk"].includes(w.word));
  const foods = WORDS.filter((w) => w.category === "food" || w.category === "fruit");
  const animals = WORDS.filter((w) => w.category === "animals");
  const colors = WORDS.filter((w) => w.category === "color");
  const emotions = WORDS.filter((w) => w.category === "emotion");
  const verbs = ["run", "jump", "swim", "fly", "sleep", "eat", "sing", "dance"];

  const out = [];
  const push = (text, word) => out.push({ text, word, level: 3 });
  for (const n of nouns) {
    push(`I have ${art(n.word)} ${n.word}.`, n.word);
    push(`I see ${art(n.word)} ${n.word}.`, n.word);
    push(`This is ${art(n.word)} ${n.word}.`, n.word);
  }
  for (const f of foods) push(`I eat ${f.word}.`, f.word);
  for (const d of ["water", "milk"]) push(`I drink ${d}.`, d);
  for (const a of animals) for (const v of verbs) push(`A ${a.word} can ${v}.`, a.word);
  for (const n of nouns) for (const c of colors) push(`The ${c.word} ${n.word} is cute.`, n.word);
  for (const e of emotions) push(`I am ${e.word}.`, e.word);

  const seen = new Set();
  const uniq = out.filter((s) => (seen.has(s.text) ? false : (seen.add(s.text), true)));
  return pickFrom(uniq, Math.min(14, uniq.length));
}

function buildSpeakItems() {
  const level = getModuleLevel(MODULE_KEY);
  let items;
  if (level <= 1) items = buildLevel1Items();
  else if (level === 2) items = buildLevel2Items();
  else items = buildLevel3Items();
  // 该等级词库为空（如自定义词库只配了高学段词）时的兜底
  if (!items.length) items = buildLevel3Items();
  return randomPractice(items,items.length,'speak-'+level);
}

export function mountSpeak(ctx) {
  const sh = moduleShell(ctx, { title: "Speak", moduleKey: MODULE_KEY });
  const pad = miniKeypad(ctx.keypad);

  const pictureBox = el("div", { class: "picture" });
  const sentenceText = el("div", { class: "word-bubble", style: "font-size:clamp(18px,4vw,32px)" });
  const spellBox = el("div", { class: "spell-out", style: "opacity:0;transition:opacity .2s" });
  const hint = el("p", { class: "hint" });
  const recordBtn = el("button", { class: "btn big hold", style: "touch-action:none" }, "🎤 Hold S1 & repeat");
  const replayBtn = el("button", { class: "btn yellow", onClick: () => playTarget() }, "🔁 Play again (S4)");

  sh.stage.append(
    el("div", { class: "stage-inner" }, [
      pictureBox, sentenceText, spellBox, hint, recordBtn, replayBtn,
    ])
  );
  sh.stage.append(pad.node);

  let level, title, promptHint, items, total;
  let idx = 0;
  let attempts = 0;
  let locked = false;
  let finished = false;
  let advanceTimer = null;
  let detached = false;
  let mistakeRecorded = false;

  function startRound() {
    level = getModuleLevel(MODULE_KEY);
    title = level <= 1 ? "Speak a Word" : level === 2 ? "Speak a Phrase" : "Speak a Sentence";
    promptHint = level <= 1
      ? "Hold S1 and say the word — let go to stop."
      : level === 2
      ? "Hold S1 and say the phrase — let go to stop."
      : "Hold S1 and repeat the sentence — let go to stop.";
    items = buildSpeakItems();
    total = items.length;
    idx = 0;
    attempts = 0;
    locked = false;
    finished = false;
    sh.setTitle(title);
    sh.setLevel(level);
    sh.setProgress(1, total || 1);
    if (total) render();
    else {
      sentenceText.textContent = "Oops, no words found!";
      sh.setBanner("词库里暂时没有足够的词，先回首页吧～", "reveal");
    }
  }

  function playTarget() {
    if (!items.length) return;
    ctx.tts.speak(items[idx].text, { lang: "en-US", rate: 0.85 });
  }

  function render() {
    const it = items[idx];
    pictureBox.innerHTML = wordImage(entryByWord(it.word) || { word: it.word });
    sentenceText.textContent = it.text;
    sentenceText.classList.remove("reveal-answer");
    spellBox.textContent = level <= 1 ? pronunciationHint(it.word) : "";
    spellBox.style.opacity = level <= 1 ? "1" : "0";
    hint.textContent = promptHint+' 练习参考分：第1关50 / 第2关65 / 第3关起80；依据识别文本，非专业音素评分。';
    recordBtn.textContent = "🎤 Hold S1 & repeat";
    recordBtn.classList.remove("recording");
    attempts = 0;
    locked = false;
    sh.setProgress(idx + 1, total);
    mistakeRecorded = false;
    sh.hideBanner();
    playTarget();
  }

  function handle(transcript) {
    debugLog(`handle('${transcript}')`);
    if (locked || detached || finished) return;
    if (!transcript?.trim()) {
      sh.setBanner("I didn't hear that — hold S1 and say it again! 💡", "encourage");
      return;
    }
    const it = items[idx];
    const r = scorePronunciation({ target: it.text, actual: transcript, wordMode:level<=1, level });
    debugLog(`评分: target=${it.text} actual=${transcript} score=${r.score}`);
    attempts += 1;
    const decision = classifyAttempt({ correct: r.correct, attemptsUsed: attempts, maxAttempts: MAX_ATTEMPTS });
    // One failure per question, even when both recording attempts are wrong.
    // Phrases/sentences collect their target vocabulary, not a fake new word.
    const meaning = entryByWord(it.word)?.meaning || '';
    if (!r.correct && !mistakeRecorded) {
      recordResult(it.word, meaning, false);
      mistakeRecorded = true;
    }
    if (decision === "correct") {
      recordResult(it.word, meaning, true);
      locked = true;
      const pts = r.score >= 90 ? 10 : r.score >= 80 ? 9 : 8;
      const tier = r.score >= 90 ? "Perfect!" : r.score >= 80 ? "Great!" : "Good!";
      sh.score.set(sh.score.get() + pts);
      sh.setBanner("Score " + r.score + " — " + tier + " +" + pts, "good");
      ctx.flashLed(0x74d39a);
      sh.reward(tier === "Perfect!" ? "Perfect!" : "Excellent!");
      if (level <= 1) {
        spellBox.textContent = pronunciationHint(it.word);
        spellBox.style.opacity = "1";
      }
      afterSpeak(ctx.tts.speak(tier + " You did it!", { lang: "en-US" }), {
        fn: advance,
        gap: 700,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
    } else if (decision === "retry") {
      ctx.fx?.wrong?.();
      sh.setBanner("Almost! Score " + r.score + " — let's try once more 💪", "encourage");
      ctx.tts.speak("Try again!", { lang: "en-US" });
    } else {
      locked = true;
      ctx.fx?.reveal?.();
      sentenceText.textContent = it.text;
      sentenceText.classList.add("reveal-answer");
      spellBox.textContent = pronunciationHint(it.word);
      spellBox.style.opacity = "1";
      sh.setBanner("The answer is: " + it.text, "reveal");
      ctx.flashLed(0xff5e9c);
      afterSpeak(ctx.tts.speak("The answer is: " + it.text, { lang: "en-US", rate: 0.75, kind: "answer" }), {
        fn: advance,
        gap: 700,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
    }
  }

  function advance() {
    if (finished) return;
    clearTimeout(advanceTimer);
    idx += 1;
    if (idx >= total) {
      finished = true;
      sh.finale({
        score: sh.score.get(),
        max: total * 10,
        onReplay: () => { sh.score.set(0); startRound(); },
        onHome: () => ctx.goHome(),
      });
    } else {
      afterSpeak(ctx.tts.speak("Next!", { lang: "en-US" }), {
        fn: render,
        gap: 200,
        alive: () => !detached,
        setTimer: (t) => { advanceTimer = t; },
      });
    }
  }

  const onState = (rec) => {
    debugLog("onState: " + rec);
    recordBtn.classList.toggle("recording", rec);
    recordBtn.textContent = rec ? "Listening… (hold)" : "🎤 Hold S1 & repeat";
  };
  const onInterim = (text) => { recordBtn.textContent = "🎤 " + text; };
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
    if (i === ROLE.REPEAT) playTarget();
    else if (i === ROLE.NEXT) { if (locked) return; clearTimeout(advanceTimer); advance(); }
    else if (i === ROLE.HOME) ctx.goHome();
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
