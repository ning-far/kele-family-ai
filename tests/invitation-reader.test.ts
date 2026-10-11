import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInvitationQuery,createInvitationReader} from '../apps/server/src/invitation-reader.ts';
import {createApp} from '../apps/server/src/app.ts';
test('invitation query rejects actor injection, duplicate parameters and malformed cursor',()=>{
 assert.deepEqual(parseInvitationQuery(new URLSearchParams()),{direction:'received'});
 for(const query of ['userId=victim','direction=sent&direction=received','after=fake','direction=all','after=&after='])assert.throws(()=>parseInvitationQuery(new URLSearchParams(query)),/INVALID_INVITATION_QUERY/);
});
test('inbox HTTP refuses unsigned identity and query injection before reads, hides dependency errors',async()=>{
 const id='01234567-1234-1234-1234-012345678901';let reads=0,fail=false;
 const app=createApp({verifyIdentity:async req=>req.headers.authorization==='Bearer test'?{userId:id}:null,listInvitations:async(actor,input)=>{
  reads++;assert.equal(actor,id);assert.equal(input.direction,'received');if(fail)throw new Error('internal database password');return {items:[],nextCursor:null};
 }});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));const address=app.address();assert.ok(address&&typeof address==='object');const url='http://127.0.0.1:'+address.port+'/api/v1/invitations';
 try{
  assert.equal((await fetch(url,{headers:{'x-user-id':id}})).status,401);
  assert.equal((await fetch(url+'?userId=victim',{headers:{authorization:'Bearer test'}})).status,400);assert.equal(reads,0);
  const response=await fetch(url,{headers:{authorization:'Bearer test'}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  fail=true;const unavailable=await fetch(url,{headers:{authorization:'Bearer test'}});assert.equal(unavailable.status,503);assert.ok(!(await unavailable.text()).includes('password'));
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
test('invitation reader binds actor, limits page and releases denied connection',async()=>{
 let released=false,actor='';
 const id='01234567-1234-1234-1234-012345678901';
 const reader=createInvitationReader({connect:async()=>({query:async<T>(sql:string,params?:unknown[])=>{
  if(sql.includes('set_config'))actor=String(params?.[0]);
  if(sql.includes('FROM kele.learning_invitations')){assert.match(sql,/LIMIT 51/);assert.deepEqual(params,[id,null]);return {rows:Array.from({length:51},()=>({id})) as T[]};}
  return {rows:[] as T[]};
 },release:()=>{released=true}})});
 const page=await reader(id,{direction:'received'});assert.equal(actor,id);assert.equal(page.items.length,50);assert.equal(page.nextCursor,id);assert.ok(released);
});
