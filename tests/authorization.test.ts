import assert from 'node:assert/strict';
import test from 'node:test';
import {requireProfilePermission,type ProfileGrant} from '../apps/server/src/authorization.ts';
test('家庭档案权限拒绝跨家庭、跨账号与未授权私密会话',()=>{
 const grants:ProfileGrant[]=[{familyId:'f1',profileId:'p1',userId:'u1',permissions:['profile.use','progress.read']}];
 requireProfilePermission({userId:'u1'},'f1','p1','progress.read',grants);
 assert.throws(()=>requireProfilePermission(null,'f1','p1','progress.read',grants),/UNAUTHENTICATED/);
 assert.throws(()=>requireProfilePermission({userId:'u2'},'f1','p1','progress.read',grants),/FORBIDDEN/);
 assert.throws(()=>requireProfilePermission({userId:'u1'},'f2','p1','progress.read',grants),/FORBIDDEN/);
 assert.throws(()=>requireProfilePermission({userId:'u1'},'f1','p1','conversation.read',grants),/FORBIDDEN/);
});
