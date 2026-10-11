/**
 * App router — welcome gate, module menu, and active-module lifecycle.
 *
 * Entry to the English app happens when the board reports S1+S8 (enter combo) or
 * appmode becomes "english". Without a board, the on-screen Start button (and the
 * keyboard simulator's A+K or 1+8 combo) does the same thing. (S1+S7 stays reserved
 * for the maker appmode and is never used here.)
 */
import { el, clear, MASCOT } from "./ui/dom.js";
import { clearOverlays } from "./ui/reward.js";
import { icon } from "./content/icons.js";
import { mountVocabulary } from "./modules/vocabulary.js";
import { mountListening } from "./modules/listening.js";
import { mountSpeak } from "./modules/speak.js";
import { mountTranslate } from "./modules/translate.js";
import { mountMyWords } from "./modules/myWords.js";

const MODULES = [
  { key: "vocab", title: "Vocabulary", desc: "What is this? Say the word!", ic: "apple", mount: mountVocabulary },
  { key: "listen", title: "Listening", desc: "Listen and pick the right picture.", ic: "book", mount: mountListening },
  { key: "speak", title: "Speak", desc: "Words → phrases → sentences!", ic: "star", mount: mountSpeak },
  { key: "translate", title: "Translator", desc: "Ask in Chinese, hear English!", ic: "flower", mount: mountTranslate },
  { key: "mywords", title: "My Words", desc: "生词库 / 易错词库 / 单词库", ic: "book", mount: mountMyWords },
];

export function createApp(ctx) {
  let current = null; // { unmount }
  let entered = false;
  const unsubs = [];

  function clearScreen() {
    if (current) {
      try {
        current.unmount();
      } catch {}
      current = null;
    }
    clear(ctx.screen);
    // 顺手清掉可能还在飘的庆祝层（挂载在 document.body 上）
    try {
      clearOverlays();
    } catch {}
  }

  let welcomeSpoken = false;
  function showWelcome() {
    clearScreen();
    const kbHint = el("p", { class: "hint" }, [
      "No board? Use your keyboard — easy way: 1 2 3 4 5 6 7 8 = S1..S8, press 1 and 8 together to start. " +
        "Or: A S D F G H J K = S1..S8, press A and K together to start.",
    ]);
    const startBtn = el("button", { class: "btn big green", onClick: () => { ctx.tts.speak("Welcome to the world of Gua La Ji Li!", { lang: "en-US", rate: 0.9 }); enterApp(); } }, "Start (S1 + S8)");
    const node = el("div", { class: "card fade-in welcome-card", style: "text-align:center;max-width:560px" }, [
      el("div", { html: MASCOT }),
      el("div", { class: "brand-name", text: "呱啦叽哩" }),
      el("h1", { class: "title" }, "Gua La Ji Li"),
      el("p", { class: "subtitle" }, "Hello little friend! Let's learn English together."),
      startBtn,
      kbHint,
    ]);
    ctx.screen.appendChild(node);
    // 打开欢迎页就朗读；若浏览器自动播放策略拦截（无用户手势），则在首次点击 Start 时补播
    sayWelcome();
  }

  function sayWelcome() {
    if (welcomeSpoken) return;
    welcomeSpoken = true;
    ctx.tts.speak("Welcome to the world of Gua La Ji Li!", { lang: "en-US", rate: 0.9 });
  }

  function showMenu() {
    clearScreen();
    const cards = MODULES.map((m) =>
      el("div", { class: "module-card pop", onClick: () => goModule(m.key) }, [
        el("div", { class: "picture", style: "width:84px;height:84px;box-shadow:none;padding:0", html: icon(m.ic) }),
        el("h3", {}, m.title),
        el("p", {}, m.desc),
      ])
    );
    const node = el("div", { class: "card fade-in" }, [
      el("h1", { class: "title" }, "Choose an Activity"),
      el("div", { class: "grid-cards" }, cards),
      el("p", { class: "hint" }, "Press S6 any time to come back here."),
    ]);
    ctx.screen.appendChild(node);
  }

  function goModule(key) {
    const m = MODULES.find((x) => x.key === key);
    if (!m) return;
    clearScreen();
    current = m.mount(ctx);
  }

  function goHome() {
    showMenu();
  }

  function enterApp() {
    if (entered) return;
    entered = true;
    showMenu();
  }

  // Entry triggers: S1+S8 combo, or firmware appmode "english".
  // (S1+S7 is reserved for the maker appmode and is never consumed here.)
  unsubs.push(ctx.keypad.onEnterCombo(() => enterApp()));
  unsubs.push(
    ctx.keypad.onAppMode((mode) => {
      if (mode === "english") enterApp();
    })
  );

  return {
    start() {
      showWelcome();
    },
    goHome,
    goModule,
    destroy() {
      unsubs.forEach((u) => u());
      clearScreen();
    },
  };
}
