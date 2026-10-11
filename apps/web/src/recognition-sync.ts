import {memberContext} from './member-context.ts';
import type {RecognitionInput,RecognitionResult} from '../../server/src/english-assessment.ts';

// Bind retries to the original member and operation. Never retarget a queued
// answer when a family changes its currently selected member.
export function prepareRecognitionSync(input:RecognitionInput,context=memberContext,send:typeof fetch=fetch){
 const snapshot=context.getSnapshot(),signal=context.getSignal();
 if(!snapshot.userId||!snapshot.member)throw new Error('MEMBER_REQUIRED');
 const operationId=crypto.randomUUID();
 const body=JSON.stringify(input);
 const url='/api/v1/members/'+encodeURIComponent(snapshot.member.id)+'/english/recognition';
 return async():Promise<RecognitionResult>=>{
  if(signal.aborted||context.getSnapshot().revision!==snapshot.revision)throw new Error('MEMBER_CHANGED');
  const response=await send(url,{method:'POST',credentials:'same-origin',signal,headers:{'content-type':'application/json','idempotency-key':operationId},body});
  if(signal.aborted||context.getSnapshot().revision!==snapshot.revision)throw new Error('MEMBER_CHANGED');
  if(!response.ok)throw new Error(response.status===401?'LOGIN_REQUIRED':response.status===403?'PROFILE_FORBIDDEN':response.status===409?'ANSWER_CONFLICT':'SYNC_UNAVAILABLE');
  const payload=await response.json();
  if(signal.aborted||context.getSnapshot().revision!==snapshot.revision)throw new Error('MEMBER_CHANGED');
  const result=payload.data;
  if(!result||typeof result.correct!=='boolean'||typeof result.recorded!=='boolean'||result.recorded!==result.correct||(result.recorded&&(typeof result.attemptId!=='string'||typeof result.replayed!=='boolean')))throw new Error('INVALID_SYNC_RESPONSE');
  return result;
 };
}
