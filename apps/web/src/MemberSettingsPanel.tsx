import {memberPermissions} from './member-permissions.ts';
import React from 'react';
import {modes} from '@kele/mode-registry';
import {memberContext} from './member-context.ts';
import {memberSettingsClient} from './member-settings-client.ts';
import type {MemberSettings,SettingsSnapshot} from '../../server/src/settings-repository.ts';
export function MemberSettingsPanel({onApply}:{onApply:(settings:MemberSettings)=>void}){
 const permissions=React.useSyncExternalStore(memberPermissions.subscribe,memberPermissions.getSnapshot);
 const canWrite=memberPermissions.has('settings.write');
 const context=memberContext.getSnapshot(),profile=context.member!;
 const [snapshot,setSnapshot]=React.useState<SettingsSnapshot|null>(null),[draft,setDraft]=React.useState<MemberSettings|null>(null);
 const [busy,setBusy]=React.useState(false),[conflict,setConflict]=React.useState(false),[message,setMessage]=React.useState('正在读取成员设置…');
 const [confirmReload,setConfirmReload]=React.useState(false);
 const controller=React.useRef<AbortController|null>(null),active=React.useRef(false),apply=React.useRef(onApply);apply.current=onApply;
 const request=async(save:boolean)=>{
  if(active.current||context.revision!==memberContext.getSnapshot().revision)return;
  if(save&&(!canWrite||!snapshot||!draft||conflict))return;
  active.current=true;controller.current?.abort();const current=new AbortController();controller.current=current;setBusy(true);
  const changed=memberContext.getSignal(),abort=()=>current.abort();changed.addEventListener('abort',abort,{once:true});
  setMessage(save?'正在保存成员设置…':'正在读取成员设置…');
  try{
   const response=await fetch('/api/v1/members/'+encodeURIComponent(profile.id)+'/settings',{method:save?'PUT':'GET',credentials:'same-origin',signal:current.signal,...(save?{headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:snapshot!.version,settings:draft})}:{})});
   if(response.status===409){setConflict(true);throw new Error('设置已在其他页面或设备更新。你的修改仍在这里，请重新加载最新设置后再保存。');}
   if(!response.ok)throw new Error(response.status===401?'登录已过期，请返回家庭页面登录。':response.status===403?'无权读取或修改这位成员的设置。':'成员设置服务暂时不可用，请重试。');
   const body=await response.json(),value=body.data as SettingsSnapshot;
   if(!value||value.profileId!==profile.id||!Number.isSafeInteger(value.version)||value.version<0||!value.settings||!modes.some(mode=>mode.id===value.settings.defaultMode)||typeof value.settings.sound!=='boolean'||!['标准','大字','特大'].includes(value.settings.fontSize))throw new Error('设置响应异常，请重试。');
   if(current.signal.aborted||context.revision!==memberContext.getSnapshot().revision)return;
   memberSettingsClient.adopt(value);setSnapshot(value);setDraft({...value.settings});setConflict(false);apply.current(value.settings);
   setMessage(save?'成员设置已保存。':'已读取这位成员的最新设置。');
  }catch(error){if(!current.signal.aborted)setMessage(error instanceof Error?error.message:'读取失败，请重试。');}
  finally{changed.removeEventListener('abort',abort);if(controller.current===current){active.current=false;if(!current.signal.aborted)setBusy(false);}}
 };
 React.useEffect(()=>{void request(false);return()=>{controller.current?.abort();active.current=false;};},[]);
 return <section className="settings-card personal"><h2>{profile.displayName}的成员设置</h2><p>这些设置保存在服务端；设备连接状态仍仅在当前设备生效。</p>{draft&&<><label>默认模式<select disabled={busy||!canWrite} value={draft.defaultMode} onChange={event=>setDraft({...draft,defaultMode:event.target.value})}>{modes.map(mode=><option key={mode.id} value={mode.id}>{mode.title}</option>)}</select></label><label>界面字号<select disabled={busy||!canWrite} value={draft.fontSize} onChange={event=>setDraft({...draft,fontSize:event.target.value as MemberSettings['fontSize']})}><option>标准</option><option>大字</option><option>特大</option></select></label><label>提示音<select disabled={busy||!canWrite} value={draft.sound?'开启':'关闭'} onChange={event=>setDraft({...draft,sound:event.target.value==='开启'})}><option>开启</option><option>关闭</option></select></label></>}<p role="status" aria-live="polite">{message}</p><p>{permissions.status==="ready"?(canWrite?"可以修改这位成员的设置。":"当前仅可查看设置，不能修改。"):"权限尚未核实，修改暂不可用。"}</p><button className="secondary" disabled={permissions.status==="loading"} onClick={()=>{void memberPermissions.load().catch(()=>{})}}>重新检查权限</button><button className="primary" disabled={busy||!draft||conflict||!canWrite} onClick={()=>void request(true)}>保存成员设置</button> <button className="secondary" disabled={busy} onClick={()=>{if(conflict)setConfirmReload(true);else void request(false);}}>重新加载成员设置</button>{confirmReload&&<div role="alert"><p>重新加载会替换这里尚未保存的修改，是否继续？</p><button className="secondary" onClick={()=>setConfirmReload(false)}>保留修改</button> <button className="primary" onClick={()=>{setConfirmReload(false);void request(false);}}>确认重新加载</button></div>}</section>;
}
