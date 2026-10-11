export type RhythmSong = { id: string; title: string; difficulty: string; bestScore: number };
export type RhythmBackground = { id: string; title: string; emoji: string };

export const rhythmSongs: RhythmSong[] = [
  { id: 'twinkle', title: '小星星', difficulty: '入门 · 4键', bestScore: 0 },
  { id: 'babybaby', title: '宝贝宝贝', difficulty: '简单 · 4键', bestScore: 0 },
  { id: 'grow', title: '生长吧', difficulty: '进阶 · 4键', bestScore: 0 },
];

export const rhythmBackgrounds: RhythmBackground[] = [
  { id: 'train', title: '夜行小火车', emoji: '🚂' },
  { id: 'snow', title: '冰天雪地', emoji: '❄️' },
  { id: 'grassland', title: '草原小马', emoji: '🐎' },
  { id: 'beach', title: '海边沙滩', emoji: '🏖️' },
  { id: 'desert', title: '沙漠骆驼', emoji: '🐪' },
];

export type RhythmSession = { songId: string; backgroundId: string; score: number; combo: number };

export function createRhythmSession(songId: string, backgroundId: string): RhythmSession {
  if (!rhythmSongs.some((song) => song.id === songId)) throw new Error('歌曲不存在');
  if (!rhythmBackgrounds.some((background) => background.id === backgroundId)) throw new Error('背景不存在');
  return { songId, backgroundId, score: 0, combo: 0 };
}

export function registerRhythmHit(session: RhythmSession): RhythmSession {
  const combo = session.combo + 1;
  return { ...session, combo, score: session.score + 100 + combo * 10 };
}
