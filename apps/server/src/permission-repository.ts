import type {DatabasePool} from './profile-repository.ts';
import type {ProfilePermission} from './authorization.ts';
export type PermissionSnapshot={profileId:string;permissions:ProfilePermission[]};
export function createPermissionReader(pool:DatabasePool){
 return async(userId:string,profileId:string):Promise<PermissionSnapshot>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(![userId,profileId].every(id=>uuid.test(id)))throw new Error('INVALID_ID');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   const allowed=await connection.query("SELECT 1 FROM kele.member_profiles p WHERE p.id=$1 AND p.deleted_at IS NULL AND kele.has_profile_permission(p.family_id,p.id,'profile.use')",[profileId]);
   if(!allowed.rows.length)throw new Error('FORBIDDEN');
   const rows=await connection.query<{permission:ProfilePermission}>(`SELECT e.permission FROM kele.member_profiles p
    CROSS JOIN LATERAL kele.effective_profile_permissions(p.family_id,p.id) e
    WHERE p.id=$1 ORDER BY e.permission`,[profileId]);
   await connection.query('COMMIT');return {profileId,permissions:rows.rows.map(row=>row.permission)};
  }catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
 };
}
