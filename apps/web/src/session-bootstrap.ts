import {memberContext,type ActiveMember} from './member-context.ts';
import type {StateStorage} from './storage.ts';
const key='kele-active-member';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result={userId:string;profiles:ActiveMember[]}|null;
type State={status:'idle'|'loading'|'ready'|'guest'|'error';message:string};
export function createSessionBootstrap(context=memberContext,storage?:StateStorage,send:typeof fetch=fetch){
 let state:State={status:'idle',message:''},pending:Promise<Result>|null=null,controller:AbortController|null=null,applying=false,storageFailed=false;
 const listeners=new Set<()=>void>();
 const publish=(next:State)=>{state=next;listeners.forEach(listener=>listener());};
 const readHint=()=>{
  try{const value=JSON.parse(storage?.getItem(key)||'null');return value&&uuid.test(value.userId)&&uuid.test(value.profileId)?value as {userId:string;profileId:string}:null;}
  catch{return null;}
 };
 const persist=()=>{
  const current=context.getSnapshot();
  try{storage?.setItem(key,current.userId&&current.member?JSON.stringify({userId:current.userId,profileId:current.member.id}):'');}
  catch{storageFailed=true;}
 };
 context.subscribe(()=>{persist();if(!applying)controller?.abort();});
 const load=():Promise<Result>=>{
  if(pending)return pending;
  const hint=readHint(),revision=context.getSnapshot().revision,active=new AbortController();controller=active;
  publish({status:'loading',message:'正在核实登录与成员权限…'});
  pending=(async()=>{
   try{
    const response=await send('/api/v1/profiles',{credentials:'same-origin',signal:active.signal});
    if(active.signal.aborted||revision!==context.getSnapshot().revision)throw new Error('MEMBER_CHANGED');
    if(response.status===401){applying=true;try{context.setSession(null);persist();}finally{applying=false;}publish({status:'guest',message:''});return null;}
    if(!response.ok)throw new Error('SESSION_UNAVAILABLE');
    const body=await response.json();
    if(!uuid.test(body.userId)||!Array.isArray(body.data)||!body.data.every((p:ActiveMember)=>p&&uuid.test(p.id)&&uuid.test(p.familyId)&&typeof p.displayName==='string'&&p.displayName.length>0&&['child','adult','senior'].includes(p.ageBand)))throw new Error('INVALID_SESSION_RESPONSE');
    const session=await send('/api/v1/session',{credentials:'same-origin',signal:active.signal});
    if(active.signal.aborted||revision!==context.getSnapshot().revision)throw new Error('MEMBER_CHANGED');
    if(session.status===401){applying=true;try{context.setSession(null);persist();}finally{applying=false;}publish({status:'guest',message:''});return null;}
    if(!session.ok)throw new Error('SESSION_UNAVAILABLE');
    const identity=await session.json();
    if(identity.data?.userId!==body.userId)throw new Error('IDENTITY_CHANGED');
    if(active.signal.aborted||revision!==context.getSnapshot().revision)throw new Error('MEMBER_CHANGED');
    applying=true;
    try{
     context.setSession(body.userId,body.data);
     if(!context.getSnapshot().member&&hint&&hint.userId===body.userId&&body.data.some((p:ActiveMember)=>p.id===hint.profileId))context.select(hint.profileId);
     persist();
    }finally{applying=false;}
    publish({status:'ready',message:storageFailed?'当前成员可使用，但本机无法保存选择，刷新后需重新选择。':''});
    return {userId:body.userId,profiles:body.data};
   }catch(error){
    if(active.signal.aborted||revision!==context.getSnapshot().revision){publish({status:'idle',message:''});throw new Error('MEMBER_CHANGED');}
    publish({status:'error',message:'登录与成员恢复暂未完成，请到家庭页面重试。本机访客功能仍可使用。'});throw error;
   }finally{pending=null;controller=null;}
  })();
  return pending;
 };
 return {load,getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)};}};
}
let browserStorage:StateStorage|undefined;
try{if(typeof sessionStorage!=='undefined')browserStorage=sessionStorage;}catch{/* No persisted hint is trusted or required. */}
export const sessionBootstrap=createSessionBootstrap(memberContext,browserStorage);
