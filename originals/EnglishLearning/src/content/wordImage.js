/**
 * wordImage — 富单词图：渐变背景 + 大图（emoji 优先，否则自绘 SVG）+ 英文 + 中文释义。
 * 比原先只有单个 SVG 的 icon() 丰富很多，更适合"看图记单词"。
 */
import { icon } from "./icons.js";

/** 由单词稳定派生一个色相，保证同一种词颜色一致。 */
function hueOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/**
 * @param {object} entry  { word, emoji?, icon?, meaning? }
 * @param {object} opts   { noText?: boolean }  noText=true 时只显示图，不显示单词/释义
 * @returns {string} 可直接放进 innerHTML 的 HTML 片段
 */
export function wordImage(entry, { noText = false } = {}) {
  const e = entry || {};
  const word = e.word || "";
  const h = hueOf(word || "x");
  const h2 = (h + 38) % 360;
  const bg = `linear-gradient(135deg, hsl(${h} 85% 90%), hsl(${h2} 80% 82%))`;
  const visual = e.emoji
    ? `<div class="wi-visual">${e.emoji}</div>`
    : `<div class="wi-visual">${icon(e.icon)}</div>`;
  if (noText) {
    return `<div class="word-image" style="background:${bg}">${visual}</div>`;
  }
  const meaning = e.meaning ? `<div class="wi-mean">${e.meaning}</div>` : "";
  return (
    `<div class="word-image" style="background:${bg}">` +
    visual +
    `<div class="wi-word">${word}</div>` +
    meaning +
    `</div>`
  );
}

/** 和 wordImage 类似，但只返回"图"部分（不含文字），用于选项卡片。 */
export function wordVisual(entry) {
  const e = entry || {};
  return e.emoji ? e.emoji : icon(e.icon);
}
