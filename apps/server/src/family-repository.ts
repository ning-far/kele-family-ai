import {randomUUID,createHash} from 'node:crypto';
import type {DatabasePool} from './profile-repository.ts';
export function createFamilyWriter(pool:DatabasePool){
 return async(userId:string,name:string,operationId?:string)=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))throw new Error('INVALID_VERIFIED_USER_ID');
  const title=name.trim();if(!title||title.length>80)throw new Error('INVALID_FAMILY_NAME');
  if(operationId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId))throw new Error('INVALID_ID');
  const inputHash=createHash('sha256').update(title).digest('hex');
  const familyId=randomUUID(),profileId=randomUUID();const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   if(operationId){
    await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['family',userId,operationId])]);
    const prior=await connection.query<{family_id:string;profile_id:string;input_hash:string}>('SELECT family_id,profile_id,input_hash FROM kele.family_creation_operations WHERE user_id=$1 AND operation_id=$2',[userId,operationId]);
    const original=prior.rows[0];
    if(original){
     if(original.input_hash!==inputHash)throw new Error('IDEMPOTENCY_CONFLICT');
     const visible=await connection.query(`SELECT 1 FROM kele.member_profiles p
      JOIN kele.family_memberships m ON m.family_id=p.family_id AND m.user_id=$3
      JOIN kele.profile_grants g ON g.family_id=p.family_id AND g.profile_id=p.id AND g.user_id=$3
      WHERE p.id=$1 AND p.family_id=$2 AND p.deleted_at IS NULL AND m.status='active'
      AND m.role='admin' AND g.permission='profile.use' FOR SHARE OF p,m,g`,[original.profile_id,original.family_id,userId]);
     if(!visible.rows.length)throw new Error('FAMILY_UNAVAILABLE_FOR_REPLAY');
     await connection.query('COMMIT');return {familyId:original.family_id,profileId:original.profile_id,name:title,replayed:true};
    }
   }
   await connection.query('INSERT INTO kele.families(id,name,created_by) VALUES($1,$2,$3)',[familyId,title,userId]);
   await connection.query("INSERT INTO kele.family_memberships(family_id,user_id,role,status) VALUES($1,$2,'admin','active')",[familyId,userId]);
   await connection.query("INSERT INTO kele.member_profiles(id,family_id,owner_user_id,display_name,age_band) VALUES($1,$2,$3,'我','adult')",[profileId,familyId,userId]);
   await connection.query("INSERT INTO kele.profile_grants(family_id,profile_id,user_id,permission) SELECT $1,$2,$3,permission FROM unnest($4::text[]) AS permission",[familyId,profileId,userId,['profile.use','progress.read','progress.write','settings.write','conversation.read','conversation.delete']]);
   if(operationId)await connection.query('INSERT INTO kele.family_creation_operations(user_id,operation_id,family_id,profile_id,input_hash) VALUES($1,$2,$3,$4,$5)',[userId,operationId,familyId,profileId,inputHash]);
   await connection.query('COMMIT');return {familyId,profileId,name:title,replayed:false};
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
