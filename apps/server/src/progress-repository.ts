import type {DatabasePool} from './profile-repository.ts';
export type ProgressSnapshot={profileId:string;points:number;items:{contentId:string;skill:string;completedCount:number;version:number;updatedAt:string}[]};
export function createProgressReader(pool:DatabasePool){
 return async(userId:string,profileId:string):Promise<ProgressSnapshot>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(![userId,profileId].every(value=>uuid.test(value)))throw new Error('INVALID_ID');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   const permission=await connection.query('SELECT 1 FROM kele.member_profiles p WHERE p.id=$1 AND kele.has_profile_permission(p.family_id,p.id,\'progress.read\')',[profileId]);
   if(!permission.rows.length)throw new Error('FORBIDDEN');
   const items=await connection.query<ProgressSnapshot['items'][number]>('SELECT content_id AS "contentId",skill,completed_count AS "completedCount",version,updated_at AS "updatedAt" FROM kele.learning_progress WHERE member_id=$1 ORDER BY content_id,skill',[profileId]);
   const points=await connection.query<{points:string}>('SELECT COALESCE(sum(amount),0)::text AS points FROM kele.reward_ledger WHERE member_id=$1',[profileId]);
   await connection.query('COMMIT');return {profileId,points:Number(points.rows[0].points),items:items.rows};
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
