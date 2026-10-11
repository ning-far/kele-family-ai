import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberContext} from '../apps/web/src/member-context.ts';
import {createSessionBootstrap} from '../apps/web/src/session-bootstrap.ts';
const user='01234567-1234-1234-1234-012345678901',other='11234567-1234-1234-1234-012345678901',profile='21234567-1234-1234-1234-012345678901';
const child={id:profile,familyId:other,displayName:'孩子',ageBand:'child' as const};
function store(hint:unknown){let value=JSON.stringify(hint);return {getItem:()=>value,setItem:(_key:string,next:string)=>{value=next;}};}
const verified:typeof fetch=async url=>Response.json(String(url).endsWith('/profiles')?{userId:user,data:[child]}:{data:{userId:user}});
test('refresh restores only verified authorized selection and deduplicates startup requests',async()=>{
 const context=createMemberContext(),storage=store({userId:user,profileId:profile});let requests=0;
 const bootstrap=createSessionBootstrap(context,storage,async(...args)=>{requests++;return verified(...args);});
 const first=bootstrap.load();assert.equal(bootstrap.load(),first);assert.equal(context.getSnapshot().member,null);
 await first;assert.equal(requests,2);assert.equal(context.getSnapshot().member?.id,profile);
 context.setSession(null);assert.equal(storage.getItem(),'');
});
test('different account, revoked profile or forged hint never restores a selection',async()=>{
 for(const hint of [{userId:other,profileId:profile},{userId:user,profileId:other},{userId:user,profileId:'forged'}]){
  const context=createMemberContext(),storage=store(hint),bootstrap=createSessionBootstrap(context,storage,verified);
  await bootstrap.load();assert.equal(context.getSnapshot().userId,user);assert.equal(context.getSnapshot().member,null);assert.equal(storage.getItem(),'');
 }
});
test('expired or mismatched identity cannot use a saved hint; transport failure remains retryable',async()=>{
 const context=createMemberContext(),storage=store({userId:user,profileId:profile});
 await createSessionBootstrap(context,storage,async()=>new Response('',{status:401})).load();assert.equal(context.getSnapshot().member,null);assert.equal(storage.getItem(),'');
 const mismatch=createSessionBootstrap(createMemberContext(),store({userId:user,profileId:profile}),async url=>Response.json(String(url).endsWith('/profiles')?{userId:user,data:[child]}:{data:{userId:other}}));
 await assert.rejects(mismatch.load(),/IDENTITY_CHANGED/);assert.equal(mismatch.getSnapshot().status,'error');
 let fail=true;const retryContext=createMemberContext(),retry=createSessionBootstrap(retryContext,store({userId:user,profileId:profile}),async(...args)=>{if(fail)throw new Error('offline');return verified(...args);});
 await assert.rejects(retry.load(),/offline/);assert.equal(retryContext.getSnapshot().member,null);fail=false;await retry.load();assert.equal(retryContext.getSnapshot().member?.id,profile);
});

test('late expired response cannot erase a newer member selection',async()=>{
 const context=createMemberContext();context.setSession(user,[child]);
 let finish!:(response:Response)=>void;
 const bootstrap=createSessionBootstrap(context,store(null),()=>new Promise<Response>(resolve=>{finish=resolve;}));
 const pending=bootstrap.load();context.select(profile);finish(new Response('',{status:401}));
 await assert.rejects(pending,/MEMBER_CHANGED/);assert.equal(context.getSnapshot().member?.id,profile);
});

test('blocked hint storage does not prevent verified use and reports persistence limitation',async()=>{
 const context=createMemberContext();
 const bootstrap=createSessionBootstrap(context,{getItem:()=>{throw new Error('blocked')},setItem:()=>{throw new Error('blocked')}},verified);
 await bootstrap.load();assert.equal(context.getSnapshot().userId,user);assert.equal(context.getSnapshot().member,null);
 assert.match(bootstrap.getSnapshot().message,/刷新后需重新选择/);
});
