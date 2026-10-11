/**
 * 主题注册表：每个主题定义 id / 中文名 / emoji / 背景工厂函数。
 * createBackground 按 themeId 查找并实例化对应 BackgroundLayer。
 */

import type { BackgroundLayer } from "./effects";
import { TrainNightBackground } from "./train-background";
import { SnowWorldBackground } from "./snow-background";
import { PrairieBackground } from "./prairie-background";
import { BeachBackground } from "./beach-background";
import { DesertBackground } from "./desert-background";

export interface ThemeDef {
  id: string;
  label: string; // 中文名
  icon: string; // emoji
  factory: (opts: { reduceMotion: boolean }) => BackgroundLayer;
}

export const THEMES: ThemeDef[] = [
  {
    id: "train-night",
    label: "夜行小火车",
    icon: "🚂",
    factory: (opts) => new TrainNightBackground({ reduceMotion: opts.reduceMotion }),
  },
  {
    id: "snow-world",
    label: "冰天雪地",
    icon: "❄️",
    factory: (opts) => new SnowWorldBackground({ reduceMotion: opts.reduceMotion }),
  },
  {
    id: "pony-prairie",
    label: "草原小马",
    icon: "🐴",
    factory: (opts) => new PrairieBackground({ reduceMotion: opts.reduceMotion }),
  },
  {
    id: "beach-sand",
    label: "海边沙滩",
    icon: "🏖️",
    factory: (opts) => new BeachBackground({ reduceMotion: opts.reduceMotion }),
  },
  {
    id: "desert-camel",
    label: "沙漠骆驼",
    icon: "🐫",
    factory: (opts) => new DesertBackground({ reduceMotion: opts.reduceMotion }),
  },
];

export function createBackground(themeId: string, opts: { reduceMotion: boolean }): BackgroundLayer {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  return theme.factory(opts);
}

export function getThemeDef(themeId: string): ThemeDef {
  return THEMES.find((t) => t.id === themeId) ?? THEMES[0];
}
