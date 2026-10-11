import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
import {parseSettingsWrite} from '../apps/server/src/settings-repository.ts';
const id='01234567-1234-1234-1234-012345678901';
const input={expectedVersion:0,settings:{defaultMode:'primary-english',sound:false,fontSize:'大字'}};
test('settings input rejects identity, transport state, unknown modes and invalid versions',()=>{
 assert.deepEqual(parseSettingsWrite(input),input);
 for(const value of [{...input,userId:'victim'},{...input,expectedVersion:-1},{...input,expectedVersion:0.5},{...input,expectedVersion:2147483647},{...input,settings:{...input.settings,device:'connected'}},{...input,settings:{...input.settings,defaultMode:'unknown'}},{...input,settings:{...input.settings,fontSize:{}}}])assert.throws(()=>parseSettingsWrite(value),/INVALID_SETTINGS/);
});
test('settings HTTP binds verified identity and reports permission and version conflicts',async()=>{
 let writes=0;
 const app=createApp({verifyIdentity:async req=>req.headers.authorization==='Bearer test'?{userId:'verified'}:null,
 readSettings:async(user,profile)=>{assert.equal(user,'verified');assert.equal(profile,id);return {profileId:id,version:0,settings:{defaultMode:'rhythm-game',sound:true,fontSize:'标准'}};},
 writeSettings:async(user,profile,value)=>{assert.equal(user,'verified');assert.equal(profile,id);writes++;if(value.expectedVersion!==0)throw new Error('SETTINGS_VERSION_CONFLICT');return {profileId:id,version:1,settings:value.settings};}});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 const address=app.address();assert.ok(address&&typeof address==='object');const url='http://127.0.0.1:'+address.port+'/api/v1/members/'+id+'/settings';
 const send=(body:unknown)=>fetch(url,{method:'PUT',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{authorization:'Bearer test'}})).status,200);
  assert.equal((await send({...input,familyId:'victim'})).status,400);assert.equal(writes,0);
  assert.equal((await send(input)).status,200);
  assert.equal((await send({...input,expectedVersion:1})).status,409);
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
