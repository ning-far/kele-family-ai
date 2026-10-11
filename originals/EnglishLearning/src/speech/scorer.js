/**
 * Pronunciation scoring — pure, dependency-free, unit-tested.
 *
 * Web Speech API does not return a native "pronunciation score", so we build
 * a transparent 0-100 score from two signals:
 *   1. similarity: how close the recognized words are to the target words.
 *   2. confidence: the recognizer's own 0..1 confidence (when available).
 *
 * score = 100 * (wSim * similarity + wConf * confidence), with wSim=0.6, wConf=0.4.
 * If confidence is missing, score falls back to similarity only.
 *
 * This module is intentionally isolated so a real scoring service
 * (e.g. Azure Pronunciation Assessment) can replace `scorePronunciation`
 * without touching the UI.
 */

const ARTICLES = new Set(["a", "an", "the"]);

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 0);
}

export function tokensNoArticles(text) {
  return tokenize(text).filter((w) => !ARTICLES.has(w));
}

/** Levenshtein edit distance on a token array (word-level). */
export function tokenEditDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Word-level similarity in [0,1]. 1 == identical token sequence. */
export function sentenceSimilarity(target, actual) {
  const t = tokensNoArticles(target);
  const a = tokensNoArticles(actual);
  if (t.length === 0 && a.length === 0) return 1;
  if (t.length === 0 || a.length === 0) return 0;
  const dist = tokenEditDistance(t, a);
  const maxLen = Math.max(t.length, a.length);
  return Math.max(0, 1 - dist / maxLen);
}

/** Does the recognized text contain the target word (as a whole word)? */
export function containsWord(actual, targetWord) {
  const w = normalize(targetWord);
  if (!w) return false;
  return new RegExp(`(^|\\s)${escapeRegex(w)}(\\s|$)`).test(normalize(actual));
}

/** Character-level Levenshtein distance (normalized input). */
export function charEditDistance(a, b) {
  a = normalize(a);
  b = normalize(b);
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Lenient spoken-word match against the TARGET word (module 1 & word drills).
 *
 * ASR is imperfect: it substitutes letters (pants→hands, orange→outrage), adds
 * articles ("the pants"), or returns a tiny fragment ("g", "h"). Matching against
 * the *global nearest dictionary word* (the old approach) is wrong — it can pick a
 * different word ("hands"→"hand") and then reject a genuine near-miss. We instead
 * measure the character edit distance straight to the target and allow a
 * length-scaled budget, so near-misses pass while real mistakes still fail.
 *
 * @returns {{distance:number, similarity:number, allowed:number, match:boolean, fragment:boolean}}
 */
export function wordMatch(target, actual) {
  const t = normalize(target).replace(/\s+/g, "");
  const raw = normalize(actual);
  if (!t || !raw) {
    return { distance: Infinity, similarity: 0, allowed: 0, match: false, fragment: true };
  }
  const compact = raw.replace(/\s+/g, "");
  let dist = charEditDistance(compact, t);
  for (const tok of raw.split(" ").filter(Boolean)) {
    const d = charEditDistance(tok, t);
    if (d < dist) dist = d;
  }
  const similarity = Math.max(0, 1 - dist / Math.max(t.length, 1));
  // 以鼓励为主：长度自适应的宽松容差。
  //   4 字母以内：允许 1 处编辑（hand↛hazy、book↛back 仍判错）
  //   5~6 字母：允许 3 处（pants→hands Δ2、orange→outrage Δ3 都能过）
  //   7 字母以上：最多允许 4 处编辑（避免「water 被当成 watermelon」这类过度宽松）
  // 完全不相干 / 长度差距大的词依旧会判错。
  const allowed = t.length <= 4 ? 1 : t.length <= 6 ? 3 : 4;
  // A 1-char transcript carries no usable signal → treat as "not heard".
  const fragment = compact.length < 2;
  return { distance: dist, similarity, allowed, match: !fragment && dist <= allowed, fragment };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const W_SIM = 0.6;
const W_CONF = 0.4;

/**
 * Score a spoken attempt.
 * @param {object} args
 * @param {string} args.target   expected phrase / word
 * @param {string} args.actual   recognized transcript
 * @param {number} [args.confidence] recognizer confidence 0..1 (optional)
 * @param {boolean} [args.wordMode] if true, judge by word containment (module 1)
 * @returns {{score:number, correct:boolean, similarity:number, confidence:number, detail:string}}
 */
export function levelPolicy(level=1){return {threshold:level<=1?50:level===2?65:80,label:level<=1?'鼓励练习':level===2?'清楚表达':'完整表达'};}

export function scorePronunciation({ target, actual, confidence, wordMode = false, level }) {
  const safeActual = String(actual || "");
  const safeTarget = String(target || "");
  const normActual = normalize(safeActual);
  const similarity = sentenceSimilarity(safeTarget, safeActual);
  const hasConf = typeof confidence === "number" && confidence >= 0;
  const conf = hasConf ? Math.max(0, Math.min(1, confidence)) : 0;

  if(level!==undefined){
    const policy=levelPolicy(level),m=wordMatch(safeTarget,safeActual);
    const sim=wordMode?m.similarity:level>=3?(()=>{const t=tokenize(safeTarget),a=tokenize(safeActual);return Math.max(0,1-tokenEditDistance(t,a)/Math.max(t.length,a.length,1));})():similarity;
    const value=Math.round(100*sim);
    const budget=level<=1?m.allowed:level===2?Math.max(1,Math.floor(normalize(safeTarget).length/5)):0;
    const exactWord=normalize(safeTarget)===normalize(safeActual);
    const eligible=!!normActual&&(!wordMode||(!m.fragment&&m.distance<=budget&&(level<3||exactWord)));
    return {score:value,correct:eligible&&value>=policy.threshold,similarity:sim,confidence:conf,distance:m.distance,fragment:wordMode?m.fragment:!normActual,threshold:policy.threshold,detail:'ASR text practice, '+policy.label};
  }

  let score;
  if (wordMode) {
    const m = wordMatch(safeTarget, safeActual);
    score = m.match ? Math.round(80 + 20 * m.similarity) : Math.round(60 * m.similarity);
    return {
      score: Math.max(0, Math.min(100, score)),
      correct: m.match,
      similarity: m.similarity,
      confidence: conf,
      distance: m.distance,
      fragment: m.fragment,
      detail: m.match ? `word matched (Δ${m.distance})` : m.fragment ? "too short" : "word not found",
    };
  }

  score = hasConf
    ? Math.round(100 * (W_SIM * similarity + W_CONF * conf))
    : Math.round(100 * similarity);
  // A near-perfect transcript with no confidence should still read high.
  if (!hasConf && similarity >= 0.92) score = Math.max(score, 88);

  return {
    score: Math.max(0, Math.min(100, score)),
    correct: similarity >= 0.8,
    similarity,
    confidence: conf,
    detail: hasConf ? "similarity+confidence" : "similarity only",
  };
}
