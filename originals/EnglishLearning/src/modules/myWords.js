/**
 * Module 5 — 三库中心：单词库 / 生词库 / 易错词库
 *
 * 三个标签页：
 *   1) 单词库（bank）：完整主词库，按分类浏览，可一键加进生词库、可朗读。
 *   2) 生词库（new）：做错第一次自动收录 + 手动添加；可针对性练习。
 *   3) 易错词库（hard）：同一词反复错自动收录；可针对性强化练习。
 *
 * 数据存 localStorage（见 content/vocabStore.js），不上传、不依赖网络。
 * 统计来源：Vocabulary / Listening 模块每次作答都会回写 recordResult。
 */
import { el, clear } from "../ui/dom.js";
import { ROLE } from "../board/protocol.js";
import { miniKeypad } from "../ui/widgets.js";
import { moduleShell } from "../ui/shell.js";
import { wordImage } from "../content/wordImage.js";
import { WORDS, CATEGORIES, entryByWord } from "../content/words.js";
import {
  newWords,
  hardWords,
  addManual,
  recordResult,
  removeWord,
} from "../content/vocabStore.js";
import { scorePronunciation } from "../speech/scorer.js";
import {getModuleLevel} from '../content/progress.js';
import { classifyAttempt, afterSpeak, pronunciationHint } from "./flow.js";

/** 解析 "dog 代表 狗" / "dog means 狗" / "苹果 是 apple" 这类添加语句。 */
function parseAddPhrase(text) {
  let s = String(text || "")
    .trim()
    .replace(/[。.!！?？~～,，]/g, "");
  for (const p of ["添加", "记一下", "记住", "收录", "我要加", "新词", "记录"])
    if (s.startsWith(p)) s = s.slice(p.length).trim();
  const seps = ["代表", "means", "意思是", "意为", "＝", "=", "：", ":", "→", "->", "是"];
  let word = "";
  let meaning = "";
  for (const sp of seps) {
    const i = s.indexOf(sp);
    if (i >= 0) {
      word = s.slice(0, i).trim();
      meaning = s.slice(i + sp.length).trim();
      break;
    }
  }
  if (!word && !meaning) word = s;
  const isZh = (x) => /[一-鿿]/.test(x);
  if (isZh(word) && !isZh(meaning)) {
    const t = word;
    word = meaning;
    meaning = t;
  }
  word = word.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  meaning = meaning.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  return { word, meaning };
}

export function mountMyWords(ctx) {
  const sh = moduleShell(ctx, { title: "My Words 三库中心" });
  const pad = miniKeypad(ctx.keypad);

  let currentTab = "bank";
  let activePracticeUnsub = null; // 针对性练习中当前题的按键订阅
  let practiceTimers = [];        // 针对性练习中待触发的定时器（卸载时清理）
  let detached = false;           // 模块是否已卸载（防止朗读结束后再写游离 DOM）

  const tabBar = el("div", { class: "tab-bar" });
  const content = el("div", { class: "mw-content" });
  sh.stage.append(tabBar, content);

  function speak(word) {
    ctx.tts.speak(word, { lang: "en-US" });
  }

  function renderTabs() {
    tabBar.innerHTML = "";
    const tabs = [
      { k: "bank", l: "单词库", n: WORDS.length },
      { k: "new", l: "生词库", n: newWords().length },
      { k: "hard", l: "易错词库", n: hardWords().length },
    ];
    for (const t of tabs) {
      tabBar.appendChild(
        el("button", {
          class: "tab-btn" + (currentTab === t.k ? " active" : ""),
          text: `${t.l}（${t.n}）`,
          onClick: () => {
            currentTab = t.k;
            renderTabs();
            renderContent();
          },
        })
      );
    }
  }

  function renderContent() {
    if (currentTab === "bank") renderBank();
    else if (currentTab === "new") renderList(newWords(), "new");
    else renderList(hardWords(), "hard");
  }

  /* ---------------- 单词库（主词库浏览） ---------------- */
  function renderBank() {
    clear(content);
    content.appendChild(pad.node);
    const head = el("div", { class: "mw-head" }, [
      el("div", { class: "hint", text: `共 ${WORDS.length} 个词 · 覆盖幼儿园 + 小学一年级` }),
      el("button", { class: "btn green small", onClick: () => startAdd() }, "➕ 添加生词"),
    ]);
    content.appendChild(head);

    const wrap = el("div", { class: "bank-wrap" });
    for (const [cat, label] of Object.entries(CATEGORIES)) {
      const items = WORDS.filter((w) => w.category === cat);
      if (!items.length) continue;
      wrap.appendChild(el("div", { class: "cat-label", text: `${label}（${items.length}）` }));
      const grid = el("div", { class: "bank-grid" });
      for (const w of items) {
        grid.appendChild(
          el("div", { class: "mw-row" }, [
            el("div", { class: "mw-thumb", html: wordImage(w) }),
            el("div", { class: "mw-info" }, [
              el("div", { class: "mw-word", text: w.word }),
              el("div", { class: "mw-mean", text: w.meaning }),
              el("div", { class: "spell-out ipa-inline", text: pronunciationHint(w.word) }),
            ]),
            el("button", { class: "mw-play", title: "朗读", onClick: () => speak(w.word) }, "🔊"),
            el(
              "button",
              {
                class: "mw-del",
                title: "加进生词库",
                onClick: () => {
                  addManual(w.word, w.meaning);
                  ctx.toast("已加进生词库：" + w.word);
                },
              },
              "➕"
            ),
          ])
        );
      }
      wrap.appendChild(grid);
    }
    content.appendChild(wrap);
  }

  /* ---------------- 生词库 / 易错词库 列表 ---------------- */
  function renderList(list, kind) {
    clear(content);
    content.appendChild(pad.node);
    const isNew = kind === "new";
    const title = isNew ? "生词库" : "易错词库";
    const head = el("div", { class: "mw-head" }, [
      el("div", { class: "hint", text: `共 ${list.length} 个${title} · 可针对性练习` }),
      el("div", { class: "row mw-actions" }, [
        list.length
          ? el("button", { class: "btn blue small", onClick: () => startPractice(list, title) }, "🎯 针对性练习")
          : null,
        list.length
          ? el("button", { class: "btn ghost small", onClick: () => confirmClear(kind) }, "🗑 清空")
          : null,
      ]),
    ]);
    content.appendChild(head);

    if (!list.length) {
      content.appendChild(
        el("p", { class: "hint center" }, isNew
          ? "生词库还是空的。做错题会自动进来，也可以去「单词库」点 ➕ 加一个。"
          : "易错词库还是空的。同一词反复答错就会自动进这里，专门强化。")
      );
      return;
    }

    const ul = el("div", { class: "mywords-list" });
    for (const v of list) {
      const entry = entryByWord(v.word) || { word: v.word, emoji: "📝" };
      const row = el("div", { class: "mw-row" }, [
        el("div", { class: "mw-thumb", html: wordImage({ ...entry, word: v.word, meaning: v.meaning }) }),
        el("div", { class: "mw-info" }, [
          el("div", { class: "mw-word", text: v.word }),
          el("div", { class: "mw-mean", text: v.meaning || "" }),
          el("div", { class: "spell-out ipa-inline", text: pronunciationHint(v.word) }),
          el("div", { class: "mw-stats", text: `✅${v.correctCount} ❌${v.wrongCount}` }),
        ]),
        el("button", { class: "mw-play", title: "朗读", onClick: () => speak(v.word) }, "🔊"),
        el("button", { class: "mw-del", title: "删除", onClick: () => { removeWord(v.id); renderTabs(); renderContent(); } }, "×"),
      ]);
      ul.appendChild(row);
    }
    content.appendChild(ul);
  }

  /* ---------------- 添加生词 ---------------- */
  function startAdd() {
    clear(content);
    content.appendChild(pad.node);
    const enInput = el("input", { class: "type-input", placeholder: "英文，如 dog" });
    const zhInput = el("input", { class: "type-input", placeholder: "中文释义，如 狗" });
    const micBtn = el("button", { class: "btn big" }, "🎤 说一句（dog 代表 狗）");
    const addBtn = el("button", { class: "btn green", onClick: () => commit() }, "保存到生词库");
    const backBtn = el("button", { class: "btn ghost small", onClick: () => renderContent() }, "← 返回");

    function commit() {
      const w = enInput.value.trim();
      const m = zhInput.value.trim();
      if (!w) {
        sh.setBanner("英文不能为空", "reveal");
        return;
      }
      addManual(w, m);
      ctx.toast("已添加：" + w + (m ? " = " + m : ""));
      sh.setBanner("已加入生词库 📒", "good");
      renderTabs();
      renderContent();
    }

    content.append(
      el("div", { class: "stage-inner" }, [
        el("p", { class: "hint" }, "按住麦克风说「dog 代表 狗」，或直接打字。"),
        micBtn,
        el("div", { class: "type-row" }, [enInput, zhInput]),
        el("div", { class: "row" }, [addBtn, backBtn]),
      ])
    );

    const onState = (rec) => {
      micBtn.classList.toggle("recording", rec);
      micBtn.textContent = rec ? "Listening… 再按一次停止" : "🎤 说一句（dog 代表 狗）";
    };
    const onInterim = (t) => { micBtn.textContent = "🎤 " + t; };
    const onNoResult = () => sh.setBanner("没听清，直接打字也行", "encourage");
    const onErr = (e) => {
      if (e === "not-allowed" || e === "not-supported" || e === "not-secure-context")
        sh.setBanner("麦克风不可用，请直接打字", "reveal");
      else onNoResult();
    };
    function onResult({ transcript }) {
      const t = (transcript || "").trim();
      if (!t) return onNoResult();
      const p = parseAddPhrase(t);
      enInput.value = p.word;
      zhInput.value = p.meaning;
      if (p.word) commit();
      else sh.setBanner("听到了：" + t + "，请补全英文 / 中文", "reveal");
    }
    function startRec() {
      ctx.recorder.toggle("zh-CN", { onResult, onNoResult, onError: onErr, onState, onInterim });
    }
    micBtn.addEventListener("click", startRec);
    enInput.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });
  }

  /* ---------------- 针对性练习 ---------------- */
  function startPractice(queue, label) {
    if (!queue.length) {
      sh.setBanner("这个库是空的，先去练练吧", "good");
      return;
    }
    let idx = 0;
    const total = queue.length;
    let right = 0;
    let locked = false;
    let finished = false;
    let attempts = 0;
    let fragCount = 0;

    function render() {
      const v = queue[idx];
      locked = false; // 复位：否则第 2 题起 locked 仍为 true，会卡死无法录音
      attempts = 0;
      fragCount = 0;
      const entry = { ...entryByWord(v.word), word: v.word, meaning: v.meaning };
      clear(content);
      content.appendChild(pad.node);
      const pic = el("div", { class: "picture big" });
      pic.innerHTML = wordImage(entry);
      const bubble = el("div", { class: "word-bubble" });
      const spellBox = el("div", { class: "spell-out", style: "opacity:0;transition:opacity .2s" });
      const hint = el("p", { class: "hint", text: `【${label}】按住 S1 说话，松手结束。` });
      const recBtn = el("button", { class: "btn big hold", style: "touch-action:none" }, "🎤 Hold S1 & say it");
      sh.setProgress(idx + 1, total);
      content.append(el("div", { class: "stage-inner" }, [pic, bubble, spellBox, hint, recBtn]));

      function onState(rec) {
        recBtn.classList.toggle("recording", rec);
        recBtn.textContent = rec ? "Listening… (hold)" : "🎤 Hold S1 & say it";
        // 不在开始录音时播 "Say it!"：按住动作本身就代表要开口，语音提示反而打断说话
      }
      function onInterim(t) { recBtn.textContent = "🎤 " + t; }
      function onNo() { sh.setBanner("没听清，再试一次 💪", "encourage"); }
      function onErr(e) {
        if (e === "not-allowed" || e === "not-supported" || e === "not-secure-context")
          sh.setBanner("麦克风不可用，请用打字练习", "reveal");
        else onNo();
      }
      function onSpeech({ transcript }) {
        if (locked) return;
        const r = scorePronunciation({ target: v.word, actual: transcript, wordMode: true, level:getModuleLevel('speak') });
        if (r.fragment) {
          // 半截识别不消耗尝试次数；连续多次仍无信号则给答案，避免卡死。
          fragCount += 1;
          if (fragCount < 3) return onNo();
          locked = true;
          bubble.textContent = v.word;
          spellBox.textContent = pronunciationHint(v.word);
          spellBox.style.opacity = "1";
          sh.setBanner("Let's read it: " + v.word, "reveal");
          afterSpeak(ctx.tts.speak(v.word, { lang: "en-US", kind: "answer" }), {
            fn: advance,
            gap: 700,
            alive: () => !detached,
            setTimer: (t) => { practiceTimers.push(t); },
          });
          return;
        }
        attempts += 1;
        const decision = classifyAttempt({ correct: r.correct, attemptsUsed: attempts, maxAttempts: 2 });
        if (decision === "correct") {
          locked = true;
          right += 1;
          bubble.textContent = v.word;
          spellBox.textContent = pronunciationHint(v.word);
          spellBox.style.opacity = "1";
          sh.setBanner("Correct! +10", "good");
          ctx.flashLed(0x74d39a);
          sh.reward();
          recordResult(v.word, v.meaning, true);
          afterSpeak(ctx.tts.speak("Great! " + v.word, { lang: "en-US" }), {
            fn: advance,
            gap: 700,
            alive: () => !detached,
            setTimer: (t) => { practiceTimers.push(t); },
          });
        } else if (decision === "retry") {
          sh.setBanner("I heard '" + transcript + "'. Try again! 💪", "encourage");
          ctx.tts.speak("Try again!", { lang: "en-US" });
        } else {
          locked = true;
          bubble.textContent = v.word;
          spellBox.textContent = pronunciationHint(v.word);
          spellBox.style.opacity = "1";
          sh.setBanner("It is " + v.word + ". 记住啦！", "reveal");
          ctx.flashLed(0xff5e9c);
          recordResult(v.word, v.meaning, false, "wrong");
          afterSpeak(ctx.tts.speak("It is " + v.word, { lang: "en-US", kind: "answer" }), {
            fn: advance,
            gap: 700,
            alive: () => !detached,
            setTimer: (t) => { practiceTimers.push(t); },
          });
        }
      }
      function startRec() {
        if (locked) return;
        ctx.recorder.start("en-US", { onResult: onSpeech, onNoResult: onNo, onError: onErr, onState, onInterim });
      }
      function stopRec() {
        ctx.recorder.release();
      }
      // 与其他模块一致：S1 = 按住说话（hold），按下开始、松手结束并识别。
      // 之前用 toggle（按一下开始/再按一下结束），导致长按松手后仍停在 Listening。
      const unsub = ctx.keypad.onKey((i, down) => {
        if (i === ROLE.PTT) {
          if (down) startRec();
          else stopRec();
          return;
        }
        if (!down) return;
        if (i === ROLE.HOME) ctx.goHome();
      });
      recBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); startRec(); });
      recBtn.addEventListener("pointerup", () => stopRec());
      recBtn.addEventListener("pointerleave", () => stopRec());
      recBtn.addEventListener("pointercancel", () => stopRec());
      v._unsub = unsub;
      activePracticeUnsub = unsub;
      ctx.tts.speak("What is this?", { lang: "en-US" });
    }

    function advance() {
      if (finished) return;
      if (queue[idx] && queue[idx]._unsub) { queue[idx]._unsub(); queue[idx]._unsub = null; }
      activePracticeUnsub = null;
      idx += 1;
      if (idx >= total) {
        finished = true;
        sh.finale({
          score: right,
          max: total,
          onReplay: () => { sh.score.set(0); idx = 0; right = 0; finished = false; render(); },
          onHome: () => ctx.goHome(),
        });
      } else {
        render();
      }
    }
    render();
  }

  function confirmClear(kind) {
    if (window.confirm(`确定清空${kind === "new" ? "生词库" : "易错词库"}？此操作不可恢复。`)) {
      const list = kind === "new" ? newWords() : hardWords();
      for (const v of list) removeWord(v.id);
      renderTabs();
      renderContent();
    }
  }

  const unsubKey = ctx.keypad.onKey((i, down) => {
    if (!down) return;
    if (i === ROLE.HOME) ctx.goHome();
  });

  renderTabs();
  renderContent();

  return {
    unmount() {
      detached = true;
      unsubKey();
      pad.unsub();
      if (activePracticeUnsub) { activePracticeUnsub(); activePracticeUnsub = null; }
      practiceTimers.forEach((t) => clearTimeout(t));
      practiceTimers = [];
      ctx.recorder.stop();
      ctx.tts.cancel();
    },
  };
}
