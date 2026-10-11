import React from 'react';
import {readRecords} from './play-data.ts';
import './play.css';
import './mobile-experience.css';
import './viewport-layout.css';
import {IdiomGame} from './IdiomGame.tsx';
import {NetworkStatus} from './NetworkStatus.tsx';
import {RELEASE_VERSION} from './release.ts';
type Mode='home'|'english'|'rhythm'|'idiom';
export function PlayApp(){
 const [mode,setMode]=React.useState<Mode>(()=>{const mode=new URLSearchParams(location.search).get('mode');return mode==='english'||mode==='rhythm'||mode==='idiom'?mode:'home';});const [records,setRecords]=React.useState(readRecords);
 const back=()=>{if('speechSynthesis' in window)speechSynthesis.cancel();setMode('home');setRecords(readRecords());window.scrollTo(0,0);};
 return <div className={'play-app play-mode-'+mode}><NetworkStatus/><header className="play-header"><button onClick={back} className="play-brand">可乐同学 <span>一起玩，一起学</span></button><span>免登录试玩</span></header><main>{mode==='home'?<><section className="play-hero"><div className="play-face" aria-label="可乐同学">● ●</div><p>给孩子的好奇心，给长辈的小乐趣</p><h1>今天，想玩点什么？</h1><p>选一个就开始。无需账号，也不用连接开发板。</p></section><div className="play-cards"><button onClick={()=>setMode('english')}><span>🍎</span><h2>小学英语</h2><p>词汇、听力、口语、翻译和我的单词库</p><b>开始学习 →</b></button><button onClick={()=>setMode('rhythm')}><span>🥁</span><h2>星空小鼓手</h2><p>3 首歌曲 · 3 档难度 · 5 种背景</p><b>开始演奏 →</b></button><button onClick={()=>setMode('idiom')}><span>🌿</span><h2>成语接龙</h2><p>3 关 24 题 · 奖励音效 · 多种风景</p><b>开始接龙 →</b></button></div><section className="play-history"><h2>这台设备的最近成绩</h2>{records.length?<ul>{records.slice(0,6).map(r=><li key={r.id}><span>{{english:'小学英语',rhythm:'架子鼓',idiom:'成语接龙'}[r.mode]}</span><b>{r.score}{r.mode==='english'?'%':' 分'}</b><small>{new Date(r.date).toLocaleString('zh-CN')}</small></li>)}</ul>:<p>完成第一局，成绩就会出现在这里。</p>}<p>记录只保存在当前浏览器。原版英语与架子鼓的学习数据和设置保留在各自模块中；下面是早期试玩记录。</p></section></>:<><button className="play-back" onClick={back}>← 返回试玩首页</button>{mode==='english'?<OriginalGame mode="english"/>:mode==='rhythm'?<OriginalGame mode="rhythm"/>:<IdiomGame/>}</>}</main><footer>家庭互动试玩版 · 电脑 / 手机触控 · 本机记录 · <a href="/devices">蓝牙与语音输入检测</a></footer></div>;
}
export function OriginalGame({mode}:{mode:'english'|'rhythm'}){
 const frame=React.useRef<HTMLIFrameElement>(null);
 React.useEffect(()=>{
  const forward=(event:KeyboardEvent)=>{
   if(!event.isTrusted||event.isComposing||(event.type==='keydown'&&(event.ctrlKey||event.altKey||event.metaKey)))return;
   if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
   let mapping=Array.from({length:8},(_,i)=>'Digit'+(i+1));
   try{const saved=JSON.parse(localStorage.getItem('kele-wireless-keymap-v1')??'null');if(Array.isArray(saved)&&saved.length===8&&saved.every(v=>typeof v==='string'))mapping=saved}catch{}
   const nativeIndex=mode==='rhythm'?['KeyD','KeyF','KeyJ','KeyK'].indexOf(event.code):-1;
   const code=nativeIndex>=0?mapping[nativeIndex]:event.code;
   if(!mapping.includes(code))return;
   event.preventDefault();
   frame.current?.contentWindow?.postMessage({type:'kele-wireless-key',phase:event.type,code,key:event.key,repeat:event.repeat},location.origin);
  };
  const release=()=>frame.current?.contentWindow?.postMessage({type:'kele-wireless-release'},location.origin);
  addEventListener('keydown',forward);addEventListener('keyup',forward);addEventListener('blur',release);
  return()=>{release();removeEventListener('keydown',forward);removeEventListener('keyup',forward);removeEventListener('blur',release)};
 },[mode]);
 const path=(mode==='english'?'/legacy/english/index.html':'/legacy/drum/index.html')+'?v='+RELEASE_VERSION+(new URLSearchParams(location.search).has('timingDebug')?'&timingDebug=1':'');
 return <section className={`original-game original-${mode}`}><div className="original-toolbar"><h1>{mode==='english'?'小学英语 · 呱啦叽哩':'架子鼓 · 星空小鼓手'}</h1><a href={path} target="_blank" rel="noopener noreferrer">全屏打开 ↗</a></div><p className="original-hint">{mode==='english'?'点朗读按钮播放声音，手机请调高媒体音量。口语反馈来自识别文字匹配，不是专业声学发音评分。':'无需开发板：选歌开始后，用手指敲下方四个鼓垫。右上角齿轮可更换背景、音量和校准。'}</p><iframe ref={frame} key={mode} title={mode==='english'?'原版儿童英语学习':'原版架子鼓游戏'} src={path} allow="microphone; autoplay; serial"/></section>;
}
