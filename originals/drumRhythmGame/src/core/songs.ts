/**
 * 歌曲注册表：所有可用歌曲的元数据。
 *
 * 添加新歌曲步骤：
 *  1. 把 MP3 放到 public/audio/<id>.mp3
 *  2. 把谱面 JSON 放到 public/charts/<id>.json（格式见 charts/twinkle.json）
 *  3. 在本文件 SONGS 数组中加一条 SongEntry
 *
 * hasAudio=false 的歌曲在首页会显示为「敬请期待」（disabled），
 * 除非 id === "twinkle"（合成旋律，无需 MP3）。
 */

export interface SongEntry {
  id: string;
  title: string;
  icon: string;
  /** 谱面 JSON 路径（相对于 public/，通过 fetch 加载）。 */
  chartPath: string;
  /** 是否有配套 MP3（false 且非 twinkle 时首页显示敬请期待）。 */
  hasAudio: boolean;
  /** 标签，如 "4 键"。 */
  tag?: string;
}

export const SONGS: SongEntry[] = [
  {
    id: "twinkle",
    title: "小星星",
    icon: "★",
    chartPath: "charts/twinkle.json",
    hasAudio: false,
    tag: "4 键",
  },
  {
    id: "babybaby",
    title: "宝贝宝贝",
    icon: "👶",
    chartPath: "charts/babybaby.json",
    hasAudio: true,
    tag: "4 键",
  },
  {
    id: "grow",
    title: "生长吧",
    icon: "🌱",
    chartPath: "charts/grow.json",
    hasAudio: true,
    tag: "4 键",
  },
  {
    "id": "red-star",
    "title": "红星闪闪",
    "icon": "🎵",
    "chartPath": "charts/red-star.json",
    "hasAudio": true,
    "tag": "录音对齐"
  },
  {
    "id": "white-rabbit",
    "title": "小白兔白又白",
    "icon": "🎵",
    "chartPath": "charts/white-rabbit.json",
    "hasAudio": true,
    "tag": "录音对齐"
  },
];
