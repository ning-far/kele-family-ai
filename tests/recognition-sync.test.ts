import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRecognitionSync} from '../apps/web/src/recognition-sync.ts';
import {createMemberContext} from '../apps/web/src/member-context.ts';
const answer={contentId:'apple',contentVersion:'starter-1',choiceId:'apple'};
const member={id:'child',familyId:'family',displayName:'孩子',ageBand:'child' as const};
test('recognition sync retries retain the operation and original member, then stop on member changes',async()=>{
 const context=createMemberContext();
 assert.throws(()=>prepareRecognitionSync(answer,context),/MEMBER_REQUIRED/);
 context.setSession('user',[member,{...member,id:'senior',ageBand:'senior'}]);context.select('child');
 const requests:RequestInit[]=[];
 const send:typeof fetch=async(url,init)=>{
  assert.equal(url,'/api/v1/members/child/english/recognition');requests.push(init!);
  return requests.length===1?new Response('',{status:503}):Response.json({data:{correct:true,recorded:true,attemptId:'attempt',replayed:true}});
 };
 const retry=prepareRecognitionSync(answer,context,send);
 await assert.rejects(retry(),/SYNC_UNAVAILABLE/);assert.equal((await retry()).replayed,true);
 assert.equal(new Headers(requests[0].headers).get('idempotency-key'),new Headers(requests[1].headers).get('idempotency-key'));
 context.select('senior');await assert.rejects(retry(),/MEMBER_CHANGED/);assert.equal(requests.length,2);
});
test('late recognition replies cannot be shown for a newly selected member',async()=>{
 const context=createMemberContext();context.setSession('user',[member,{...member,id:'other'}]);context.select('child');
 const send:typeof fetch=async()=>{context.select('other');return Response.json({data:{correct:true,recorded:true,attemptId:'attempt',replayed:false}});};
 await assert.rejects(prepareRecognitionSync(answer,context,send)(),/MEMBER_CHANGED/);
});
