import {randomUUID} from 'node:crypto';
import type {DatabasePool} from './profile-repository.ts';
export type InvitationResult={id:string;familyId:string;profileId:string;recipientUserId:string;expiresAt:string;status:'pending';replayed:boolean};
export function createInvitationWriter(pool:DatabasePool){
 return async(actor:string,familyId:string,operationId:string,profileId:string,recipient:string):Promise<InvitationResult>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(![actor,familyId,operationId,profileId,recipient].every(value=>uuid.test(value))||actor.toLowerCase()===recipient.toLowerCase())throw new Error('INVALID_INVITATION');
  [actor,familyId,operationId,profileId,recipient]=[actor,familyId,operationId,profileId,recipient].map(value=>value.toLowerCase());
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');await connection.query("SELECT set_config('kele.actor_id',$1,true)",[actor]);
   const allowed=await connection.query<{display_name:string}>(`SELECT p.display_name FROM kele.member_profiles p JOIN kele.family_memberships m ON m.family_id=p.family_id AND m.user_id=$1
    JOIN kele.profile_grants g ON g.family_id=p.family_id AND g.profile_id=p.id AND g.user_id=$1
    WHERE p.id=$2 AND p.family_id=$3 AND p.owner_user_id=$1 AND p.deleted_at IS NULL AND m.status='active' AND m.role='admin'
    AND g.permission IN ('profile.use','progress.read') FOR SHARE OF p,m,g`,[actor,profileId,familyId]);
   if(allowed.rows.length!==2)throw new Error('FORBIDDEN');
   await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor+':invite:'+operationId]);
   const prior=await connection.query<InvitationResult&{expired:boolean;revoked:boolean}>(`SELECT id,family_id AS "familyId",profile_id AS "profileId",recipient_id AS "recipientUserId",expires_at AS "expiresAt",expires_at<=now() AS expired,revoked_at IS NOT NULL AS revoked FROM kele.learning_invitations WHERE creator_id=$1 AND operation_id=$2 FOR SHARE`,[actor,operationId]);
   if(prior.rows.length){const row=prior.rows[0];if(row.familyId!==familyId||row.profileId!==profileId||row.recipientUserId!==recipient)throw new Error('IDEMPOTENCY_CONFLICT');if(row.revoked)throw new Error('INVITATION_REVOKED');if(row.expired)throw new Error('INVITATION_EXPIRED');await connection.query('COMMIT');return {id:row.id,familyId,profileId,recipientUserId:recipient,expiresAt:row.expiresAt,status:'pending',replayed:true};}
   const id=randomUUID();const result=await connection.query<{expiresAt:string}>('INSERT INTO kele.learning_invitations(id,creator_id,recipient_id,family_id,profile_id,operation_id,profile_label) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING expires_at AS "expiresAt"',[id,actor,recipient,familyId,profileId,operationId,allowed.rows[0].display_name]);
   await connection.query('COMMIT');return {id,familyId,profileId,recipientUserId:recipient,expiresAt:result.rows[0].expiresAt,status:'pending',replayed:false};
  }catch(error){await connection.query('ROLLBACK');if((error as {code?:string}).code==='23503')throw new Error('INVALID_INVITATION');throw error;}finally{connection.release();}
 };
}

export function createInvitationRevoker(pool:DatabasePool){
 return async(actor:string,id:string):Promise<{id:string;status:'revoked'}>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(actor)||!uuid.test(id))throw new Error('INVALID_INVITATION');
  actor=actor.toLowerCase();id=id.toLowerCase();
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');await connection.query("SELECT set_config('kele.actor_id',$1,true)",[actor]);
   const result=await connection.query('UPDATE kele.learning_invitations SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND creator_id=$2 RETURNING id',[id,actor]);
   if(!result.rows.length)throw new Error('FORBIDDEN');
   await connection.query('COMMIT');return {id,status:'revoked'};
  }catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
 };
}
