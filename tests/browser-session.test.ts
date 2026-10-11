import test from 'node:test';
import assert from 'node:assert/strict';
import type {IncomingMessage} from 'node:http';
import {createBrowserIdentityVerifier,readSessionCookie,sessionCookie} from '../apps/server/src/browser-session.ts';
const token='a'.repeat(43);
test('cookie sessions reject duplicates and cross-origin writes; bearer remains independently verified',async()=>{
 const sessions={verify:async(value:string)=>value===token?{userId:'user'}:null,exchange:async()=>({token,expiresAt:''}),revoke:async()=>{}};
 const verify=createBrowserIdentityVerifier(async()=>null,sessions,'https://kele.example');
 const req=(method:string,origin?:string,cookie='kele_session='+token)=>({method,headers:{cookie,origin}} as IncomingMessage);
 assert.deepEqual(await verify(req('GET')),{userId:'user'});
 assert.equal(await verify(req('POST','https://attacker.example')),null);
 assert.equal(await verify(req('POST')),null);
 assert.deepEqual(await verify(req('POST','https://kele.example')),{userId:'user'});
 assert.equal(readSessionCookie(req('GET',undefined,'kele_session='+token+'; kele_session='+token)),null);
 assert.match(sessionCookie(token,true),/HttpOnly; SameSite=Lax; Max-Age=1800; Secure/);
});
