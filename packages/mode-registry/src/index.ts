import { ModeManifestSchema, type ModeId, type ModeManifest } from '@kele/schemas';
const definitions = [
  {id:'rhythm-game',title:'架子鼓',description:'选歌曲、跟节奏，记录自己的进步',category:'play',audiences:['child','adult']},
  {id:'primary-english',title:'小学英语',description:'认识单词、听懂句子、说得清楚',category:'learn',audiences:['child']},
  {id:'idiom-chain',title:'成语接龙',description:'点选汉字或说出成语，轻松动脑',category:'play',audiences:['senior','adult','child']},
  {id:'voice-input-bridge',title:'语音输入',description:'配置 S1，连接常用输入法',category:'create',audiences:['adult']},
  {id:'companion-chat',title:'陪聊',description:'选择适合自己的可乐同学人设',category:'companion',audiences:['senior','child','adult']},
  {id:'creator-studio',title:'自媒体创作',description:'管理公众号、笔记和短视频提示词',category:'create',audiences:['adult']}
] as const;
export const modes: readonly ModeManifest[] = Object.freeze(definitions.map(item=>ModeManifestSchema.parse({
  ...item,version:'0.1.0',entry:{web:'/modes/'+item.id,miniprogram:'/pages/index/index?mode='+item.id},
  device:{optional:true,capabilities:item.id==='voice-input-bridge'?['shortcut-bridge']:['buttons']},
  permissions:[],settingsSchema:{type:'object',additionalProperties:false},telemetryEvents:[]
})));
export function findMode(id:unknown):ModeManifest|undefined { return modes.find(mode=>mode.id===id); }
export function requireMode(id:ModeId):ModeManifest { const mode=findMode(id);if(!mode)throw new Error('UNKNOWN_MODE');return mode; }

