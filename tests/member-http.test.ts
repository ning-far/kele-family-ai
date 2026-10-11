import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
const id='01234567-1234-1234-1234-012345678901';
test('member creation rejects owner/role injection and delegates only verified identity',async()=>{
 let writes=0;
 const app=createApp({verifyIdentity:async req=>req.headers.authorization==='Bearer test'?{userId:'verified'}:null,
 createMember:async(user,family,operation,input)=>{assert.equal(user,'verified');assert.equal(family,id);assert.equal(operation,id);writes++;return {profile:{id,familyId:family,displayName:input.displayName,ageBand:input.ageBand},replayed:writes>1}}});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 const address=app.address();assert.ok(address&&typeof address==='object');const url='http://127.0.0.1:'+address.port+'/api/v1/families/'+id+'/members';
 const send=(body:unknown)=>fetch(url,{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json','idempotency-key':id},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(url,{method:'POST'})).status,401);
  for(const body of [{displayName:'孩子',ageBand:'child',ownerUserId:'victim'},{displayName:'孩子',ageBand:'child',role:'admin'},{displayName:' ',ageBand:'child'},{displayName:'孩子',ageBand:'unknown'}])assert.equal((await send(body)).status,400);
  assert.equal(writes,0);
  assert.equal((await send({displayName:'孩子',ageBand:'child'})).status,201);
  assert.equal((await send({displayName:'孩子',ageBand:'child'})).status,200);
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
