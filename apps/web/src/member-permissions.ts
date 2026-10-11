import {memberContext} from './member-context.ts';
import type {ProfilePermission} from '../../server/src/authorization.ts';
type State={status:'idle'|'loading'|'ready'|'error';permissions:ProfilePermission[];message:string};
const allowed=['profile.use','progress.read','progress.write','settings.write','conversation.read','conversation.delete'];
export function createMemberPermissions(context=memberContext,send:typeof fetch=fetch){
 let state:State={status:'idle',permissions:[],message:''},epoch=0,controller:AbortController|null=null;
 const listeners=new Set<()=>void>(),publish=(next:State)=>{state=next;listeners.forEach(listener=>listener())};
 context.subscribe(()=>{controller?.abort();epoch++;publish({status:'idle',permissions:[],message:''})});
 const load=async()=>{
  const current=context.getSnapshot();if(!current.member)throw new Error('MEMBER_REQUIRED');
  controller?.abort();const active=new AbortController();controller=active;const token=++epoch;
  publish({status:'loading',permissions:[],message:'正在核实成员权限…'});
  try{
   const response=await send('/api/v1/members/'+current.member.id+'/permissions',{credentials:'same-origin',signal:active.signal});
   if(!response.ok)throw new Error(response.status===403?'PROFILE_FORBIDDEN':'PERMISSIONS_UNAVAILABLE');
   const data=(await response.json()).data;
   if(active.signal.aborted||token!==epoch||context.getSnapshot().revision!==current.revision)throw new Error('MEMBER_CHANGED');
   if(data?.profileId!==current.member.id||!Array.isArray(data.permissions)||!data.permissions.includes('profile.use')||data.permissions.some((value:unknown)=>typeof value!=='string'||!allowed.includes(value)))throw new Error('INVALID_PERMISSIONS');
   publish({status:'ready',permissions:[...new Set<ProfilePermission>(data.permissions)],message:''});
  }catch(error){
   if(active.signal.aborted||token!==epoch||context.getSnapshot().revision!==current.revision)throw new Error('MEMBER_CHANGED');
   publish({status:'error',permissions:[],message:'权限暂未核实，请到我的页面重新检查。'});throw error;
  }
 };
 return {load,getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}},has:(permission:ProfilePermission)=>state.status==='ready'&&state.permissions.includes(permission)};
}
export const memberPermissions=createMemberPermissions();
