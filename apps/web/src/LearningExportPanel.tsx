import {memberPermissions} from './member-permissions.ts';
import React from 'react';
import {memberContext} from './member-context.ts';
export function LearningExportPanel(){
 const permissions=React.useSyncExternalStore(memberPermissions.subscribe,memberPermissions.getSnapshot);
 const canExport=permissions.status==='ready'&&memberPermissions.has('progress.read');
 const member=React.useSyncExternalStore(memberContext.subscribe,memberContext.getSnapshot);
 const [confirm,setConfirm]=React.useState(false),[busy,setBusy]=React.useState(false),[message,setMessage]=React.useState('');
 const active=React.useRef<AbortController|null>(null);
 React.useEffect(()=>{active.current?.abort();setConfirm(false);setBusy(false);setMessage('');return()=>active.current?.abort()},[member.revision]);
 if(!member.member)return null;
 const download=async()=>{
  if(!canExport||(active.current&&!active.current.signal.aborted))return;
  const controller=new AbortController();active.current=controller;const revision=member.revision,profileId=member.member!.id;
  setBusy(true);setMessage('正在准备下载…');
  try{
   const response=await fetch('/api/v1/members/'+profileId+'/learning-export',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({confirmedProfileId:profileId}),signal:controller.signal});
   if(!response.ok)throw new Error(response.status===403?'授权已变化，请到家庭页面检查。':response.status===401?'登录已过期，请重新登录。':response.status===413?'数据较多，异步导出尚未接入。':'导出失败，请稍后重试。');
   const data=await response.json();if(data.schemaVersion!==1||data.profile?.id!==profileId)throw new Error('导出数据校验失败，未下载。');
   if(controller.signal.aborted||memberContext.getSnapshot().revision!==revision)return;
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='kele-learning-export.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setConfirm(false);setMessage('已发起下载，请检查浏览器下载列表并妥善保存。');
  }catch(error){if(!controller.signal.aborted&&memberContext.getSnapshot().revision===revision)setMessage(error instanceof Error?error.message:'导出失败，请重试。');}
  finally{if(active.current===controller){active.current=null;setBusy(false);}}
 };
 return <section className="notice"><h2>{member.member.displayName}的学习数据</h2><p>从服务端下载档案摘要、学习进度、累计积分和通用设置，不包含聊天和语音。</p>{confirm?<><p>确认下载{member.member.displayName}的学习数据？文件可能含家庭信息，请妥善保存。</p><button className="secondary" disabled={busy} onClick={()=>setConfirm(false)}>取消下载</button><button className="primary" disabled={busy||!canExport} onClick={()=>{void download()}}>确认下载学习数据</button></>:<button className="secondary" disabled={!canExport} onClick={()=>setConfirm(true)}>下载学习数据</button>}<p role="status">{message}</p></section>;
}
