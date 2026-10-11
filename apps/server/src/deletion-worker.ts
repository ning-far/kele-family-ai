import type {DatabasePool} from './profile-repository.ts';
// This maintenance entry requires a separate privileged worker pool. Never
// expose it through HTTP or pass the ordinary runtime pool into it.
export function createDeletionProcessor(pool:DatabasePool){
 return async(jobId:string):Promise<{status:'completed';profileId:string}>=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId))throw new Error('INVALID_ID');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   const job=await connection.query<{profile_id:string;requester_id:string;status:string}>('SELECT profile_id,requester_id,status FROM kele.deletion_jobs WHERE id=$1 FOR UPDATE',[jobId]);
   const target=job.rows[0];if(!target)throw new Error('DELETION_JOB_NOT_FOUND');
   if(target.status==='completed'){await connection.query('COMMIT');return {status:'completed',profileId:target.profile_id};}
   const profile=await connection.query<{deleted_at:string|null;owner_user_id:string}>('SELECT deleted_at,owner_user_id FROM kele.member_profiles WHERE id=$1 FOR UPDATE',[target.profile_id]);
   if(profile.rows.length&&(!profile.rows[0].deleted_at||profile.rows[0].owner_user_id!==target.requester_id))throw new Error('DELETION_TARGET_MISMATCH');
   await connection.query("UPDATE kele.deletion_jobs SET status='processing' WHERE id=$1",[jobId]);
   await connection.query('DELETE FROM kele.reward_ledger WHERE member_id=$1',[target.profile_id]);
   await connection.query('DELETE FROM kele.learning_progress WHERE member_id=$1',[target.profile_id]);
   await connection.query('DELETE FROM kele.activity_attempts WHERE member_id=$1',[target.profile_id]);
   await connection.query('DELETE FROM kele.member_settings WHERE profile_id=$1',[target.profile_id]);
   await connection.query('DELETE FROM kele.profile_grants WHERE profile_id=$1',[target.profile_id]);
   await connection.query('DELETE FROM kele.member_profiles WHERE id=$1',[target.profile_id]);
   await connection.query("UPDATE kele.deletion_jobs SET status='completed',completed_at=now() WHERE id=$1",[jobId]);
   await connection.query('COMMIT');return {status:'completed',profileId:target.profile_id};
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
}
