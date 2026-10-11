import type {DatabasePool} from './profile-repository.ts';
import {randomUUID} from 'node:crypto';
// Only used after signature/issuer/audience validation and explicit exchange
// consent. Ordinary request verification uses lookup and cannot create users.
export function createIdentityRegistrar(pool:DatabasePool){
 return async(issuer:string,subject:string):Promise<string>=>{
  if(!issuer.startsWith('https://')||issuer.length>1000||!subject||subject.length>256)throw new Error('INVALID_VERIFIED_IDENTITY');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   await connection.query("SELECT set_config('kele.identity_provider',$1,true),set_config('kele.identity_subject',$2,true)",[issuer,subject]);
   await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([issuer,subject])]);
   const existing=await connection.query<{user_id:string}>('SELECT user_id FROM kele.auth_identities WHERE provider=$1 AND subject=$2',[issuer,subject]);
   if(existing.rows.length){await connection.query('COMMIT');return existing.rows[0].user_id;}
   const userId=randomUUID();
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   await connection.query('INSERT INTO kele.users(id) VALUES($1)',[userId]);
   await connection.query('INSERT INTO kele.auth_identities(provider,subject,user_id) VALUES($1,$2,$3)',[issuer,subject,userId]);
   await connection.query('COMMIT');return userId;
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
export function createIdentityLookup(pool:DatabasePool){
 return async(issuer:string,subject:string):Promise<string|null>=>{
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   await connection.query("SELECT set_config('kele.identity_provider',$1,true),set_config('kele.identity_subject',$2,true)",[issuer,subject]);
   const result=await connection.query<{user_id:string}>('SELECT user_id FROM kele.auth_identities WHERE provider=$1 AND subject=$2',[issuer,subject]);
   await connection.query('COMMIT');return result.rows[0]?.user_id??null;
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
