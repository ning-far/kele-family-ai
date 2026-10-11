import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
const id='01234567-1234-1234-1234-012345678901';
test('acceptance HTTP binds trusted identity and exact confirmation; invalid writes never reach the dependency',async()=>{
 let calls=0,failure='',signed=true;
 const app=createApp({verifyIdentity:async()=>signed?{userId:id}:null,acceptInvitation:async(actor,target)=>{
  calls++;assert.equal(actor,id);assert.equal(target,id);if(failure)throw new Error(failure);
  return {id,profileId:id,status:'accepted',replayed:calls>1};
 }});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));const address=app.address();assert.ok(address&&typeof address==='object');
 const url='http://127.0.0.1:'+address.port+'/api/v1/invitations/'+id+'/accept';
 const send=(body:unknown)=>fetch(url,{method:'POST',headers:{'content-type':'application/json','x-user-id':id},body:JSON.stringify(body)});
 try{
  signed=false;assert.equal((await send({confirmedInvitationId:id})).status,401);signed=true;
  for(const body of [{},{confirmedInvitationId:'other'},{confirmedInvitationId:id,userId:id},{confirmedInvitationId:id,permissions:['settings.write']},null,[]])assert.equal((await send(body)).status,400);
  assert.equal(calls,0);
  const accepted=await send({confirmedInvitationId:id});assert.equal(accepted.status,200);assert.equal(accepted.headers.get('cache-control'),'no-store');assert.equal((await accepted.json()).data.status,'accepted');
  assert.equal((await (await send({confirmedInvitationId:id})).json()).data.replayed,true);
  for(const [code,status] of [['FORBIDDEN',403],['INVITATION_EXPIRED',410],['INVITATION_REVOKED',410],['private database password',503]] as const){
   failure=code;const response=await send({confirmedInvitationId:id});assert.equal(response.status,status);if(status===503)assert.equal((await response.text()).includes(code),false);
  }
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
test('acceptance fails closed when database dependency is absent',async()=>{
 const app=createApp({verifyIdentity:async()=>({userId:id})});await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));const address=app.address();assert.ok(address&&typeof address==='object');
 try{assert.equal((await fetch('http://127.0.0.1:'+address.port+'/api/v1/invitations/'+id+'/accept',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmedInvitationId:id})})).status,503);}
 finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
