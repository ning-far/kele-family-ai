/**
 * Celebration overlays — fireworks / sparkles / confetti + a big emoji + a praise line.
 * Pure DOM, no dependencies. Used for correct answers and the final score screen.
 */
import { el } from "./dom.js";

const SPARKS = ["✨", "🌟", "🎉", "💖", "🌈", "⭐", "💫", "🍀", "🌸", "🎊"];
const CONFETTI = ["🎀", "🎊", "🎉", "⭐", "💖", "🌟", "🎈", "✨", "🍬", "🧸"];

/** Remove any currently-shown reward overlay (e.g. on navigation). */
export function clearOverlays() {
  document.querySelectorAll(".reward").forEach((n) => n.remove());
}

/**
 * Show a short, joyful reward animation.
 * @param {object} [o]
 * @param {string} [o.text]  praise line (defaults to "Wonderful!")
 * @param {string} [o.emoji] big emoji (defaults to 🌟)
 * @param {number} [o.ms]    auto-dismiss after this many ms (0 = keep)
 * @param {import("../speech/fx.js").CuteSounds} [o.fx] optional cute sound player
 */
export function showReward({ text = "Wonderful!", emoji = "🌟", ms = 1700, fx } = {}) {
  clearOverlays();
  fx?.reward?.();
  const fw = el("div", { class: "reward" });
  fw.appendChild(
    el("div", { class: "reward-card pop" }, [
      el("div", { class: "reward-emoji", text: emoji }),
      el("div", { class: "reward-text", text }),
    ])
  );
  for (let i = 0; i < 22; i++) {
    const p = el("span", { class: "spark", text: SPARKS[i % SPARKS.length] });
    p.style.left = 8 + Math.random() * 84 + "%";
    p.style.top = 8 + Math.random() * 84 + "%";
    p.style.setProperty("--dx", (Math.random() * 2 - 1).toFixed(2));
    p.style.setProperty("--dy", (Math.random() * 2 - 1).toFixed(2));
    p.style.animationDelay = (Math.random() * 0.4).toFixed(2) + "s";
    fw.appendChild(p);
  }
  document.body.appendChild(fw);
  if (ms > 0) window.setTimeout(() => fw.remove(), ms);
  return fw;
}

/**
 * 结算页大庆祝：彩带 + 烟花 + 升级 fanfare。
 * @param {object} [o]
 * @param {number} [o.ms] 动画时长（默认 2800ms）
 * @param {import("../speech/fx.js").CuteSounds} [o.fx]
 */
export function showCelebration({ ms = 2800, fx } = {}) {
  clearOverlays();
  fx?.levelUp?.();
  const root = el("div", { class: "reward celebration" });
  // 尊重「减少动态效果」系统设置，降低动画元素数量
  const reduce = typeof window !== "undefined" &&
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const confettiN = reduce ? 14 : 40;
  const fireworkN = reduce ? 3 : 8;

  // 全屏彩带
  for (let i = 0; i < confettiN; i++) {
    const c = el("span", { class: "confetti", text: CONFETTI[i % CONFETTI.length] });
    c.style.left = Math.random() * 100 + "%";
    c.style.animationDelay = (Math.random() * 1.2).toFixed(2) + "s";
    c.style.fontSize = (18 + Math.random() * 22) + "px";
    root.appendChild(c);
  }

  // 烟花爆点
  for (let i = 0; i < fireworkN; i++) {
    const burst = el("div", { class: "firework" });
    burst.style.left = 15 + Math.random() * 70 + "%";
    burst.style.top = 10 + Math.random() * 55 + "%";
    burst.style.animationDelay = (Math.random() * 0.8).toFixed(2) + "s";
    const sparksN = reduce ? 8 : 16;
    for (let k = 0; k < sparksN; k++) {
      const p = el("span", { class: "spark", text: SPARKS[k % SPARKS.length] });
      const angle = (k / sparksN) * Math.PI * 2;
      p.style.setProperty("--dx", Math.cos(angle).toFixed(2));
      p.style.setProperty("--dy", Math.sin(angle).toFixed(2));
      burst.appendChild(p);
    }
    root.appendChild(burst);
  }

  document.body.appendChild(root);
  if (ms > 0) window.setTimeout(() => root.remove(), ms);
  return root;
}
