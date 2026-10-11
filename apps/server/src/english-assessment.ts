import {createHash} from 'node:crypto';
import type {AttemptCommand,AttemptResult} from './attempt-repository.ts';
import type {ProfileReader} from './app.ts';

// Small versioned starter catalog, not the complete primary-school curriculum.
const catalog=[
 {id:'apple',word:'apple',choices:[{id:'apple',label:'苹果'},{id:'banana',label:'香蕉'},{id:'cat',label:'猫'}],answer:'apple'},
 {id:'banana',word:'banana',choices:[{id:'cat',label:'猫'},{id:'apple',label:'苹果'},{id:'banana',label:'香蕉'}],answer:'banana'},
 {id:'cat',word:'cat',choices:[{id:'banana',label:'香蕉'},{id:'cat',label:'猫'},{id:'apple',label:'苹果'}],answer:'cat'},
] as const;
export const recognitionVersion='starter-1';
export function recognitionQuestions(){return {version:recognitionVersion,items:catalog.map(({answer,...question})=>question)};}
export type RecognitionInput={contentId:string;contentVersion:string;choiceId:string};
export function parseRecognitionInput(input:unknown):RecognitionInput{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_ANSWER');
 const value=input as Record<string,unknown>;
 if(Object.keys(value).length!==3||!['contentId','contentVersion','choiceId'].every(key=>typeof value[key]==='string'&&value[key].length>0&&value[key].length<=80))throw new Error('INVALID_ANSWER');
 return value as RecognitionInput;
}
export type RecognitionResult={correct:boolean;recorded:boolean;attemptId?:string;replayed?:boolean};
export function createRecognitionSubmitter(readProfiles:ProfileReader,writeAttempt:(userId:string,command:AttemptCommand)=>Promise<AttemptResult>){
 return async(userId:string,profileId:string,operationId:string,input:RecognitionInput):Promise<RecognitionResult>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(profileId)||!uuid.test(operationId))throw new Error('INVALID_ID');
  // Family identity is server-derived; clients cannot nominate a family or reward.
  const profile=(await readProfiles(userId)).find(item=>item.id===profileId);
  if(!profile)throw new Error('FORBIDDEN');
  if(input.contentVersion!==recognitionVersion)throw new Error('CONTENT_VERSION_CONFLICT');
  const question=catalog.find(item=>item.id===input.contentId);
  if(!question||!question.choices.some(choice=>choice.id===input.choiceId))throw new Error('INVALID_ANSWER');
  if(input.choiceId!==question.answer)return {correct:false,recorded:false};
  const inputHash=createHash('sha256').update(JSON.stringify([input.contentVersion,input.contentId,input.choiceId])).digest('hex');
  const result=await writeAttempt(userId,{familyId:profile.familyId,memberId:profileId,operationId,activityId:'english-recognize',contentVersion:recognitionVersion,inputHash,contentId:question.id,skill:'recognize'});
  return {correct:true,recorded:true,...result};
 };
}
