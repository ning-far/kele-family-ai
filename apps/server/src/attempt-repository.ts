import {randomUUID} from 'node:crypto';
import type {DatabasePool} from './profile-repository.ts';
export type AttemptCommand={familyId:string;memberId:string;operationId:string;activityId:string;contentVersion:string;inputHash:string;contentId:string;skill:string};
export type AttemptResult={attemptId:string;replayed:boolean};
export function createAttemptWriter(pool:DatabasePool){
 return async(userId:string,command:AttemptCommand):Promise<AttemptResult>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(![userId,command.familyId,command.memberId,command.operationId].every(value=>uuid.test(value)))throw new Error('INVALID_ID');
  if(![command.activityId,command.contentVersion,command.inputHash,command.contentId,command.skill].every(value=>typeof value==='string'&&value.length>0&&value.length<=200))throw new Error('INVALID_ATTEMPT');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   const permission=await connection.query(`SELECT 1 FROM kele.profile_grants g
    JOIN kele.family_memberships m ON m.family_id=g.family_id AND m.user_id=g.user_id
    JOIN kele.member_profiles p ON p.family_id=g.family_id AND p.id=g.profile_id
    WHERE g.family_id=$1 AND g.profile_id=$2 AND g.user_id=$3 AND g.permission='progress.write'
    AND m.status='active' AND p.deleted_at IS NULL FOR SHARE OF m,p,g`,[command.familyId,command.memberId,userId]);
   if(!permission.rows.length)throw new Error('FORBIDDEN');
   const attemptId=randomUUID();
   const inserted=await connection.query<{id:string}>(`INSERT INTO kele.activity_attempts(id,family_id,member_id,operation_id,activity_id,content_version,input_hash,status,content_id,skill)
    VALUES($1,$2,$3,$4,$5,$6,$7,'completed',$8,$9) ON CONFLICT(member_id,operation_id) DO NOTHING RETURNING id`,[attemptId,command.familyId,command.memberId,command.operationId,command.activityId,command.contentVersion,command.inputHash,command.contentId,command.skill]);
   if(!inserted.rows.length){
    const prior=await connection.query<{id:string;input_hash:string;activity_id:string;content_version:string;content_id:string;skill:string}>('SELECT id,input_hash,activity_id,content_version,content_id,skill FROM kele.activity_attempts WHERE member_id=$1 AND operation_id=$2',[command.memberId,command.operationId]);
    const original=prior.rows[0];
    if(!original||original.input_hash!==command.inputHash||original.activity_id!==command.activityId||original.content_version!==command.contentVersion||original.content_id!==command.contentId||original.skill!==command.skill)throw new Error('IDEMPOTENCY_CONFLICT');
    await connection.query('COMMIT');return {attemptId:original.id,replayed:true};
   }
   await connection.query(`INSERT INTO kele.learning_progress(family_id,member_id,content_id,skill,completed_count) VALUES($1,$2,$3,$4,1)
    ON CONFLICT(member_id,content_id,skill) DO UPDATE SET completed_count=kele.learning_progress.completed_count+1,version=kele.learning_progress.version+1,updated_at=now()`,[command.familyId,command.memberId,command.contentId,command.skill]);
   await connection.query("INSERT INTO kele.reward_ledger(id,family_id,member_id,attempt_id,reward_type,amount) VALUES($1,$2,$3,$4,'practice-completed',1)",[randomUUID(),command.familyId,command.memberId,attemptId]);
   await connection.query('COMMIT');return {attemptId,replayed:false};
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
