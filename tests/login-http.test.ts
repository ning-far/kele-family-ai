import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../apps/server/src/app.ts';
import {createBrowserIdentityVerifier} from '../apps/server/src/browser-session.ts';
test('browser exchange binds origin/consent, uses HttpOnly cookie and logout revokes access',async()=>{
 const token='s'.repeat(43),origin='https://kele.example';let consumed=false,revoked=false;
 const proof=async(req:{headers:{authorization?:string}})=>req.headers.authorization==='Bearer verified-proof'?{userId:'trusted'}:null;
 const sessions={exchange:async(user:string,value:string)=>{assert.equal(user,'trusted');assert.equal(value,'verified-proof');if(consumed)throw new Error('LOGIN_PROOF_REPLAYED');consumed=true;return {token,expiresAt:new Date().toISOString()}},verify:async(value:string)=>value===token&&!revoked?{userId:'trusted'}:null,revoke:async()=>{revoked=true}};
 const app=createApp({verifyIdentity:createBrowserIdentityVerifier(proof,sessions,origin),browserAuth:{sessions,verifyProof:proof,origin,secure:true}});
 await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));const address=app.address();assert.ok(address&&typeof address==='object');const base='http://127.0.0.1:'+address.port;
 try{
  const exchange=(requestOrigin=origin,consent=true)=>fetch(base+'/api/v1/auth/exchange',{method:'POST',headers:{origin:requestOrigin,authorization:'Bearer verified-proof','content-type':'application/json'},body:JSON.stringify({consent})});
  assert.equal((await exchange('https://attacker.test')).status,403);
  assert.equal((await exchange(origin,false)).status,400);
  assert.equal(consumed,false);
  const response=await exchange();assert.equal(response.status,200);assert.match(response.headers.get('set-cookie')??'',/HttpOnly.*SameSite=Lax.*Secure/);
  const body=await response.json();assert.equal(body.data.userId,'trusted');assert.equal('token' in body.data,false);
  assert.equal((await exchange()).status,409);
  const cookie='kele_session='+token;
  assert.equal((await fetch(base+'/api/v1/session',{headers:{cookie}})).status,200);
  assert.equal((await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{cookie,origin:'https://attacker.test'}})).status,403);
  assert.equal(revoked,false);
  const logout=await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{cookie,origin}});assert.equal(logout.status,204);assert.match(logout.headers.get('set-cookie')??'',/Max-Age=0/);
  assert.equal((await fetch(base+'/api/v1/session',{headers:{cookie}})).status,401);
 }finally{await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
