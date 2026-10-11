import assert from 'node:assert/strict';
import test from 'node:test';
import { clearAppState, defaultAppState, parseAppState, recordRhythmBest, recordRhythmGame, loadAppState, saveAppState } from '../apps/web/src/storage.ts';

test('损坏或未知版本数据回退到默认状态', () => {
  assert.equal(parseAppState('{bad json').schemaVersion, 1);
  assert.deepEqual(parseAppState(JSON.stringify({ schemaVersion: 99 })), defaultAppState());
});
test('有效数据保留配置和架子鼓成绩', () => {
  const state = parseAppState(JSON.stringify({ schemaVersion: 1, config: { fontSize: '大字' }, rhythm: { bestScores: { twinkle: 880 }, lastSongId: 'twinkle' } }));
  assert.equal(state.config.fontSize, '大字');
  assert.equal(state.rhythm.bestScores.twinkle, 880);
});
test('成绩只保留最高分，清除数据恢复默认状态', () => {
  const state = recordRhythmBest(defaultAppState(), 'twinkle', 900);
  assert.equal(recordRhythmBest(state, 'twinkle', 100).rhythm.bestScores.twinkle, 900);
  assert.deepEqual(clearAppState(), defaultAppState());
});
test('恢复数据过滤无效歌曲背景和负数成绩，不恢复设备连接', () => {
  const restored = parseAppState(JSON.stringify({schemaVersion:1,config:{device:'已连接',sound:'yes'},rhythm:{lastSongId:'missing',lastBackgroundId:'missing',bestScores:{twinkle:-10,babybaby:800}}}));
  assert.equal(restored.config.device, '未连接');
  assert.equal(restored.config.sound, true);
  assert.equal(restored.rhythm.lastSongId, 'twinkle');
  assert.equal(restored.rhythm.lastBackgroundId, 'train');
  assert.deepEqual(restored.rhythm.bestScores, {babybaby:800});
});
test('旧配置迁移保留源数据且重复加载不会重置成绩', () => {
  const data = new Map<string,string>([['kele-config',JSON.stringify({fontSize:'大字',sound:false})]]);
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)}};
  const migrated=loadAppState(storage);
  assert.equal(migrated.config.fontSize,'大字');
  assert.equal(migrated.config.sound,false);
  saveAppState(recordRhythmBest(migrated,'twinkle',900),storage);
  assert.equal(loadAppState(storage).rhythm.bestScores.twinkle,900);
  assert.ok(data.has('kele-config'));
});
test('未知版本不被静默覆盖，存储失败向调用者报告', () => {
  let written=false;
  assert.throws(()=>saveAppState(defaultAppState(),{getItem:()=>'{"schemaVersion":99}',setItem:()=>{written=true}}));
  assert.equal(written,false);
  assert.throws(()=>saveAppState(defaultAppState(),{getItem:()=>null,setItem:()=>{throw new Error('quota')}}),/quota/);
});
test('游戏记录支持恢复、去重和50条保存上限',()=>{
  let state=defaultAppState();
  for(let index=0;index<60;index++) state=recordRhythmGame(state,{id:String(index),songId:'twinkle',backgroundId:'train',score:index,playedAt:'2026-10-01T00:00:00Z'});
  assert.equal(state.rhythm.records.length,50);
  assert.equal(state.rhythm.bestScores.twinkle,59);
  assert.deepEqual(parseAppState(JSON.stringify(state)).rhythm,state.rhythm);
  assert.equal(recordRhythmGame(state,state.rhythm.records[0]),state);
});
