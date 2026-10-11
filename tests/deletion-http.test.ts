import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
const id='01234567-1234-1234-1234-012345678901';
test('profile deletion requires target-bound confirmation and idempotency; job reads use verified actor',async()=>{
 let writes=0;
 const app=createApp({verifyIdentity:async req=>req.headers.authorization==='Bearer test'?{userId:'verified'}:null,
 deleteProfile:async(user,profile,operation)=>{assert.equal(user,'verified');assert.equal(profile,id);assert.equal(operation,id);writes++;return {id,profileId:id,status:'pending',requestedAt:new Date().toISOString()}},
 readDeletion:async(user,job)=>{assert.equal(user,'verified');assert.equal(job,id);return null}});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 const address=app.address();assert.ok(address&&typeof address==='object');const base='http://127.0.0.1:'+address.port;
 try{
  const path=base+'/api/v1/members/'+id;
  assert.equal((await fetch(path,{method:'DELETE'})).status,401);
  for(const body of [{},{confirmProfileId:'wrong'},{confirmProfileId:id,userId:'victim'}]){
   assert.equal((await fetch(path,{method:'DELETE',headers:{authorization:'Bearer test','content-type':'application/json','idempotency-key':id},body:JSON.stringify(body)})).status,400);
  }
  assert.equal(writes,0);
  assert.equal((await fetch(path,{method:'DELETE',headers:{authorization:'Bearer test','content-type':'application/json','idempotency-key':id},body:JSON.stringify({confirmProfileId:id})})).status,202);
  assert.equal(writes,1);
  assert.equal((await fetch(base+'/api/v1/deletion-jobs/'+id,{headers:{authorization:'Bearer test','x-user-id':'victim'}})).status,404);
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
