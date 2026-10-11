import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
import {createPermissionReader} from '../apps/server/src/permission-repository.ts';
const id='01234567-1234-1234-1234-012345678901';
test('permission HTTP trusts verifier only and hides internal failure',async()=>{
 let calls=0,fail='';
 const app=createApp({verifyIdentity:async req=>req.headers.authorization==='Bearer test'?{userId:id}:null,readPermissions:async(user,profile)=>{
  calls++;assert.equal(user,id);assert.equal(profile,id);if(fail)throw new Error(fail);return {profileId:id,permissions:['profile.use']};
 }});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));const address=app.address();assert.ok(address&&typeof address==='object');
 const url='http://127.0.0.1:'+address.port+'/api/v1/members/'+id+'/permissions';
 try{
  assert.equal((await fetch(url,{headers:{'x-user-id':id}})).status,401);assert.equal(calls,0);
  const response=await fetch(url+'?userId=victim',{headers:{authorization:'Bearer test','x-user-id':'victim'}});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual((await response.json()).data.permissions,['profile.use']);
  for(const [code,status] of [['FORBIDDEN',403],['internal secret',503]] as const){fail=code;const response=await fetch(url,{headers:{authorization:'Bearer test'}});assert.equal(response.status,status);assert.ok(!(await response.text()).includes('secret'));}
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
test('permission reader rejects invalid identity and releases after denied transaction',async()=>{
 let rollback=false,released=false;
 const read=createPermissionReader({connect:async()=>({query:async()=>({rows:[]}),release:()=>{released=true}})});
 await assert.rejects(read('fake',id),/INVALID_ID/);assert.equal(released,false);
 const denied=createPermissionReader({connect:async()=>({query:async sql=>{if(sql==='ROLLBACK')rollback=true;return {rows:[]}},release:()=>{released=true}})});
 await assert.rejects(denied(id,id),/FORBIDDEN/);assert.ok(rollback&&released);
});
