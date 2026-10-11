import {currentMemberStorage} from './member-context.ts';
export const STORAGE_KEY = 'kele-platform-state';
export const STORAGE_VERSION = 1;
export type GameRecord = { id:string; songId:string; backgroundId:string; score:number; playedAt:string };
export type LearningProgress = { completedIds:string[]; points:number };
export type AppState = { learning:{english:LearningProgress;idiom:LearningProgress}; schemaVersion: number; config: { defaultMode: string; device: string; sound: boolean; fontSize: string }; rhythm: { bestScores: Record<string, number>; lastSongId: string; lastBackgroundId: string; records:GameRecord[] } };
export const defaultAppState = (): AppState => ({ learning:{english:{completedIds:[],points:0},idiom:{completedIds:[],points:0}},schemaVersion: STORAGE_VERSION, config: { defaultMode: 'rhythm-game', device: '未连接', sound: true, fontSize: '标准' }, rhythm: { bestScores: {}, lastSongId: 'twinkle', lastBackgroundId: 'train',records:[] } });
export function parseAppState(raw: string | null): AppState {
  const base = defaultAppState();
  if (!raw) return base;
  try {
    const value = JSON.parse(raw);
    if (!value || value.schemaVersion !== STORAGE_VERSION) return base;
    const c = value.config || {};
    const r = value.rhythm || {};
    const modeIds = ['rhythm-game','primary-english','idiom-chain','voice-input-bridge','companion-chat','creator-studio'];
    base.config.defaultMode = modeIds.includes(c.defaultMode) ? c.defaultMode : base.config.defaultMode;
    base.config.fontSize = ['标准','大字','特大'].includes(c.fontSize) ? c.fontSize : base.config.fontSize;
    base.config.sound = typeof c.sound === 'boolean' ? c.sound : base.config.sound;
    // Connection is runtime state and must never be restored as connected.
    base.rhythm.lastSongId = ['twinkle','babybaby','grow'].includes(r.lastSongId) ? r.lastSongId : 'twinkle';
    base.rhythm.lastBackgroundId = ['train','snow','grassland','beach','desert'].includes(r.lastBackgroundId) ? r.lastBackgroundId : 'train';
    for (const id of ['twinkle','babybaby','grow']) {
      const score = r.bestScores?.[id];
      if (typeof score === 'number' && Number.isFinite(score) && score >= 0) base.rhythm.bestScores[id] = score;
    }
    if (Array.isArray(r.records)) base.rhythm.records = r.records.filter((record:GameRecord)=>record && typeof record.id==='string' && ['twinkle','babybaby','grow'].includes(record.songId) && ['train','snow','grassland','beach','desert'].includes(record.backgroundId) && Number.isFinite(record.score) && record.score>=0 && typeof record.playedAt==='string' && Number.isFinite(Date.parse(record.playedAt))).slice(0,50);
    for (const key of ["english","idiom"] as const) {
      const progress=value.learning?.[key];
      if(progress){base.learning[key]={completedIds:Array.isArray(progress.completedIds)?[...new Set<string>(progress.completedIds.filter((id:unknown)=>typeof id==="string" && id.length<100))].slice(0,1000):[],points:Number.isSafeInteger(progress.points)&&progress.points>=0?progress.points:0};}
    }
    return base;
  } catch { return base; }
}
export interface StateStorage { getItem(key:string):string|null; setItem(key:string,value:string):void }
export function loadAppState(storage?:StateStorage): AppState {
  const store = storage ?? currentMemberStorage();
  if (!store) return defaultAppState();
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw !== null) return parseAppState(raw);
    const legacy = store.getItem('kele-config');
    if (legacy) {
      const migrated = parseAppState(JSON.stringify({schemaVersion:1,config:JSON.parse(legacy),rhythm:defaultAppState().rhythm}));
      store.setItem(STORAGE_KEY,JSON.stringify(migrated));
      return migrated;
    }
  } catch { /* Keep original data when reading or migration fails. */ }
  return defaultAppState();
}
export function saveAppState(state: AppState, storage?:StateStorage): void {
  const store = storage ?? currentMemberStorage();
  if (!store) return;
  const existing = store.getItem(STORAGE_KEY);
  if (existing) {
    let version:unknown;
    try { version=JSON.parse(existing)?.schemaVersion; } catch { /* Corrupt data can be replaced by a valid state. */ }
    if (typeof version === 'number' && version !== STORAGE_VERSION) throw new Error('此设备包含其他版本的数据，请先导出备份，当前数据未覆盖。');
  }
  store.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function clearAppState(): AppState { const state = defaultAppState(); saveAppState(state); return state; }
export function recordRhythmBest(state: AppState, songId: string, score: number): AppState { return { ...state, rhythm: { ...state.rhythm, bestScores: { ...state.rhythm.bestScores, [songId]: Math.max(state.rhythm.bestScores[songId] || 0, score) } } }; }
export function recordRhythmGame(state:AppState, record:GameRecord):AppState {
  if (state.rhythm.records.some(item=>item.id===record.id)) return state;
  const next=recordRhythmBest(state,record.songId,record.score);
  return {...next,rhythm:{...next.rhythm,records:[record,...next.rhythm.records].slice(0,50)}};
}
