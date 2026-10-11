import assert from 'node:assert/strict';
import test from 'node:test';
import {createFamilyWriter} from '../apps/server/src/family-repository.ts';
import type {DatabaseConnection} from '../apps/server/src/profile-repository.ts';
test('family creation validates before connection and rolls back incomplete ownership',async()=>{
 const calls:string[]=[];let released=false;
 const connection:DatabaseConnection={query:async sql=>{calls.push(sql);if(sql.includes('INSERT INTO kele.member_profiles'))throw new Error('profile-failure');return {rows:[]}},release:()=>{released=true}};
 const writer=createFamilyWriter({connect:async()=>connection});
 await assert.rejects(()=>writer('01234567-1234-1234-1234-012345678901','   '),/INVALID_FAMILY_NAME/);assert.equal(calls.length,0);
 await assert.rejects(()=>writer('01234567-1234-1234-1234-012345678901','我的家庭'),/profile-failure/);
 assert.equal(calls.at(-1),'ROLLBACK');assert.equal(calls.includes('COMMIT'),false);assert.equal(released,true);
});
