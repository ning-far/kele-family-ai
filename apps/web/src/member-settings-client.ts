import {memberContext} from './member-context.ts';
import type {MemberSettings,SettingsSnapshot} from '../../server/src/settings-repository.ts';
type State={status:'idle'|'loading'|'ready'|'saving'|'conflict'|'error';snapshot:SettingsSnapshot|null;message:string};
const modeIds=['rhythm-game','primary-english','idiom-chain','voice-input-bridge','companion-chat','creator-studio'];
export function createMemberSettingsClient(context=memberContext,send:typeof fetch=fetch){
 let state:State={status:'idle',snapshot:null,message:''},revision=context.getSnapshot().revision,epoch=0,controller:AbortController|null=null;
 const listeners=new Set<()=>void>();
 const publish=(next:State)=>{state=next;listeners.forEach(listener=>listener());};
 const reset=()=>{controller?.abort();epoch++;revision=context.getSnapshot().revision;publish({status:'idle',snapshot:null,message:''});};
 context.subscribe(reset);
 const adopt=(value:SettingsSnapshot)=>{
  const current=context.getSnapshot();
  if(current.revision!==revision||!current.member||value?.profileId!==current.member.id||!Number.isSafeInteger(value.version)||value.version<0||!value.settings||!modeIds.includes(value.settings.defaultMode)||typeof value.settings.sound!=='boolean'||!['标准','大字','特大'].includes(value.settings.fontSize))throw new Error('INVALID_SETTINGS_RESPONSE');
  if(state.snapshot&&value.version<state.snapshot.version)throw new Error('STALE_SETTINGS_RESPONSE');
  publish({status:'ready',snapshot:{...value,settings:{...value.settings}},message:''});
 };
 const request=async(patch?:Partial<MemberSettings>)=>{
  const current=context.getSnapshot();if(!current.userId||!current.member)throw new Error('MEMBER_REQUIRED');
  const prior=state.snapshot;
  if(patch&&(state.status!=='ready'||!prior))throw new Error('SETTINGS_NOT_READY');
  const settings=patch?{...prior!.settings,...patch}:undefined;
  if(settings&&(Object.keys(settings).length!==3||!modeIds.includes(settings.defaultMode)||typeof settings.sound!=='boolean'||!['标准','大字','特大'].includes(settings.fontSize)))throw new Error('INVALID_SETTINGS');
  controller?.abort();controller=new AbortController();const active=controller,token=++epoch;
  const changed=context.getSignal(),abort=()=>active.abort();changed.addEventListener('abort',abort,{once:true});
  publish({status:patch?'saving':'loading',snapshot:patch?prior:null,message:patch?'正在保存成员设置…':'正在读取成员设置…'});
  try{
   const response=await send('/api/v1/members/'+encodeURIComponent(current.member.id)+'/settings',{method:patch?'PUT':'GET',credentials:'same-origin',signal:active.signal,...(patch?{headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:prior!.version,settings})}:{})});
   if(active.signal.aborted||token!==epoch||current.revision!==context.getSnapshot().revision)throw new Error('MEMBER_CHANGED');
   if(!response.ok)throw new Error(response.status===409?'SETTINGS_VERSION_CONFLICT':response.status===401?'LOGIN_REQUIRED':response.status===403?'PROFILE_FORBIDDEN':'SETTINGS_UNAVAILABLE');
   const body=await response.json();
   if(active.signal.aborted||token!==epoch||current.revision!==context.getSnapshot().revision)throw new Error('MEMBER_CHANGED');
   adopt(body.data);return state.snapshot!;
  }catch(error){
   if(active.signal.aborted||token!==epoch||current.revision!==context.getSnapshot().revision)throw new Error('MEMBER_CHANGED');
   const code=error instanceof Error?error.message:'';
   if(code==='STALE_SETTINGS_RESPONSE')throw error;
   publish({status:code==='SETTINGS_VERSION_CONFLICT'?'conflict':'error',snapshot:code==='SETTINGS_VERSION_CONFLICT'?prior:null,message:code==='SETTINGS_VERSION_CONFLICT'?'成员设置已在其他页面更新，请到我的页面重新加载后再保存。':'成员设置暂未同步，请到我的页面重试。'});
   throw error;
  }finally{changed.removeEventListener('abort',abort);}
 };
 return {getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)};},load:()=>request(),update:(patch:Partial<MemberSettings>)=>request(patch),adopt};
}
export const memberSettingsClient=createMemberSettingsClient();
