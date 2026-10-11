/**
 * Lesson content for the listening & speaking modules, plus the offline
 * Chinese<->English dictionary used by the translation module.
 *
 * The dictionary is intentionally small and curated for a kindergarten / grade-1
 * vocabulary. It is the simplest self-contained way to demonstrate translation
 * without a cloud API; swap in a real translation service later if needed.
 */

export const LISTENING = [
  {
    prompt: "Where is the apple?",
    options: [
      { icon: "banana", word: "banana" },
      { icon: "car", word: "car" },
      { icon: "apple", word: "apple" },
    ],
    answer: 2,
  },
  {
    prompt: "Find the happy dog.",
    options: [
      { icon: "dog", word: "dog" },
      { icon: "fish", word: "fish" },
      { icon: "star", word: "star" },
    ],
    answer: 0,
  },
  {
    prompt: "Which one is the sun?",
    options: [
      { icon: "sun", word: "sun" },
      { icon: "book", word: "book" },
      { icon: "milk", word: "milk" },
    ],
    answer: 0,
  },
  {
    prompt: "Touch the red flower.",
    options: [
      { icon: "tree", word: "tree" },
      { icon: "flower", word: "flower" },
      { icon: "bird", word: "bird" },
    ],
    answer: 1,
  },
  {
    prompt: "Point to the little cat.",
    options: [
      { icon: "cow", word: "cow" },
      { icon: "ball", word: "ball" },
      { icon: "cat", word: "cat" },
    ],
    answer: 2,
  },
  {
    prompt: "Show me the blue car.",
    options: [
      { icon: "car", word: "car" },
      { icon: "house", word: "house" },
      { icon: "banana", word: "banana" },
    ],
    answer: 0,
  },
];

export const SENTENCES = [
  { text: "I have an apple.", icon: "apple" },
  { text: "I see a red ball.", icon: "ball" },
  { text: "The cat is happy.", icon: "cat" },
  { text: "I like the sun.", icon: "sun" },
  { text: "A dog can run.", icon: "dog" },
  { text: "The bird can fly.", icon: "bird" },
  { text: "I drink milk.", icon: "milk" },
  { text: "A star is in the sky.", icon: "star" },
];

/** Chinese -> English. Keys are simplified Chinese; values are English. */
export const ZH_EN = {
  苹果: "apple",
  香蕉: "banana",
  猫: "cat",
  狗: "dog",
  太阳: "sun",
  星星: "star",
  书: "book",
  球: "ball",
  汽车: "car",
  花: "flower",
  鱼: "fish",
  牛: "cow",
  鸟: "bird",
  树: "tree",
  房子: "house",
  牛奶: "milk",
  水: "water",
  我有一个苹果: "I have an apple.",
  我喜欢太阳: "I like the sun.",
  猫很开心: "The cat is happy.",
  小狗会跑: "A dog can run.",
  鸟会飞: "The bird can fly.",
};

/** English -> Chinese, derived from ZH_EN for bilingual display. */
export const EN_ZH = Object.fromEntries(
  Object.entries(ZH_EN).map(([zh, en]) => [en.toLowerCase(), zh])
);

/**
 * Translate a Chinese phrase to English using the offline dictionary.
 * Tries the whole phrase first, then falls back to per-word matching.
 * @param {string} zh
 * @returns {{en:string, found:boolean}}
 */
export function translateZhToEn(zh) {
  const text = (zh || "").trim();
  if (!text) return { en: "", found: false };
  if (ZH_EN[text]) return { en: ZH_EN[text], found: true };

  // Per-word fallback: keep any known words, otherwise echo a friendly note.
  const hits = [];
  for (const [k, v] of Object.entries(ZH_EN)) {
    if (text.includes(k)) hits.push(v);
  }
  if (hits.length) return { en: hits.join(" "), found: true };
  return { en: "", found: false };
}

export function translateEnToZh(en) {
  return EN_ZH[(en || "").trim().toLowerCase()] || "";
}
