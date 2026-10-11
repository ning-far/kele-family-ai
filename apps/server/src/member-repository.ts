import {randomUUID,createHash} from 'node:crypto';
import type {DatabasePool} from './profile-repository.ts';
import type {ProfileSummary} from './app.ts';
export function createMemberWriter(pool:DatabasePool){
 return async(userId:string,familyId:string,operationId:string,input:{displayName:string;ageBand:'child'|'adult'|'senior'}):Promise<{profile:ProfileSummary;replayed:boolean}>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(![userId,familyId,operationId].every(value=>uuid.test(value)))throw new Error('INVALID_ID');
  const name=typeof input.displayName==='string'?input.displayName.trim():'';
  if(!name||name.length>80||!['child','adult','senior'].includes(input.ageBand))throw new Error('INVALID_PROFILE');
  const hash=createHash('sha256').update(JSON.stringify([familyId,name,input.ageBand])).digest('hex');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   const membership=await connection.query("SELECT 1 FROM kele.family_memberships WHERE family_id=$1 AND user_id=$2 AND role='admin' AND status='active' FOR SHARE",[familyId,userId]);
   if(!membership.rows.length)throw new Error('FORBIDDEN');
   await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[userId+':'+operationId]);
   const prior=await connection.query<{profile_id:string;input_hash:string}>('SELECT profile_id,input_hash FROM kele.profile_creation_operations WHERE user_id=$1 AND operation_id=$2',[userId,operationId]);
   if(prior.rows.length){
    if(prior.rows[0].input_hash!==hash)throw new Error('IDEMPOTENCY_CONFLICT');
    const existing=await connection.query<ProfileSummary>('SELECT id,family_id AS "familyId",display_name AS "displayName",age_band AS "ageBand" FROM kele.member_profiles WHERE id=$1 AND deleted_at IS NULL',[prior.rows[0].profile_id]);
    if(!existing.rows.length)throw new Error('PROFILE_DELETED');
    await connection.query('COMMIT');return {profile:existing.rows[0],replayed:true};
   }
   const id=randomUUID();
   await connection.query('INSERT INTO kele.member_profiles(id,family_id,owner_user_id,display_name,age_band) VALUES($1,$2,$3,$4,$5)',[id,familyId,userId,name,input.ageBand]);
   // Shared use/learning does not imply private conversation access.
   await connection.query('INSERT INTO kele.profile_grants(family_id,profile_id,user_id,permission) SELECT $1,$2,$3,permission FROM unnest($4::text[]) AS permission',[familyId,id,userId,['profile.use','progress.read','progress.write','settings.write']]);
   await connection.query('INSERT INTO kele.profile_creation_operations(user_id,operation_id,profile_id,input_hash) VALUES($1,$2,$3,$4)',[userId,operationId,id,hash]);
   await connection.query('COMMIT');return {profile:{id,familyId,displayName:name,ageBand:input.ageBand},replayed:false};
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
