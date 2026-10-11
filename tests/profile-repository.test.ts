import assert from 'node:assert/strict';
import test from 'node:test';
import {createProfileReader,type DatabaseConnection} from '../apps/server/src/profile-repository.ts';
test('profile reader scopes identity to transaction and releases on query failure',async()=>{
 const calls:string[]=[];let released=false;
 const connection:DatabaseConnection={query:async(sql)=>{calls.push(sql);if(sql.includes('FROM kele.member_profiles'))throw new Error('database-error');return {rows:[]}},release:()=>{released=true}};
 const reader=createProfileReader({connect:async()=>connection});
 await assert.rejects(()=>reader('01234567-1234-1234-1234-012345678901'),/database-error/);
 assert.equal(calls[0],'BEGIN');assert.ok(calls[1].includes('set_config'));assert.equal(calls.at(-1),'ROLLBACK');assert.equal(released,true);
 await assert.rejects(()=>reader("';drop table users;--"),/INVALID_VERIFIED_USER_ID/);
});
test('profile reader commits authorized rows and passes actor as bound parameter',async()=>{
 const statements:{sql:string;params?:unknown[]}[]=[];let released=false;
 const rows=[{id:'p1',familyId:'f1',displayName:'孩子',ageBand:'child' as const}];
 const connection:DatabaseConnection={query:async<T>(sql:string,params?:unknown[])=>{statements.push({sql,params});return {rows:(sql.includes('FROM kele.member_profiles')?rows:[]) as T[]}},release:()=>{released=true}};
 const reader=createProfileReader({connect:async()=>connection});
 const userId='01234567-1234-1234-1234-012345678901';
 assert.deepEqual(await reader(userId),rows);
 assert.deepEqual(statements[1].params,[userId]);
 assert.equal(statements[2].params,undefined);
 assert.ok(statements[2].sql.includes('kele.has_profile_permission'));
 assert.equal(statements[2].sql.includes(userId),false);
 assert.equal(statements.at(-1)?.sql,'COMMIT');
 assert.equal(released,true);
});
