import React from 'react';
import {memberContext} from './member-context.ts';
import type {InvitationItem} from '../../server/src/invitation-reader.ts';
export function InvitationsPanel(){
 const actor=React.useSyncExternalStore(memberContext.subscribe,memberContext.getSnapshot).userId;
 const [direction,setDirection]=React.useState<'sent'|'received'>('received'),[items,setItems]=React.useState<InvitationItem[]>([]),[cursor,setCursor]=React.useState<string|null>(null);
 const [busy,setBusy]=React.useState(false),[message,setMessage]=React.useState(''),[confirm,setConfirm]=React.useState<string|null>(null);
 const active=React.useRef<AbortController|null>(null);
 const load=async(after?:string)=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setItems([]);setCursor(null);setConfirm(null);setMessage('正在读取邀请…');
  try{
   const params=new URLSearchParams({direction,...(after?{after}:{})});
   const response=await fetch('/api/v1/invitations?'+params,{credentials:'same-origin',signal:controller.signal});
   if(!response.ok)throw new Error('邀请暂未读取，请重试。');
   const data=(await response.json()).data;
   if(!Array.isArray(data?.items)||data.items.length>50||data.items.some((item:InvitationItem)=>!item?.id||typeof item.profileLabel!=='string'||!item.profileLabel||item.profileLabel.length>80||!['pending','accepted','expired','revoked'].includes(item.status)||(direction==='sent'?item.creatorUserId:item.recipientUserId)!==actor)||(data.nextCursor!==null&&typeof data.nextCursor!=='string'))throw new Error('邀请响应异常，请重试。');
   if(controller.signal.aborted||memberContext.getSnapshot().userId!==actor)return;
   setItems(data.items);setCursor(data.nextCursor);setMessage(data.items.length?'':'暂时没有邀请。');
  }catch(error){if(!controller.signal.aborted&&memberContext.getSnapshot().userId===actor)setMessage(error instanceof Error?error.message:'读取失败，请重试。');}
  finally{if(active.current===controller&&!controller.signal.aborted)setBusy(false);}
 };
 React.useEffect(()=>{void load();return()=>active.current?.abort()},[actor,direction]);
 const revoke=async(id:string)=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);
  try{
   const response=await fetch('/api/v1/invitations/'+encodeURIComponent(id)+'/revoke',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({confirmedInvitationId:id}),signal:controller.signal});
   if(!response.ok)throw new Error('撤销未确认，请重试；权限可能已变化。');
   const result=(await response.json()).data;if(result?.id!==id||result.status!=='revoked')throw new Error('撤销响应异常，请重新读取。');
   if(controller.signal.aborted||memberContext.getSnapshot().userId!==actor)return;
   setItems(previous=>previous.map(item=>item.id===id?{...item,status:'revoked'}:item));setConfirm(null);setMessage('邀请已撤销。');
  }catch(error){if(!controller.signal.aborted&&memberContext.getSnapshot().userId===actor)setMessage(error instanceof Error?error.message:'撤销失败，请重试。');}
  finally{if(active.current===controller&&!controller.signal.aborted)setBusy(false);}
 };
 return <section className="notice"><h2>家庭邀请</h2><button className="secondary" disabled={busy} aria-pressed={direction==='received'} onClick={()=>setDirection('received')}>收到的邀请</button> <button className="secondary" disabled={busy} aria-pressed={direction==='sent'} onClick={()=>setDirection('sent')}>发出的邀请</button><p role="status">{message}</p>{items.map(item=><article key={item.id}><h3>{item.profileLabel}的学习邀请</h3><p>可查看学习进度、积分及通用设置，不能修改，不包含聊天和语音。</p><p>{item.status==='pending'?'待接受':item.status==='revoked'?'已撤销':item.status==='accepted'?'已接受':'已过期'} · 到期时间：{new Date(item.expiresAt).toLocaleString('zh-CN')}</p>{(item.status==='pending'||(item.status==='accepted'&&direction==='sent'))&&(direction==='sent'?confirm===item.id?<><p>确认撤销{item.profileLabel}的邀请？</p><button disabled={busy} className="secondary" onClick={()=>setConfirm(null)}>保留邀请</button> <button disabled={busy} className="primary" onClick={()=>{void revoke(item.id)}}>确认撤销邀请</button></>:<button disabled={busy} className="secondary" onClick={()=>setConfirm(item.id)}>撤销邀请</button>:<button className="secondary" disabled>接受功能开发中</button>)}</article>)}<button className="secondary" disabled={busy} onClick={()=>{void load()}}>重新读取邀请</button>{cursor&&<button className="secondary" disabled={busy} onClick={()=>{void load(cursor)}}>下一页邀请</button>}</section>;
}
