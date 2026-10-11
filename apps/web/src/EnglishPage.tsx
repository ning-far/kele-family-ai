import React from 'react';
import {englishLearningModes} from '../../../packages/mode-registry/src/english.ts';
import {memberContext} from './member-context.ts';
import {prepareRecognitionSync} from './recognition-sync.ts';
import {loadAppState,saveAppState} from './storage.ts';
type Question={id:string;word:string;choices:{id:string;label:string}[]};
type Catalog={version:string;items:Question[]};
export function EnglishPage({onBack}:{onBack:()=>void}){
 const member=React.useSyncExternalStore(memberContext.subscribe,memberContext.getSnapshot);
 const [active,setActive]=React.useState('recognize'),[catalog,setCatalog]=React.useState<Catalog|null>(null),[index,setIndex]=React.useState(0);
 const [message,setMessage]=React.useState('正在加载练习…'),[busy,setBusy]=React.useState(false),[complete,setComplete]=React.useState(false),[choice,setChoice]=React.useState('');
 const retry=React.useRef<ReturnType<typeof prepareRecognitionSync>|null>(null),requesting=React.useRef(false);
 React.useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/v1/english/recognition',{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error();const body=await response.json();
   if(!body.data?.version||!Array.isArray(body.data.items)||!body.data.items.length||!body.data.items.every((q:Question)=>typeof q.id==='string'&&typeof q.word==='string'&&Array.isArray(q.choices)&&q.choices.length&&q.choices.every(c=>typeof c.id==='string'&&typeof c.label==='string')))throw new Error();
   if(!controller.signal.aborted){setCatalog(body.data);setMessage('看看这个单词，选择它的意思。');}
  }).catch(()=>{if(!controller.signal.aborted)setMessage('练习加载失败，请稍后重新进入。');});
  return()=>controller.abort();
 },[]);
 const question=catalog?.items[index];
 const sync=async()=>{
  if(requesting.current||!retry.current)return;requesting.current=true;setBusy(true);setMessage('正在保存学习结果…');
  try{
   const result=await retry.current();
   if(!result.correct){retry.current=null;setMessage('再想一想，你可以重新选择。');return;}
   retry.current=null;setComplete(true);setMessage('答对了！学习进度已保存，重复提交不会重复加分。');
  }catch(error){
   const code=error instanceof Error?error.message:'';
   if(code==='MEMBER_CHANGED')return;
   setMessage(code==='LOGIN_REQUIRED'?'登录已过期，请到家庭页面重新登录。':code==='PROFILE_FORBIDDEN'?'当前档案授权已变化，请到家庭页面检查。':code==='ANSWER_CONFLICT'?'题目或提交已变化，请重新进入练习。':'保存暂未确认，点击重试会使用同一条提交。');
  }finally{requesting.current=false;setBusy(false);}
 };
 const answer=async(id:string)=>{
  if(!catalog||!question||busy||retry.current||complete)return;setChoice(id);
  if(member.member){retry.current=prepareRecognitionSync({contentId:question.id,contentVersion:catalog.version,choiceId:id});await sync();return;}
  if(id!==question.id){setMessage('再想一想，你可以重新选择。');return;}
  try{
   const state=loadAppState(),progress=state.learning.english;
   const completedIds=[...new Set([...progress.completedIds,question.id])];
   saveAppState({...state,learning:{...state.learning,english:{completedIds,points:completedIds.length}}});
   setComplete(true);setMessage('答对了！访客练习仅保存在这台设备，没有上传。');
  }catch{setMessage('答对了，但本机保存失败，请检查浏览器存储空间。');}
 };
 return <><button className="back" onClick={onBack}>← 返回模式中心</button><div className="title-row"><div><p className="eyebrow">小学英语</p><h1>认识单词，慢慢学会表达</h1><p className="intro">当前先开放3个词汇的识别练习；听说读写课程将继续接入。</p></div></div><div className="mode-layout"><section><h2>学习方式</h2><div className="section-list">{englishLearningModes.map(mode=><button key={mode.id} className={active===mode.id?'selected':''} onClick={()=>setActive(mode.id)}>{mode.title}</button>)}</div></section><section className="settings-card">{active==='recognize'?<><p>{member.member?'当前学习者：'+member.member.displayName:'访客练习 · 本机保存'}</p>{question&&<><p>第 {index+1} / {catalog!.items.length} 题</p><h2 lang="en">{question.word}</h2><div className="section-list">{question.choices.map(item=><button key={item.id} disabled={busy||complete||Boolean(retry.current)} aria-pressed={choice===item.id} onClick={()=>void answer(item.id)}>{item.label}</button>)}</div></>}<p role="status" aria-live="polite">{message}</p>{retry.current&&!busy&&<button className="secondary" onClick={()=>void sync()}>重试保存</button>}{complete&&<button className="primary" onClick={()=>{setIndex((index+1)%catalog!.items.length);setChoice('');setComplete(false);setMessage('看看这个单词，选择它的意思。');}}>下一题</button>}</>:<><h2>{englishLearningModes.find(mode=>mode.id===active)?.title}</h2><p>{englishLearningModes.find(mode=>mode.id===active)?.goal}</p><p>这项学习方式尚在开发，请先体验认识单词。</p><button className="secondary" onClick={()=>setActive('recognize')}>去认识单词</button></>}</section></div></>;
}
