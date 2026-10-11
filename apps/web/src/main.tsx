import {memberPermissions} from './member-permissions.ts';
import {PlayApp,OriginalGame} from './PlayApp.tsx';
import {DevicePanel,DevicePage} from './DevicePanel.tsx';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {modes,findMode} from '@kele/mode-registry';
import {clearAppState,loadAppState,saveAppState,AppState} from './storage';
import {DataManagement} from './DataManagement';
import {FamilyPage} from './FamilyPage';
import {MemberSettingsPanel} from './MemberSettingsPanel';
import {memberContext} from './member-context.ts';
import {memberSettingsClient} from './member-settings-client.ts';
import {sessionBootstrap} from './session-bootstrap.ts';
import './style.css';
import './t06.css';
import './rhythm.css';

type Tab='主页'|'模式'|'家庭'|'我的';
const detail:Record<string,string[]>={
  'rhythm-game':['歌曲选择','背景设置','成绩记录'], 'primary-english':['认识单词','听力理解','跟我读','阅读理解','写一写','我的单词库','中英互译'],
  'idiom-chain':['选择题接龙','语音接龙','提示与奖励'], 'voice-input-bridge':['S1 启停设置','输入法映射','快捷键测试'],
  'companion-chat':['儿童陪聊','长辈陪聊','子女声音形象','聊天记录'], 'creator-studio':['微信公众号','小红书笔记','短视频脚本','提示词版本']
};
function App(){
 const member=React.useSyncExternalStore(memberContext.subscribe,memberContext.getSnapshot);
 const sessionState=React.useSyncExternalStore(sessionBootstrap.subscribe,sessionBootstrap.getSnapshot);
 React.useEffect(()=>{void sessionBootstrap.load().catch(()=>{})},[]);
 const permissionsState=React.useSyncExternalStore(memberPermissions.subscribe,memberPermissions.getSnapshot);
 const settingsState=React.useSyncExternalStore(memberSettingsClient.subscribe,memberSettingsClient.getSnapshot);
 const route=()=>{const p=window.location.pathname;return {tab:(p.startsWith('/modes')?'模式':p==='/family'?'家庭':p==='/me'?'我的':'主页') as Tab,id:findMode(p.split('/')[2])?.id}};
 const r=route(); const [tab,setTab]=React.useState<Tab>(r.tab),[selected,setSelected]=React.useState<string|undefined>(r.id);
 const [state,setState]=React.useState<AppState>(()=>loadAppState()); const config={...state.config,...settingsState.snapshot?.settings}; const [saved,setSaved]=React.useState(false);
 const navigate=(next:Tab,id?:string)=>{setTab(next);setSelected(id);window.history.pushState(null,'',id?'/modes/'+id:next==='模式'?'/modes':next==='家庭'?'/family':next==='我的'?'/me':'/home/')};
 React.useEffect(()=>{const f=()=>{const x=route();setTab(x.tab);setSelected(x.id)};addEventListener('popstate',f);return()=>removeEventListener('popstate',f)},[]);
 React.useEffect(()=>{setState(loadAppState());setSaved(false);if(member.member){void memberSettingsClient.load().catch(()=>{});void memberPermissions.load().catch(()=>{})}},[member.revision]);
 const saveLocal=(c:any)=>{const current=loadAppState();const next={...current,config:{...current.config,...c}};try{saveAppState(next)}catch(error){window.alert(error instanceof Error?error.message:"数据保存失败，请检查浏览器存储空间。");return;}setState(next);setSaved(true);setTimeout(()=>setSaved(false),1800)};
 const save=(c:any)=>{if(member.member&&['defaultMode','sound','fontSize'].some(key=>key in c)){const revision=member.revision;void memberSettingsClient.update(c).then(value=>{if(memberContext.getSnapshot().revision===revision)saveLocal(value.settings)}).catch(()=>{});}else saveLocal(c)};
 const mode=findMode(selected);
 const textScale=config.fontSize==='特大'?1.5:config.fontSize==='大字'?1.25:1;
 return <div className="shell" data-text-size={config.fontSize} style={{'--text-scale':textScale} as React.CSSProperties}><aside><a className="brand" href="/" onClick={e=>{e.preventDefault();navigate('主页')}}>可乐同学<span>家庭互动平台</span></a><nav aria-label="主导航">{(['主页','模式','家庭','我的'] as Tab[]).map(x=><button aria-current={tab===x?'page':undefined} key={x} onClick={()=>navigate(x)}>{x}</button>)}</nav><div className="connection"><a href="/devices">蓝牙与语音输入检测 →</a><p>在系统设置中配对开发板</p></div></aside><main><header><span>{member.member?member.member.displayName+" · 一起学习，轻松陪伴":"一起学习，轻松陪伴"}</span><span className="badge">{saved?'已保存':'本机版 · 云端未接入'}</span></header><a className="mvp-entry" href="/play">直接试玩：小学英语 · 小星星架子鼓 · 成语接龙 →</a>{sessionState.message&&(tab==='家庭'||tab==='我的'||Boolean(member.member))&&<p role="status">{sessionState.message}</p>}{member.member&&settingsState.message&&<p role="status">{settingsState.message}</p>}{member.member&&permissionsState.message&&<p role="status">{permissionsState.message}</p>}{mode&&<section className="rhythm-actions"><p>常用模式：{findMode(config.defaultMode)?.title}</p><button className="secondary" disabled={Boolean(member.member)&&(settingsState.status!=="ready"||!memberPermissions.has("settings.write"))} onClick={()=>save({defaultMode:mode.id})}>设为常用模式</button></section>}{mode?(mode.id==='rhythm-game'?<OriginalGame mode="rhythm"/>:mode.id==='primary-english'?<OriginalGame mode="english"/>:mode.id==='voice-input-bridge'?<DevicePanel/>:<ModePage key={mode.id+":"+member.revision} mode={mode} onBack={()=>navigate('模式')}/>):tab==='模式'?<ModeList onOpen={id=>navigate('模式',id)}/>:tab==='家庭'?<FamilyPage/>:tab==='我的'?<Settings key={member.revision} config={config} onSave={saveLocal}/>:<Home onOpen={id=>navigate('模式',id)}/>}</main></div>;
}
function Home({onOpen}:{onOpen:(id:string)=>void}){return <><section className="hero"><div><p className="eyebrow">可乐同学</p><h1>今天，想做点什么？</h1><p className="intro">学一点新知识，玩一首喜欢的歌，<br/>或找可乐同学聊聊天。</p></div><div className="face" role="img" aria-label="待机中的可乐同学"><i/><i/></div></section><ModeGrid onOpen={onOpen}/></>}
function ModeList({onOpen}:{onOpen:(id:string)=>void}){return <><h1>模式中心</h1><p className="intro">选择一个模式，查看它的内容、配置和进度。</p><ModeGrid onOpen={onOpen}/></>}
function ModeGrid({onOpen}:{onOpen:(id:string)=>void}){return <><h2>全部模式</h2><div className="modes">{modes.map((m,i)=><button className="mode" key={m.id} onClick={()=>onOpen(m.id)}><span className="number">0{i+1}</span><h3>{m.title}</h3><p>{m.description}</p><span className="enter">查看并配置 →</span></button>)}</div></>}
function ModePage({mode,onBack}:{mode:NonNullable<ReturnType<typeof findMode>>;onBack:()=>void}){const items=detail[mode.id]||[];const [active,setActive]=React.useState(items[0]);return <><button className="back" onClick={onBack}>← 返回模式中心</button><div className="title-row"><div><p className="eyebrow">模式详情</p><h1>{mode.title}</h1><p className="intro">{mode.description}</p></div></div><div className="mode-layout"><section><h2>功能入口</h2><div className="section-list">{items.map(x=><button className={active===x?'selected':''} key={x} onClick={()=>setActive(x)}><span>{x}</span><span>›</span></button>)}</div><div className="notice compact"><strong>{active}</strong><p>功能入口已建立，真实内容和进度将在对应任务中接入。</p><button className="secondary" disabled>功能开发中</button></div></section><section><h2>模式设置</h2><div className="settings-card">{['难度/年级','提示方式','进度记录'].map(x=><label key={x}>{x}<select disabled defaultValue="默认"><option>默认</option><option>简单</option><option>标准</option><option>高级</option></select></label>)}<button className="primary wide" disabled>模式专属设置开发中</button></div><p className="footnote">开发板可选；手机或电脑可以直接使用。</p></section></div></>}
function Settings({config,onSave}:{config:any;onSave:(c:any)=>void}){return <><h1>我的设置</h1><DataManagement/><button className="secondary" onClick={()=>{if(window.confirm("清除本机配置和游戏成绩？此操作无法撤销。")){try{clearAppState();window.location.reload()}catch(error){window.alert(error instanceof Error?error.message:"清除失败，原数据已保留。")}}}}>清除本地数据</button><p className="intro">按自己的习惯使用可乐同学。</p>{memberContext.getSnapshot().member?<MemberSettingsPanel onApply={onSave}/>:<section className="settings-card personal"><label>默认模式<select value={config.defaultMode} onChange={e=>onSave({defaultMode:e.target.value})}>{modes.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label><label>界面字号<select value={config.fontSize} onChange={e=>onSave({fontSize:e.target.value})}><option>标准</option><option>大字</option><option>特大</option></select></label><label>提示音<select value={config.sound?'开启':'关闭'} onChange={e=>onSave({sound:e.target.value==='开启'})}><option>开启</option><option>关闭</option></select></label></section>}<DevicePanel/></>}
createRoot(document.getElementById('root')!).render(<React.StrictMode>{window.location.pathname.replace(/\/$/,'')==='/devices'?<DevicePage/>:window.location.pathname.startsWith('/play')?<PlayApp/>:<App/>}</React.StrictMode>);


