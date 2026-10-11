import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
import {createInvitationWriter} from '../apps/server/src/invitation-repository.ts';
const id='01234567-1234-1234-1234-012345678901',recipient='11234567-1234-1234-1234-012345678901';
test('invitation HTTP requires identity and exact recipient confirmation without permission injection',async()=>{
 let calls=0,replayed=false;
 const app=createApp({verifyIdentity:async req=>req.headers.authorization==='Bearer test'?{userId:id}:null,createInvitation:async(actor,family,operation,profile,target)=>{
  calls++;assert.equal(actor,id);assert.equal(family,id);assert.equal(operation,id);assert.equal(profile,id);assert.equal(target,recipient);
  return {id,familyId:id,profileId:id,recipientUserId:recipient,expiresAt:'later',status:'pending',replayed};
 }});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));const address=app.address();assert.ok(address&&typeof address==='object');
 const url='http://127.0.0.1:'+address.port+'/api/v1/families/'+id+'/invitations';
 const input={profileId:id,recipientUserId:recipient,confirmedRecipientUserId:recipient};
 const send=(body:unknown,auth=true)=>fetch(url,{method:'POST',headers:{'content-type':'application/json','idempotency-key':id,...(auth?{authorization:'Bearer test'}:{})},body:JSON.stringify(body)});
 try{
  assert.equal((await send(input,false)).status,401);
  for(const body of [{...input,confirmedRecipientUserId:id},{...input,permissions:['conversation.read']},{...input,userId:id},{...input,profileId:'fake'},{...input,recipientUserId:'fake',confirmedRecipientUserId:'fake'},{...input,recipientUserId:id,confirmedRecipientUserId:id}])assert.equal((await send(body)).status,400);
  assert.equal(calls,0);assert.equal((await send(input)).status,201);replayed=true;assert.equal((await send(input)).status,200);
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
test('invitation writer refuses self target and invalid IDs before connecting',async()=>{
 const invite=createInvitationWriter({connect:async()=>{throw new Error('unexpected connection')}});
 await assert.rejects(invite(id,id,id,id,id),/INVALID_INVITATION/);
 await assert.rejects(invite(id,id,'fake',id,recipient),/INVALID_INVITATION/);
});
test('revocation HTTP binds target confirmation and rejects identity injection',async()=>{
 let calls=0;
 const app=createApp({verifyIdentity:async()=>({userId:id}),revokeInvitation:async(actor,target)=>{calls++;assert.equal(actor,id);assert.equal(target,id);return {id,status:'revoked'};}});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));const address=app.address();assert.ok(address&&typeof address==='object');
 const url='http://127.0.0.1:'+address.port+'/api/v1/invitations/'+id+'/revoke';
 const send=(body:unknown)=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 try{
  for(const body of [{confirmedInvitationId:recipient},{confirmedInvitationId:id,userId:recipient}])assert.equal((await send(body)).status,400);
  assert.equal(calls,0);assert.equal((await send({confirmedInvitationId:id})).status,200);
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
