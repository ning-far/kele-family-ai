import assert from 'node:assert/strict';
import test from 'node:test';
import {createAttemptWriter,type AttemptCommand} from '../apps/server/src/attempt-repository.ts';
import type {DatabaseConnection} from '../apps/server/src/profile-repository.ts';
const id='01234567-1234-1234-1234-012345678901';
const command:AttemptCommand={familyId:id,memberId:id,operationId:id,activityId:'word',contentVersion:'1',inputHash:'abc',contentId:'apple',skill:'recognize'};
test('attempt replay does not repeat progress or rewards and rejects changed content',async()=>{
 const sqls:string[]=[];let hash='abc';
 const connection:DatabaseConnection={query:async<T>(sql:string)=>{sqls.push(sql);let rows:unknown[]=[];if(sql.includes('SELECT 1 FROM kele.profile_grants'))rows=[{ok:1}];if(sql.includes('SELECT id,input_hash'))rows=[{id,input_hash:hash,activity_id:'word',content_version:'1',content_id:'apple',skill:'recognize'}];return {rows:rows as T[]}},release:()=>{}};
 const writer=createAttemptWriter({connect:async()=>connection});
 assert.equal((await writer(id,command)).replayed,true);
 assert.equal(sqls.some(sql=>sql.includes('INSERT INTO kele.reward_ledger')),false);
 assert.equal(sqls.some(sql=>sql.includes('INSERT INTO kele.learning_progress')),false);
 hash='changed';await assert.rejects(()=>writer(id,command),/IDEMPOTENCY_CONFLICT/);
 assert.equal(sqls.at(-1),'ROLLBACK');
});
