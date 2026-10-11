import type {DatabasePool} from './profile-repository.ts';
export type DeletionMarker={id:string;profileId:string;requesterId:string;operationId:string;requestedAt:string};
// Restore gate: supply the deletion journal saved independently of the restored
// snapshot. Only a privileged maintenance process may call this entry.
export async function replayDeletionMarkers(pool:DatabasePool,markers:DeletionMarker[]){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(markers.length>10000||markers.some(marker=>![marker.id,marker.profileId,marker.requesterId,marker.operationId].every(value=>uuid.test(value))||!Number.isFinite(Date.parse(marker.requestedAt))))throw new Error('INVALID_DELETION_JOURNAL');
 const connection=await pool.connect();
 try{
  await connection.query('BEGIN');
  for(const marker of markers){
   const existing=await connection.query<{profile_id:string;requester_id:string;operation_id:string}>('SELECT profile_id,requester_id,operation_id FROM kele.deletion_jobs WHERE id=$1 OR profile_id=$2 FOR UPDATE',[marker.id,marker.profileId]);
   if(existing.rows.some(row=>row.profile_id!==marker.profileId||row.requester_id!==marker.requesterId||row.operation_id!==marker.operationId))throw new Error('DELETION_JOURNAL_CONFLICT');
   const profile=await connection.query<{owner_user_id:string;deleted_at:string|null}>('SELECT owner_user_id,deleted_at FROM kele.member_profiles WHERE id=$1 FOR UPDATE',[marker.profileId]);
   if(profile.rows.length&&profile.rows[0].owner_user_id!==marker.requesterId)throw new Error('DELETION_TARGET_MISMATCH');
   await connection.query("INSERT INTO kele.deletion_jobs(id,profile_id,requester_id,operation_id,requested_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(profile_id) DO UPDATE SET status='pending',completed_at=NULL",[marker.id,marker.profileId,marker.requesterId,marker.operationId,marker.requestedAt]);
   if(profile.rows.length&&!profile.rows[0].deleted_at)await connection.query('UPDATE kele.member_profiles SET deleted_at=now(),version=version+1 WHERE id=$1',[marker.profileId]);
  }
  await connection.query('COMMIT');
 }catch(error){await connection.query('ROLLBACK');throw error;}
 finally{connection.release();}
}
