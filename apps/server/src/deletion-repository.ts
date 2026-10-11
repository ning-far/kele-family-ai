import {randomUUID} from 'node:crypto';
import type {DatabasePool} from './profile-repository.ts';
export type DeletionResult={id:string;profileId:string;status:string;requestedAt:string};
export function createDeletionReader(pool:DatabasePool){
 return async(userId:string,jobId:string):Promise<DeletionResult|null>=>{
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   const result=await connection.query<DeletionResult>('SELECT id,profile_id AS "profileId",status,requested_at AS "requestedAt" FROM kele.deletion_jobs WHERE id=$1 AND requester_id=$2',[jobId,userId]);
   await connection.query('COMMIT');return result.rows[0]??null;
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
export function createProfileDeletionWriter(pool:DatabasePool){
 return async(userId:string,profileId:string,operationId:string):Promise<DeletionResult>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(![userId,profileId,operationId].every(value=>uuid.test(value)))throw new Error('INVALID_ID');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   await connection.query("SELECT set_config('kele.actor_id',$1,true),set_config('kele.lifecycle_target',$2,true)",[userId,profileId]);
   const target=await connection.query<{deleted_at:string|null}>(`SELECT p.deleted_at FROM kele.member_profiles p JOIN kele.family_memberships m ON m.family_id=p.family_id AND m.user_id=p.owner_user_id WHERE p.id=$1 AND p.owner_user_id=$2 AND m.status='active' FOR UPDATE OF p FOR SHARE OF m`,[profileId,userId]);
   if(!target.rows.length)throw new Error('FORBIDDEN');
   const prior=await connection.query<DeletionResult>('SELECT id,profile_id AS "profileId",status,requested_at AS "requestedAt" FROM kele.deletion_jobs WHERE requester_id=$1 AND (operation_id=$2 OR profile_id=$3)',[userId,operationId,profileId]);
   if(prior.rows.length){if(prior.rows[0].profileId!==profileId)throw new Error('IDEMPOTENCY_CONFLICT');await connection.query('COMMIT');return prior.rows[0];}
   if(target.rows[0].deleted_at)throw new Error('DELETION_STATE_CONFLICT');
   await connection.query('UPDATE kele.member_profiles SET deleted_at=now(),version=version+1 WHERE id=$1',[profileId]);
   const result=await connection.query<DeletionResult>('INSERT INTO kele.deletion_jobs(id,profile_id,requester_id,operation_id) VALUES($1,$2,$3,$4) RETURNING id,profile_id AS "profileId",status,requested_at AS "requestedAt"',[randomUUID(),profileId,userId,operationId]);
   await connection.query('COMMIT');return result.rows[0];
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
