/**
 * moduleShell — the shared frame every game module uses, so the experience is
 * consistent and kids always have a way out:
 *   - a visible "🏠 Home" button (the board S6 still works too)
 *   - a "⏸ Pause" button (stops audio, offers Resume / Home)
 *   - a live progress read-out ("Level 2 · 3 / 8")
 *   - a score pill
 *   - a banner area for "Try again!" / "The answer is …" messages
 *   - reward() celebration + finale() final score screen
 *
 * This fixes the earlier gap where, mid-game, there was no on-screen way to
 * leave or to see progress, and no reward/feedback after answering.
 */
import { el } from "./dom.js";
import { scorePill } from "./widgets.js";
import { showReward, showCelebration } from "./reward.js";
import { pickPraise } from "../modules/flow.js";
import {levelPolicy} from '../speech/scorer.js';
import {
  awardStars,
  getModuleLevel,
  advanceModuleLevel,
} from "../content/progress.js";

export function moduleShell(ctx, { title, moduleKey }) {
  const score = scorePill();
  const progress = el("span", { class: "progress" });
  const homeBtn = el("button", { class: "btn ghost small", onClick: () => ctx.goHome() }, "🏠 Home");
  const pauseBtn = el("button", { class: "btn ghost small", onClick: () => pause() }, "⏸");
  const banner = el("div", { class: "banner hidden" });
  const stage = el("div", { class: "stage" });
  let level = moduleKey ? getModuleLevel(moduleKey) : 1;
  const titleEl = el("h2", { class: "title", style: "margin:0;font-size:clamp(22px,4vw,34px)" }, title);
  const levelTag = moduleKey ? el("div", { class: "module-level-tag", text: `Level ${level}` }) : null;
  const practicePolicy=['vocab','listen','speak'].includes(moduleKey)?el('p',{class:'hint practice-policy'},''):null;
  const card = el("div", { class: "card fade-in" }, [
    el("div", { class: "row header-row" }, [
      el("div", { class: "title-col" }, [titleEl, levelTag]),
      progress,
      score.node,
      pauseBtn,
      homeBtn,
    ]),
    banner,
    ...(practicePolicy?[practicePolicy]:[]),
    stage,
  ]);
  ctx.screen.appendChild(card);
  const updatePracticePolicy=()=>{if(practicePolicy)practicePolicy.textContent=`${levelPolicy(level).label} · 本关参考线 ${levelPolicy(level).threshold} 分；根据识别文本判断，不是专业音素发音测评。`;};
  updatePracticePolicy();

  function setProgress(cur, total) {
    progress.textContent = total ? ` ${cur} / ${total}` : "";
  }
  function setTitle(newTitle) {
    titleEl.textContent = newTitle;
  }
  function setLevel(newLevel) {
    level = newLevel;
    updatePracticePolicy();
    if (levelTag) levelTag.textContent = `Level ${level}`;
  }
  function setBanner(text, kind = "info") {
    banner.textContent = text;
    banner.className = "banner " + kind;
  }
  function hideBanner() {
    banner.className = "banner hidden";
  }
  function reward(text) {
    showReward({ text: text || pickPraise(), fx: ctx.fx });
  }
  function pause() {
    ctx.tts.cancel();
    ctx.fx?.click?.();
    const ov = el("div", { class: "overlay" }, [
      el("div", { class: "overlay-card" }, [
        el("div", { class: "big-emoji", text: "⏸" }),
        el("h2", {}, "Paused"),
        el("p", { class: "hint" }, "Take a break — your score is safe."),
        el("button", { class: "btn green", onClick: () => { ctx.fx?.click?.(); ov.remove(); } }, "▶ Resume"),
        el("button", { class: "btn", onClick: () => { ctx.fx?.click?.(); ov.remove(); ctx.goHome(); } }, "🏠 Home"),
      ]),
    ]);
    ctx.screen.appendChild(ov);
  }

  /**
   * 结算页。逻辑：
   *   - 按本轮得分给 0~3 颗星
   *   - 若 >= 2 颗星，该模块升一级（真正进入下一关）
   *   - 升级时放全屏烟花 + fanfare
   */
  function finale({ score: sc, max = sc, onReplay, onHome }) {
    const ratio = max > 0 ? sc / max : 0;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.3 ? 1 : 0;
    const prog = awardStars(stars);
    const moduleLeveledUp = moduleKey ? advanceModuleLevel(moduleKey, stars) : false;
    const nextLevel = moduleKey ? getModuleLevel(moduleKey) : 1;

    if (stars >= 2) {
      showReward({ text: stars === 3 ? "Perfect!" : "Yay!", emoji: stars === 3 ? "🏆" : "🎉", ms: 1400, fx: ctx.fx });
      window.setTimeout(() => showCelebration({ fx: ctx.fx, ms: 2800 }), 300);
    }

    const emoji = stars === 3 ? "🏆" : stars === 2 ? "🎉" : stars === 1 ? "🌟" : "💪";
    const titleText =
      stars === 3 ? "Congratulations!" :
      stars === 2 ? "Great job!" :
      stars === 1 ? "Well done!" : "Keep trying!";
    const starStr = "⭐".repeat(stars) + "☆".repeat(3 - stars);
    const pct = prog.need > 0 ? Math.max(4, Math.round((prog.exp / prog.need) * 100)) : 100;
    const levelText = moduleLeveledUp
      ? `Level Up! You are now Level ${nextLevel} 🚀`
      : (moduleKey ? `Level ${nextLevel}` : `Level ${prog.level}`);
    const goalText = prog.leveledUp
      ? "升级啦！继续挑战下一关吧 🎮"
      : `再得 ${Math.max(0, prog.need - prog.exp)} 颗星还能继续升级哦`;

    const overlay = el("div", { class: "overlay" }, [
      el("div", { class: "overlay-card" }, [
        el("div", { class: "finale pop" }, [
          el("div", { class: "big-emoji bounce", text: emoji }),
          el("h2", { class: "finale-title" }, titleText),
          el("div", { class: "finale-stars", text: starStr }),
          el("div", { class: "finale-score", text: "Score: " + sc }),
          el("div", { class: "level-box" + (moduleLeveledUp ? " leveled-up" : "") }, [
            el("div", { class: "level-head" }, [
              el("span", { class: "level-tag", text: levelText }),
              el("span", { class: "level-goal", text: goalText }),
            ]),
            el("div", { class: "level-bar" }, [
              el("div", {
                class: "level-fill" + (prog.leveledUp ? " level-up" : ""),
                style: `width:${pct}%`,
              }),
            ]),
          ]),
          el("div", { class: "row" }, [
            el("button", {
              class: "btn green",
              onClick: () => { ctx.fx?.click?.(); overlay.remove(); onReplay?.(); },
            }, "🔁 Play again"),
            el("button", {
              class: "btn",
              onClick: () => { ctx.fx?.click?.(); overlay.remove(); onHome?.(); },
            }, "🏠 Home"),
          ]),
        ]),
      ]),
    ]);
    ctx.screen.appendChild(overlay);
  }

  return { card, score, setProgress, setBanner, hideBanner, reward, pause, finale, stage, homeBtn, setTitle, setLevel };
}
