import type {StateStorage} from './storage.ts';
export type ActiveMember={id:string;familyId:string;displayName:string;ageBand:'child'|'adult'|'senior'};
export function createMemberContext(){
 let snapshot:{userId:string|null;member:ActiveMember|null;revision:number}={userId:null,member:null,revision:0};
 let authorized=new Map<string,ActiveMember>(),controller=new AbortController();
 const listeners=new Set<()=>void>();
 const publish=(userId:string|null,member:ActiveMember|null)=>{
  controller.abort();controller=new AbortController();snapshot={userId,member,revision:snapshot.revision+1};listeners.forEach(listener=>listener());
 };
 return {
  getSnapshot:()=>snapshot,
  getSignal:()=>controller.signal,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)};},
  setSession(userId:string|null,members:ActiveMember[]=[]){
   authorized=new Map(members.map(member=>[member.id,{...member}]));
   if(userId!==snapshot.userId){publish(userId,null);return;}
   if(snapshot.member&&!authorized.has(snapshot.member.id))publish(userId,null);
  },
  select(id:string){
   const member=authorized.get(id);if(!snapshot.userId||!member)throw new Error('MEMBER_NOT_AUTHORIZED');
   if(snapshot.member?.id!==id)publish(snapshot.userId,{...member});
  },
  scopedStorage(storage:StateStorage):StateStorage{
   const prefix=snapshot.userId&&snapshot.member?'kele-member:'+encodeURIComponent(snapshot.userId)+':'+encodeURIComponent(snapshot.member.id)+':':'';
   return {getItem:key=>storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value)};
  }
 };
}
export const memberContext=createMemberContext();
export function currentMemberStorage():StateStorage|undefined{
 return typeof localStorage==='undefined'?undefined:memberContext.scopedStorage(localStorage);
}
