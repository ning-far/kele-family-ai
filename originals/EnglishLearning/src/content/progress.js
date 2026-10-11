/**
 * 闯关进度（持久化到 localStorage）。
 *
 * 每完成一轮练习，结算页会根据得分给 0~3 颗星，星星累积为经验值 exp；
 * 经验值攒满当前等级的阈值就升级。这样小朋友每轮都能看到进度条和下一级目标，
 * 有持续打怪升级的动力（参考叽里呱啦/小鸡叫叫这类儿童英语 APP 的关卡设计）。
 */
const KEY = "ela_progress_v1";
const MODULE_LEVEL_KEY = "ela_module_levels_v1";
const MAX_MODULE_LEVEL = 5;

// localStorage 不可用时（如测试环境）回退到内存存储，保证功能仍可运行。
const memoryStore = new Map();
function storageGet(key) {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
  } catch (_) {}
  return memoryStore.get(key) ?? null;
}
function storageSet(key, value) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
      return;
    }
  } catch (_) {}
  memoryStore.set(key, value);
}

/** 升到下一级需要的星星数：等级越高越多，保证越往后越有挑战。 */
function needFor(level) {
  return 6 + (level - 1) * 3;
}

function load() {
  try {
    const raw = storageGet(KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p.level === "number" && typeof p.exp === "number") return p;
  } catch (_) {}
  return { level: 1, exp: 0 };
}

function save(p) {
  storageSet(KEY, JSON.stringify(p));
}

/** 读完当前进度（不改动）。 */
export function getProgress() {
  const p = load();
  return { level: p.level, exp: p.exp, need: needFor(p.level) };
}

/**
 * 结算时调用：加上本轮星数，必要时连升多级。
 * @returns {{level:number, exp:number, need:number, leveledUp:boolean}}
 */
export function awardStars(stars) {
  const p = load();
  p.exp += Math.max(0, stars | 0);
  let leveledUp = false;
  while (p.exp >= needFor(p.level)) {
    p.exp -= needFor(p.level);
    p.level += 1;
    leveledUp = true;
  }
  save(p);
  return { level: p.level, exp: p.exp, need: needFor(p.level), leveledUp };
}

/* ---- 每个模块独立的「闯关等级」：本局达到 2 颗星就升一级 ---- */

function loadModuleLevels() {
  try {
    const raw = storageGet(MODULE_LEVEL_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return typeof obj === "object" && obj ? obj : {};
  } catch (_) {
    return {};
  }
}

function saveModuleLevels(obj) {
  storageSet(MODULE_LEVEL_KEY, JSON.stringify(obj));
}

/** 读取某个模块的当前等级（默认 1）。 */
export function getModuleLevel(key) {
  const lv = loadModuleLevels()[key];
  return typeof lv === "number" && lv >= 1 ? lv : 1;
}

/** 手动设置模块等级。 */
export function setModuleLevel(key, level) {
  const obj = loadModuleLevels();
  const clamped = Math.max(1, Math.min(MAX_MODULE_LEVEL, level));
  const changed = obj[key] !== clamped;
  obj[key] = clamped;
  saveModuleLevels(obj);
  return changed;
}

/** 本局结算：如果拿到 2 颗及以上星星，该模块升一级（已封顶则不再升级）。 */
export function advanceModuleLevel(key, stars) {
  if ((stars | 0) >= 2) {
    const oldLevel = getModuleLevel(key);
    if (oldLevel >= MAX_MODULE_LEVEL) return false;
    setModuleLevel(key, oldLevel + 1);
    return getModuleLevel(key) > oldLevel;
  }
  return false;
}

/** 把模块等级重置为 1（调试用 / 家长入口用）。 */
export function resetModuleLevel(key) {
  setModuleLevel(key, 1);
}
