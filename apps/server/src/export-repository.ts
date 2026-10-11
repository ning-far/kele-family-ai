import type {DatabasePool} from './profile-repository.ts';
import type {ProfileSummary} from './app.ts';
import type {ProgressSnapshot} from './progress-repository.ts';
import type {MemberSettings,SettingsSnapshot} from './settings-repository.ts';
export type LearningExport={schemaVersion:1;exportedAt:string;profile:ProfileSummary;progress:ProgressSnapshot;settings:SettingsSnapshot};
export function createLearningExporter(pool:DatabasePool){
 return async(userId:string,profileId:string):Promise<LearningExport>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(![userId,profileId].every(value=>uuid.test(value)))throw new Error('INVALID_ID');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   const profile=await connection.query<ProfileSummary>(`SELECT p.id,p.family_id AS "familyId",p.display_name AS "displayName",p.age_band AS "ageBand"
    FROM kele.member_profiles p WHERE p.id=$1 AND p.deleted_at IS NULL
    AND kele.has_profile_permission(p.family_id,p.id,'profile.use')
    AND kele.has_profile_permission(p.family_id,p.id,'progress.read')`,[profileId]);
   if(!profile.rows.length)throw new Error('FORBIDDEN');
   const items=await connection.query<ProgressSnapshot['items'][number]>(`SELECT content_id AS "contentId",skill,completed_count AS "completedCount",version,updated_at AS "updatedAt"
    FROM kele.learning_progress WHERE member_id=$1 ORDER BY content_id,skill LIMIT 1001`,[profileId]);
   if(items.rows.length>1000)throw new Error('EXPORT_TOO_LARGE');
   const points=await connection.query<{points:string}>('SELECT COALESCE(sum(amount),0)::text AS points FROM kele.reward_ledger WHERE member_id=$1',[profileId]);
   const settings=await connection.query<MemberSettings&{version:number}>('SELECT default_mode AS "defaultMode",sound,font_size AS "fontSize",version FROM kele.member_settings WHERE profile_id=$1',[profileId]);
   const prior=settings.rows[0],exportedAt=new Date().toISOString();
   await connection.query('COMMIT');
   return {schemaVersion:1,exportedAt,profile:profile.rows[0],progress:{profileId,points:Number(points.rows[0].points),items:items.rows},settings:{profileId,version:prior?.version??0,settings:prior?{defaultMode:prior.defaultMode,sound:prior.sound,fontSize:prior.fontSize}:{defaultMode:'rhythm-game',sound:true,fontSize:'标准'}}};
  }catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
 };
}
