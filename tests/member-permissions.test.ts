import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberContext} from '../apps/web/src/member-context.ts';
import {createMemberPermissions} from '../apps/web/src/member-permissions.ts';
const id='01234567-1234-1234-1234-012345678901';
function context(){const context=createMemberContext();context.setSession(id,[{id,familyId:id,displayName:'test',ageBand:'child'}]);context.select(id);return context;}
test('permissions are denied until verified and never infer write permission from use',async()=>{
 const permissions=createMemberPermissions(context(),async()=>Response.json({data:{profileId:id,permissions:['profile.use','progress.read']}}));
 assert.equal(permissions.has('settings.write'),false);await permissions.load();
 assert.equal(permissions.has('progress.read'),true);assert.equal(permissions.has('settings.write'),false);
});
test('member change clears permissions and refuses late verification',async()=>{
 const member=context();let finish!:(value:Response)=>void;
 const permissions=createMemberPermissions(member,()=>new Promise(resolve=>{finish=resolve}));
 const pending=permissions.load();member.setSession(null);finish(Response.json({data:{profileId:id,permissions:['profile.use','settings.write']}}));
 await assert.rejects(pending,/MEMBER_CHANGED/);assert.equal(permissions.has('settings.write'),false);
});
test('failure or malformed permission response clears old rights and is retryable',async()=>{
 let invalid=false;const permissions=createMemberPermissions(context(),async()=>Response.json({data:{profileId:id,permissions:invalid?['profile.use','administrator']:['profile.use','settings.write']}}));
 await permissions.load();assert.equal(permissions.has('settings.write'),true);invalid=true;
 await assert.rejects(permissions.load(),/INVALID_PERMISSIONS/);assert.equal(permissions.has('settings.write'),false);
 invalid=false;await permissions.load();assert.equal(permissions.has('settings.write'),true);
});
