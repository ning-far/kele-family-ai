/**
 * library.js — 训练词库选择（全部 / 生词 / 易错）。
 *
 * 各训练模块（如 Vocabulary Challenge）从这里取"本次该练哪些词"，
 * 做到「平时训练可针对性」：想专攻生词就选生词库，想专攻易错就选易错词库。
 *
 * 选择持久化在 localStorage（el_train_lib），跨刷新保留。
 */
import { WORDS, pickFrom, entryByWord } from "./words.js";
import { newWords, hardWords } from "./vocabStore.js";

export const LIBRARIES = [
  { key: "all", label: "全部单词库" },
  { key: "new", label: "生词库" },
  { key: "hard", label: "易错词库" },
];

const KEY = "el_train_lib";

export function getLibrary() {
  try {
    const k = localStorage.getItem(KEY);
    return LIBRARIES.some((L) => L.key === k) ? k : "all";
  } catch {
    return "all";
  }
}

export function setLibrary(k) {
  try {
    localStorage.setItem(KEY, k);
  } catch {}
}

/** 把一条存储记录补全成完整的词条目（带 emoji / 释义 / 分类 / 学段）。 */
function merge(rec) {
  const base = entryByWord(rec.word) || {};
  return {
    id: rec.id || base.id,
    word: rec.word,
    meaning: rec.meaning || base.meaning || "",
    emoji: base.emoji || "📝",
    icon: base.icon || "",
    category: base.category || "",
    level: base.level || "",
  };
}

/** 当前选中库的词条目数组（用于训练取词）。 */
export function getTrainingPool() {
  const k = getLibrary();
  if (k === "new") return newWords().map(merge);
  if (k === "hard") return hardWords().map(merge);
  return WORDS.slice();
}

/** 某库的当前词数（用于角标）。 */
export function libCount(key) {
  if (key === "new") return newWords().length;
  if (key === "hard") return hardWords().length;
  return WORDS.length;
}

/** 从当前训练池取 n 个（不重复）；池不够则返回池内全部。 */
export function pickTraining(n) {
  return pickFrom(getTrainingPool(), n);
}

/**
 * 按模块等级取合适难度的词：
 *   Level 1 → 仅幼儿园词
 *   Level 2 → 幼儿园 + 简单一年级词（长度 <= 6）
 *   Level 3+ → 全部词库
 */
export function getWordsByLevel(level) {
  if (level <= 1) return WORDS.filter((w) => w.level === "kg");
  if (level === 2) return WORDS.filter((w) => w.level === "kg" || w.word.length <= 6);
  return WORDS.slice();
}
