import type {IncomingMessage} from 'node:http';
import type {IdentityVerifier} from './app.ts';
import type {createSessionRepository} from './session-repository.ts';
export type SessionRepository=ReturnType<typeof createSessionRepository>;
export function readSessionCookie(req:IncomingMessage):string|null{
 const matches=(req.headers.cookie??'').split(';').map(part=>part.trim()).filter(part=>part.startsWith('kele_session='));
 if(matches.length!==1)return null;
 const token=matches[0].slice('kele_session='.length);
 return /^[A-Za-z0-9_-]{43}$/.test(token)?token:null;
}
export function createBrowserIdentityVerifier(bearer:IdentityVerifier,sessions:SessionRepository,origin:string):IdentityVerifier{
 return async req=>{
  if(req.headers.authorization)return bearer(req);
  const token=readSessionCookie(req);if(!token)return null;
  if(!['GET','HEAD','OPTIONS'].includes(req.method??'GET')&&req.headers.origin!==origin)return null;
  return sessions.verify(token);
 };
}
export function sessionCookie(token:string,secure:boolean,maxAge=1800){
 return 'kele_session='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+maxAge+(secure?'; Secure':'');
}
