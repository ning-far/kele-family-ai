import {createRemoteJWKSet,jwtVerify,errors,type JWTVerifyGetKey} from 'jose';
import type {IdentityVerifier} from './app.ts';
export type IdentityLookup=(issuer:string,subject:string)=>Promise<string|null>;
export function createJwtIdentityVerifier(config:{issuer:string;audience:string;jwksUrl:string},lookup:IdentityLookup,key?:JWTVerifyGetKey):IdentityVerifier {
 const issuer=new URL(config.issuer),jwks=new URL(config.jwksUrl);
 if(issuer.protocol!=='https:'||jwks.protocol!=='https:'||jwks.username||jwks.password||!config.audience)throw new Error('INVALID_IDENTITY_CONFIGURATION');
 const resolve=key??createRemoteJWKSet(jwks,{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000});
 return async req=>{
  const header=req.headers.authorization;
  if(typeof header!=='string'||header.length>8192||!/^Bearer [A-Za-z0-9_.-]+$/i.test(header))return null;
  let payload;
  try {
   ({payload}=await jwtVerify(header.slice(7),resolve,{issuer:config.issuer,audience:config.audience,algorithms:['RS256','ES256'],requiredClaims:['iss','aud','sub','exp','iat'],maxTokenAge:'1h',clockTolerance:5}));
  } catch(error) {
   if(error instanceof errors.JWKSTimeout)throw new Error('IDENTITY_UNAVAILABLE');
   if(error instanceof errors.JOSEError)return null;
   throw error;
  }
  if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>256)return null;
  const userId=await lookup(config.issuer,payload.sub);
  return userId?{userId}:null;
 };
}
