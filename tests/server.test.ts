import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
test('HTTP scaffold reports honest capability and rejects unsupported writes',async()=>{
 const app=createApp();await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 const address=app.address();assert.ok(address&&typeof address==='object');const url='http://127.0.0.1:'+address.port;
 try{
 const health=await fetch(url+'/healthz');assert.equal(health.status,200);assert.equal((await health.json()).data.database,'not-configured');
 const readiness=await fetch(url+'/readyz');assert.equal(readiness.status,503);assert.equal((await readiness.json()).data.ready,false);
 const list=await fetch(url+'/api/v1/modes');assert.equal((await list.json()).data.length,6);assert.equal(list.headers.get('cache-control'),'no-store');
 const write=await fetch(url+'/api/v1/agent/runs',{method:'POST',body:'{}'});assert.equal(write.status,404);assert.equal((await write.json()).error.retryable,false);
 }finally{await new Promise<void>((resolve,reject)=>app.close(e=>e?reject(e):resolve()));}
});
test('session refuses client identity headers and fails closed when verification fails',async()=>{
 const app=createApp({verifyIdentity:async req=>req.headers.authorization==='Bearer verified-test'?{userId:'trusted-user'}:null});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 const address=app.address();assert.ok(address&&typeof address==='object');const url='http://127.0.0.1:'+address.port;
 try{
  const spoof=await fetch(url+'/api/v1/session',{headers:{'x-user-id':'trusted-user'}});assert.equal(spoof.status,401);
  const verified=await fetch(url+'/api/v1/session',{headers:{authorization:'Bearer verified-test'}});assert.equal(verified.status,200);assert.equal((await verified.json()).data.userId,'trusted-user');
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
test('profiles use verified identity and never accept user query injection',async()=>{
 let requestedUser='';
 const app=createApp({verifyIdentity:async()=>({userId:'verified-user'}),listAuthorizedProfiles:async userId=>{requestedUser=userId;return [{id:'p1',familyId:'f1',displayName:'孩子',ageBand:'child'}]}});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 const address=app.address();assert.ok(address&&typeof address==='object');
 try{
  const response=await fetch('http://127.0.0.1:'+address.port+'/api/v1/profiles?userId=another-user');
  assert.equal(response.status,200);assert.equal(requestedUser,'verified-user');assert.equal((await response.json()).data[0].id,'p1');
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
test('family creation rejects identity injection and oversized input before writes',async()=>{
 let writes=0;
 const app=createApp({verifyIdentity:async()=>({userId:'verified-user'}),createFamily:async(userId,name)=>{assert.equal(userId,'verified-user');writes++;return {familyId:'f1',profileId:'p1',name}}});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 const address=app.address();assert.ok(address&&typeof address==='object');const url='http://127.0.0.1:'+address.port+'/api/v1/families';
 try{
  for(const payload of [{name:'家庭',userId:'victim'},{name:' '},{name:'x'.repeat(9000)}]){
   const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});assert.equal(response.status,400);
  }
  assert.equal(writes,0);
  const valid=await fetch(url,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'01234567-1234-1234-1234-012345678901'},body:JSON.stringify({name:' 我的家庭 '})});
  assert.equal(valid.status,201);assert.equal((await valid.json()).data.name,'我的家庭');assert.equal(writes,1);
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
