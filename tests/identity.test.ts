import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import {createJwtIdentityVerifier} from '../apps/server/src/identity.ts';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const config={issuer:'https://identity.example.test',audience:'kele-api',jwksUrl:'https://identity.example.test/jwks'};
const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
function token(patch:Record<string,unknown>={}){
 const now=Math.floor(Date.now()/1000);
 const input=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:config.issuer,aud:config.audience,sub:'provider-subject',iat:now,exp:now+300,...patch});
 return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');
}
const request=(value:string)=>({headers:{authorization:'Bearer '+value}} as IncomingMessage);
test('JWT identity validates signature, issuer, audience, expiry and server mapping',async()=>{
 let lookups=0;
 const verify=createJwtIdentityVerifier(config,async(issuer,subject)=>{lookups++;assert.equal(issuer,config.issuer);return subject==='provider-subject'?'trusted-account':null;},async()=>publicKey);
 assert.deepEqual(await verify(request(token())),{userId:'trusted-account'});
 for(const patch of [{iss:'https://attacker.test'},{aud:'another-api'},{exp:1},{sub:''},{iat:1,exp:Math.floor(Date.now()/1000)+300}])assert.equal(await verify(request(token(patch))),null);
 assert.equal(await verify(request(token().slice(0,-12)+'tampered')),null);
 assert.equal(lookups,1);
 assert.equal(await verify(request(token({sub:'unknown'}))),null);
});
test('JWT configuration rejects insecure or incomplete endpoints',()=>{
 assert.throws(()=>createJwtIdentityVerifier({...config,jwksUrl:'http://identity.test'},async()=>null),/INVALID_IDENTITY_CONFIGURATION/);
});
