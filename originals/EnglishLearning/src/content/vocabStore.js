/**
 * vocabStore — 单词学习统计（localStorage 持久化）+ 三库体系 + 遗忘曲线（SRS）。
 *
 * 三库关系：
 *   - 单词库（master）：见 content/words.js，是"要学的总词汇"，不在此存储。
 *   - 生词库（new）：做错第一次自动进；学会（连续对 3 次）后移出。
 *   - 易错词库（hard）：同一词反复错（错 ≥2 次）自动进；学会后移出。
 *
 * 单条记录（按 word 小写去重）：
 *   {
 *     id, word, meaning,
 *     source: 'wrong' | 'manual',
 *     addedAt, lastSeen,
 *     seen, correctCount, wrongCount,
 *     box: 0..5,            // Leitner 盒子，越大越熟
 *     nextDue,             // 下次该复习的时间戳(ms)
 *     inNew: bool,         // 是否在生词库
 *     inHard: bool,        // 是否在易错词库
 *     mastered: bool,      // 已掌握（移出生词/易错）
 *   }
 *
 * 与 engineConfig.js 保持一致：键名前缀 el_，整段 JSON 存入 localStorage。
 */
const KEY = "el_vocab_book";

// Leitner 盒子对应的复习间隔（毫秒）。box0=刚加/刚错，立即该练。
const INTERVALS = [
  0, // box 0: 现在就该练
  60 * 60 * 1000, // box 1: 1 小时后
  6 * 60 * 60 * 1000, // box 2: 6 小时后
  24 * 60 * 60 * 1000, // box 3: 1 天后
  3 * 24 * 60 * 60 * 1000, // box 4: 3 天后
  7 * 24 * 60 * 60 * 1000, // box 5: 7 天后（之后保持 box5）
];

// 连续答对这么多次 → 视为掌握，移出生词/易错。
const MASTER_CORRECT = 3;
// 累计错这么多次 → 视为易错词，进易错词库。
const HARD_WRONG = 2;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}
function idOf(word) {
  return String(word || "").trim().toLowerCase();
}

/** 读取全部统计记录（数组）。 */
export function getVocab() {
  return load();
}

/** 按 id（小写英文）取一条。 */
export function getEntry(id) {
  return load().find((v) => v.id === idOf(id)) || null;
}

/** 是否已收录某词（在任意库）。 */
export function has(word) {
  return !!getEntry(word);
}

/** 生词库：inNew 且未掌握。 */
export function newWords() {
  return load().filter((v) => v.inNew && !v.mastered);
}

/** 易错词库：inHard 且未掌握。 */
export function hardWords() {
  return load().filter((v) => v.inHard && !v.mastered);
}

/**
 * 记录一次练习结果，自动更新统计、三库归属与下次复习时间。
 * @param {string} word
 * @param {string} [meaning]
 * @param {boolean} correct
 * @param {'wrong'|'manual'} [source] 首次收录时的来源
 */
export function recordResult(word, meaning, correct, source = "wrong") {
  word = String(word || "").trim();
  if (!word) return;
  const list = load();
  let v = list.find((x) => x.id === idOf(word));
  const now = Date.now();
  if (!v) {
    v = {
      id: idOf(word),
      word,
      meaning: meaning || "",
      source,
      addedAt: now,
      lastSeen: now,
      seen: 0,
      correctCount: 0,
      correctStreak: 0,
      wrongCount: 0,
      box: 0,
      nextDue: now,
      inNew: false,
      inHard: false,
      mastered: false,
    };
    list.push(v);
  }
  v.seen += 1;
  v.lastSeen = now;
  if (meaning && !v.meaning) v.meaning = meaning;

  if (correct === true) {
    v.correctCount += 1;
    v.correctStreak = (v.correctStreak || 0) + 1;
    v.box = Math.min(5, v.box + 1);
    if (!v.mastered && v.correctStreak >= MASTER_CORRECT) {
      v.mastered = true;
      v.inNew = false;
      v.inHard = false;
    }
  } else if (correct === false) {
    v.wrongCount += 1;
    v.correctStreak = 0;
    v.mastered = false;
    v.box = Math.max(0, v.box - 1);
    // 第一次错 → 进生词库；反复错 → 进易错词库
    v.inNew = true;
    if (v.wrongCount >= HARD_WRONG) v.inHard = true;
  }
  // 答对进盒、答错回盒 0；box5 之后间隔保持 7 天
  v.nextDue = now + (INTERVALS[v.box] ?? INTERVALS[INTERVALS.length - 1]);
  save(list);
  return v;
}

/** 用户主动添加生词（语音："dog 代表 狗" / 打字）。进入生词库。 */
export function addManual(word, meaning) {
  word = String(word || "").trim();
  if (!word) return null;
  const v = recordResult(word, meaning || "", null, "manual");
  v.correctStreak = 0;
  v.inNew = true;
  v.mastered = false;
  save(load().map((x) => (x.id === v.id ? v : x)));
  return v;
}

/** 删除一条。 */
export function removeWord(id) {
  const list = load().filter((x) => x.id !== idOf(id));
  save(list);
}

/** 清空全部。 */
export function clearAll() {
  save([]);
}

/**
 * 取"该复习"的词（nextDue<=now），按紧急度升序，最多 limit 条。
 * box0（新词/刚错）永远优先。
 */
export function dueList(limit = 10) {
  const now = Date.now();
  const list = load()
    .slice()
    .sort((a, b) => (a.nextDue || 0) - (b.nextDue || 0));
  const due = list.filter((v) => (v.nextDue || 0) <= now);
  return due.slice(0, Math.max(0, limit));
}

/** 待复习数量（用于角标提示）。 */
export function dueCount() {
  const now = Date.now();
  return load().filter((v) => (v.nextDue || 0) <= now).length;
}
