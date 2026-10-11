import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
import {createLearningExporter} from '../apps/server/src/export-repository.ts';
const id='01234567-1234-1234-1234-012345678901';
test('export HTTP requires verified identity and exact confirmation, fails closed and hides failures',async()=>{
 let calls=0,fail='';
 const app=createApp({verifyIdentity:async req=>req.headers.authorization==='Bearer test'?{userId:id}:null,exportLearning:async(user,profile)=>{
  calls++;assert.equal(user,id);assert.equal(profile,id);if(fail)throw new Error(fail);
  return {schemaVersion:1,exportedAt:'now',profile:{id,familyId:id,displayName:'test',ageBand:'child'},progress:{profileId:id,points:0,items:[]},settings:{profileId:id,version:0,settings:{defaultMode:'rhythm-game',sound:true,fontSize:'标准'}}};
 }});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));const address=app.address();assert.ok(address&&typeof address==='object');
 const url='http://127.0.0.1:'+address.port+'/api/v1/members/'+id+'/learning-export';
 const send=(input:unknown,auth=true)=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer test'}:{})},body:JSON.stringify(input)});
 try{
  assert.equal((await send({confirmedProfileId:id},false)).status,401);
  for(const input of [{},{confirmedProfileId:'victim'},{confirmedProfileId:id,userId:'victim'}])assert.equal((await send(input)).status,400);
  assert.equal(calls,0);const response=await send({confirmedProfileId:id});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-disposition')!,/attachment/);
  for(const [code,status] of [['FORBIDDEN',403],['EXPORT_TOO_LARGE',413],['SQL secret connection',503]] as const){fail=code;const response=await send({confirmedProfileId:id});assert.equal(response.status,status);assert.ok(!(await response.text()).includes('secret'));}
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
test('export reader refuses invalid identifiers before connecting',async()=>{
 const reader=createLearningExporter({connect:async()=>{throw new Error('should not connect')}});
 await assert.rejects(reader('fake',id),/INVALID_ID/);
});
test('export above the bound rejects rather than truncating and rolls back/releases',async()=>{
 let rollback=false,released=false;
 const exporter=createLearningExporter({connect:async()=>({query:async<T>(sql:string)=>{
  if(sql==='ROLLBACK')rollback=true;
  return {rows:(sql.includes('FROM kele.member_profiles')?[{id}]:sql.includes('LIMIT 1001')?Array(1001).fill({}):[]) as T[]};
 },release:()=>{released=true}})});
 await assert.rejects(exporter(id,id),/EXPORT_TOO_LARGE/);assert.ok(rollback);assert.ok(released);
});
