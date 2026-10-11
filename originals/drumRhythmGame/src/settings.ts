/**
 * 设置（家长项）：难度、减少动效、音量、音频延迟校准。持久化到 localStorage。
 *
 * 说明：
 *  - 录音曲目难度只改密度，不改歌曲节奏；合成小星星保留原有变速玩法。
 *  - 音频延迟校准 ±200ms：叠加到每个音符目标时间，抵消设备音频输出延迟。
 *  - 减少动效：关掉星空闪烁/彩带/粒子，供敏感儿童使用。
 *  - 本文件不 import Tone.js，Difficulty 定义在此，music.ts 复用它。
 */

import { clamp } from "./core/clock";

export type Difficulty = "easy" | "normal" | "hard";

/** 合成曲目的历史速度；录音曲目必须使用谱面自身的时间轴。 */
export const DIFFICULTY_BPM: Record<Difficulty, number> = {
  easy: 70,
  normal: 84,
  hard: 100,
};

/** 难度显示名（少文字、亲切）。 */
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "慢慢来",
  normal: "刚刚好",
  hard: "挑战一下",
};

export const VALID_THEMES = ["train-night", "snow-world", "pony-prairie", "beach-sand", "desert-camel"] as const;

export interface Settings {
  difficulty: Difficulty;
  reduceMotion: boolean;
  volume: number; // 0..1
  calibrationMs: number; // -200..200
  theme: string;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "normal",
  reduceMotion: false,
  volume: 0.8,
  calibrationMs: 0,
  theme: "train-night",
};

const STORAGE_KEY_V2 = "drumgame.settings.v2";
const STORAGE_KEY_V1 = "drumgame.settings.v1";

/** 规范化：把任意输入夹到合法范围，杜绝坏值。 */
export function sanitizeSettings(s: Partial<Settings>): Settings {
  const difficulty: Difficulty =
    s.difficulty === "easy" || s.difficulty === "hard" || s.difficulty === "normal"
      ? s.difficulty
      : DEFAULT_SETTINGS.difficulty;
  const theme = VALID_THEMES.includes(s.theme as typeof VALID_THEMES[number]) ? s.theme! : "train-night";
  return {
    difficulty,
    reduceMotion: s.reduceMotion === true,
    volume: clamp(typeof s.volume === "number" && Number.isFinite(s.volume) ? s.volume : 0.8, 0, 1),
    calibrationMs: clamp(
      typeof s.calibrationMs === "number" && Number.isFinite(s.calibrationMs) ? s.calibrationMs : 0,
      -200,
      200,
    ),
    theme,
  };
}

export function loadSettings(): Settings {
  try {
    // 优先读 v2 key
    const raw2 = localStorage.getItem(STORAGE_KEY_V2);
    if (raw2) {
      return sanitizeSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw2) as Partial<Settings>) });
    }
    // 兼容迁移：读 v1 key，补 theme 默认值后写入 v2
    const raw1 = localStorage.getItem(STORAGE_KEY_V1);
    if (raw1) {
      const migrated = sanitizeSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw1) as Partial<Settings>), theme: "train-night" });
      saveSettings(migrated);
      return migrated;
    }
    return { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(sanitizeSettings(s)));
  } catch {
    /* 隐私模式/无 localStorage 时静默忽略 */
  }
}

/** 带订阅的设置仓库：改动即持久化并通知 UI（音量/减少动效实时生效）。 */
export class SettingsStore {
  private current: Settings;
  private readonly listeners = new Set<(s: Settings) => void>();

  constructor(initial: Settings = loadSettings()) {
    this.current = sanitizeSettings(initial);
  }

  get(): Settings {
    return this.current;
  }

  update(patch: Partial<Settings>): void {
    this.current = sanitizeSettings({ ...this.current, ...patch });
    saveSettings(this.current);
    for (const fn of this.listeners) fn(this.current);
  }

  subscribe(fn: (s: Settings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
