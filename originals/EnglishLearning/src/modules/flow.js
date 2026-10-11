/**
 * Pure, dependency-free flow helpers shared by the game modules.
 * Kept separate so the retry / reward decisions can be unit-tested without a DOM.
 */
import { ipaOf } from "../content/ipa.js";

/** Encouraging words shown on a correct answer (randomised for variety). */
export const PRAISE = ["Wonderful!", "Great!", "Excellent!", "Awesome!", "Amazing!"];

export function pickPraise() {
  return PRAISE[Math.floor(Math.random() * PRAISE.length)];
}

/**
 * Decide what happens after one attempt in a "retry until correct" game.
 *
 * @param {object} a
 * @param {boolean} a.correct       was this attempt correct?
 * @param {number}  a.attemptsUsed  how many attempts have been made (incl. this one)
 * @param {number}  a.maxAttempts   attempts allowed before the answer is revealed
 * @returns {"correct"|"retry"|"reveal"}
 */
export function classifyAttempt({ correct, attemptsUsed, maxAttempts }) {
  if (correct) return "correct";
  if (attemptsUsed < maxAttempts) return "retry";
  return "reveal";
}

/**
 * 等朗读真正结束后再执行下一步。
 *
 * 为什么需要：推进下一题如果只用固定 setTimeout，句子一长（或百度 TTS 多一次网络往返）
 * 就会被下一题的提问 `speechSynthesis.cancel()` 拦腰截断，听感上就是"答案音和提问音
 * 连在一起"。改成串联朗读 Promise 后，无论句子长短都不会互相打断。
 *
 * @param {Promise} speakPromise tts.speak() 返回的 Promise
 * @param {object} o
 * @param {()=>void} o.fn          朗读结束后要执行的事
 * @param {number} [o.gap]        读完后再额外等待的毫秒
 * @param {()=>boolean} [o.alive] 模块是否仍挂载；已卸载则不再调度（避免写游离 DOM）
 * @param {(id:any)=>void} [o.setTimer] 回传定时器句柄，便于卸载时清理
 */
/** 把单词拆成「G - R - E - E - N」形式的字母拼读提示（IPA 缺失时回退用）。 */
export function spellOut(word) {
  const w = String(word || "").trim().replace(/\s+/g, " ");
  if (!w) return "";
  return w
    .split(" ")
    .map((tok) => tok.toUpperCase().split("").join(" - "))
    .join("  /  ");
}

/**
 * 单词发音提示：优先显示国际音标（/ɡriːn/），查不到音标时回退到字母拼读。
 * 用于在单词类模块里把「怎么读」直接展示给孩子。
 */
export function pronunciationHint(word) {
  const ipa = ipaOf(word);
  if (ipa) return "/" + ipa + "/";
  return spellOut(word);
}

/**
 * 短语/句子的音标提示：把每个认识的单词的音标拼在一起。
 * 主要用于翻译结果下方展示（如 "Dream of the Red Chamber" 显示其中认识词的 IPA）。
 */
export function phraseIPA(text) {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const ipas = [];
  for (const w of words) {
    const ipa = ipaOf(w);
    if (ipa) ipas.push("/" + ipa + "/");
  }
  return ipas.slice(0, 8).join(" ");
}

export function afterSpeak(speakPromise, { fn, gap = 600, alive = () => true, setTimer } = {}) {
  Promise.resolve(speakPromise)
    .catch(() => {})
    .then(() => {
      if (!alive()) return;
      const id = setTimeout(fn, gap);
      if (setTimer) setTimer(id);
    });
}
