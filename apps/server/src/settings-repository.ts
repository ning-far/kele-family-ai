import type {DatabasePool} from './profile-repository.ts';
export type MemberSettings={defaultMode:string;sound:boolean;fontSize:'标准'|'大字'|'特大'};
export type SettingsSnapshot={profileId:string;version:number;settings:MemberSettings};
export type SettingsWrite={expectedVersion:number;settings:MemberSettings};
const modes=['rhythm-game','primary-english','idiom-chain','voice-input-bridge','companion-chat','creator-studio'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseSettingsWrite(input:unknown):SettingsWrite{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_SETTINGS');
 const value=input as Record<string,unknown>,settings=value.settings as Record<string,unknown>;
 if(Object.keys(value).length!==2||!Number.isSafeInteger(value.expectedVersion)||Number(value.expectedVersion)<0||Number(value.expectedVersion)>=2147483647||!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).length!==3||typeof settings.sound!=='boolean'||typeof settings.defaultMode!=='string'||typeof settings.fontSize!=='string'||!modes.includes(settings.defaultMode)||!['标准','大字','特大'].includes(String(settings.fontSize)))throw new Error('INVALID_SETTINGS');
 return value as unknown as SettingsWrite;
}
export function createSettingsRepository(pool:DatabasePool){
 const run=async(userId:string,profileId:string,input?:SettingsWrite):Promise<SettingsSnapshot>=>{
  if(!uuid.test(userId)||!uuid.test(profileId))throw new Error('INVALID_ID');
  if(input)parseSettingsWrite(input);
  const connection=await pool.connect();
  try{
   await connection.query(input?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
   const allowed=input ? await connection.query<{family_id:string}>(`SELECT p.family_id FROM kele.member_profiles p
    JOIN kele.family_memberships m ON m.family_id=p.family_id AND m.user_id=$2
    JOIN kele.profile_grants g ON g.family_id=p.family_id AND g.profile_id=p.id AND g.user_id=$2
    WHERE p.id=$1 AND p.deleted_at IS NULL AND m.status='active' AND g.permission=$3
    AND kele.has_profile_permission(p.family_id,p.id,'profile.use') FOR SHARE OF p,m,g`,[profileId,userId,'settings.write'])
    : await connection.query<{family_id:string}>("SELECT p.family_id FROM kele.member_profiles p WHERE p.id=$1 AND p.deleted_at IS NULL AND kele.has_profile_permission(p.family_id,p.id,'profile.use')",[profileId]);
   if(!allowed.rows.length)throw new Error('FORBIDDEN');
   // Serializes initial inserts as well as existing-row updates.
   if(input)await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['settings:'+profileId]);
   const existing=await connection.query<{defaultMode:string;sound:boolean;fontSize:MemberSettings['fontSize'];version:number}>('SELECT default_mode AS "defaultMode",sound,font_size AS "fontSize",version FROM kele.member_settings WHERE profile_id=$1',[profileId]);
   const prior=existing.rows[0];
   const current:SettingsSnapshot={profileId,version:prior?.version??0,settings:prior?{defaultMode:prior.defaultMode,sound:prior.sound,fontSize:prior.fontSize}:{defaultMode:'rhythm-game',sound:true,fontSize:'标准'}};
   if(!input){await connection.query('COMMIT');return current;}
   if(current.version!==input.expectedVersion)throw new Error('SETTINGS_VERSION_CONFLICT');
   const nextVersion=current.version+1;
   if(prior)await connection.query('UPDATE kele.member_settings SET default_mode=$1,sound=$2,font_size=$3,version=$4,updated_at=now() WHERE profile_id=$5',[input.settings.defaultMode,input.settings.sound,input.settings.fontSize,nextVersion,profileId]);
   else await connection.query('INSERT INTO kele.member_settings(profile_id,family_id,default_mode,sound,font_size,version) VALUES($1,$2,$3,$4,$5,1)',[profileId,allowed.rows[0].family_id,input.settings.defaultMode,input.settings.sound,input.settings.fontSize]);
   await connection.query('COMMIT');return {profileId,version:nextVersion,settings:{...input.settings}};
  }catch(error){await connection.query('ROLLBACK');throw error;}
  finally{connection.release();}
 };
 return {read:(userId:string,profileId:string)=>run(userId,profileId),write:(userId:string,profileId:string,input:SettingsWrite)=>run(userId,profileId,input)};
}
