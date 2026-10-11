import type { ProfileSummary } from './app.ts';
export interface DatabaseConnection {
 query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}>;
 release():void;
}
export interface DatabasePool { connect():Promise<DatabaseConnection> }
export function createProfileReader(pool:DatabasePool){
 return async(userId:string):Promise<ProfileSummary[]>=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))throw new Error('INVALID_VERIFIED_USER_ID');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   const result=await connection.query<ProfileSummary>(`SELECT p.id,p.family_id AS "familyId",p.display_name AS "displayName",p.age_band AS "ageBand"
    FROM kele.member_profiles p WHERE p.deleted_at IS NULL
    AND kele.has_profile_permission(p.family_id,p.id,'profile.use') ORDER BY p.display_name,p.id`);
   await connection.query('COMMIT');return result.rows;
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
