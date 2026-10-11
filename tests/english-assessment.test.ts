import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecognitionSubmitter,parseRecognitionInput,recognitionQuestions} from '../apps/server/src/english-assessment.ts';
import {createApp} from '../apps/server/src/app.ts';
const id='01234567-1234-1234-1234-012345678901';
test('recognition derives family and completion on server; wrong answers and unauthorized profiles cannot earn points',async()=>{
 let writes=0;
 const submit=createRecognitionSubmitter(async()=>[{id,familyId:id,displayName:'孩子',ageBand:'child'}],async(user,command)=>{
  assert.equal(user,'verified');assert.equal(command.familyId,id);assert.equal(command.skill,'recognize');
  assert.equal(command.contentVersion,'starter-1');assert.match(command.inputHash,/^[a-f0-9]{64}$/);
  writes++;return {attemptId:id,replayed:writes>1};
 });
 const answer={contentId:'apple',contentVersion:'starter-1',choiceId:'apple'};
 assert.deepEqual(await submit('verified',id,id,{...answer,choiceId:'banana'}),{correct:false,recorded:false});
 assert.equal(writes,0);
 await assert.rejects(submit('verified','11234567-1234-1234-1234-012345678901',id,answer),/FORBIDDEN/);
 await assert.rejects(submit('verified',id,id,{...answer,contentVersion:'old'}),/CONTENT_VERSION_CONFLICT/);
 await assert.rejects(submit('verified',id,id,{...answer,choiceId:'invented'}),/INVALID_ANSWER/);
 assert.equal((await submit('verified',id,id,answer)).recorded,true);
 assert.equal((await submit('verified',id,id,answer)).replayed,true);
 assert.equal('answer' in recognitionQuestions().items[0],false);
 for(const key of ['userId','familyId','score','reward','correct'])assert.throws(()=>parseRecognitionInput({...answer,[key]:100}),/INVALID_ANSWER/);
});
test('recognition HTTP refuses injected identity, missing idempotency and missing backend',async()=>{
 let writes=0;
 const app=createApp({verifyIdentity:async req=>req.headers.authorization==='Bearer test'?{userId:'verified'}:null,
 submitRecognition:async(user,profile,operation,input)=>{assert.equal(user,'verified');assert.equal(profile,id);assert.equal(operation,id);assert.equal(input.choiceId,'apple');writes++;return {correct:true,recorded:true};}});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 const address=app.address();assert.ok(address&&typeof address==='object');const base='http://127.0.0.1:'+address.port;
 const url=base+'/api/v1/members/'+id+'/english/recognition';
 const answer={contentId:'apple',contentVersion:'starter-1',choiceId:'apple'};
 const send=(body:unknown,operation:string=id)=>fetch(url,{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json','idempotency-key':operation},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(url,{method:'POST'})).status,401);
  assert.equal((await send({...answer,reward:100})).status,400);
  assert.equal((await send(answer,'')).status,400);assert.equal(writes,0);
  assert.equal((await send(answer)).status,200);assert.equal(writes,1);
  const catalog=await (await fetch(base+'/api/v1/english/recognition')).json();
  assert.equal(catalog.data.items.length,3);assert.equal('answer' in catalog.data.items[0],false);
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
