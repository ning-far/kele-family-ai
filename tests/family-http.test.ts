import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
const operation='01234567-1234-1234-1234-012345678901';
test('family HTTP requires retry key, returns replay and maps conflicts without leaking internal errors',async()=>{
 let writes=0;
 const app=createApp({verifyIdentity:async()=>({userId:'verified'}),createFamily:async(user,name,key)=>{
  assert.equal(user,'verified');assert.equal(key,operation);writes++;
  if(name==='changed')throw new Error('IDEMPOTENCY_CONFLICT');
  if(name==='gone')throw new Error('FAMILY_UNAVAILABLE_FOR_REPLAY');
  return {familyId:'family',profileId:'profile',name,replayed:writes>1};
 }});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 const address=app.address();assert.ok(address&&typeof address==='object');const url='http://127.0.0.1:'+address.port+'/api/v1/families';
 const send=(name:string,key:string=operation)=>fetch(url,{method:'POST',headers:{'content-type':'application/json','idempotency-key':key},body:JSON.stringify({name})});
 try{
  assert.equal((await send('family','')).status,400);assert.equal(writes,0);
  assert.equal((await send('family')).status,201);
  assert.equal((await send('family')).status,200);
  assert.equal((await send('changed')).status,409);
  assert.equal((await send('gone')).status,410);
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
