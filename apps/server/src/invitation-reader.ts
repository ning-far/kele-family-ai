import type {DatabasePool} from './profile-repository.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type InvitationQuery={direction:'sent'|'received';after?:string};
export type InvitationItem={profileLabel:string;id:string;familyId:string;profileId:string;creatorUserId:string;recipientUserId:string;expiresAt:string;status:'pending'|'accepted'|'expired'|'revoked'};
export type InvitationPage={items:InvitationItem[];nextCursor:string|null};
export function parseInvitationQuery(params:URLSearchParams):InvitationQuery{
 if([...params.keys()].some(key=>!['direction','after'].includes(key))||params.getAll('direction').length>1||params.getAll('after').length>1)throw new Error('INVALID_INVITATION_QUERY');
 const direction=params.get('direction')??'received',after=params.get('after');
 if(!['sent','received'].includes(direction)||(after!==null&&!uuid.test(after)))throw new Error('INVALID_INVITATION_QUERY');
 return {direction:direction as InvitationQuery['direction'],...(after?{after}:{})};
}
export function createInvitationReader(pool:DatabasePool){
 return async(actor:string,input:InvitationQuery):Promise<InvitationPage>=>{
  if(!uuid.test(actor))throw new Error('INVALID_INVITATION_QUERY');
  const checked=parseInvitationQuery(new URLSearchParams({...input}));
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await connection.query("SELECT set_config('kele.actor_id',$1,true)",[actor]);
   const column=checked.direction==='sent'?'creator_id':'recipient_id';
   const result=await connection.query<InvitationItem>(`SELECT profile_label AS "profileLabel",id,family_id AS "familyId",profile_id AS "profileId",creator_id AS "creatorUserId",recipient_id AS "recipientUserId",expires_at AS "expiresAt",
    CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN accepted_at IS NOT NULL THEN 'accepted' WHEN expires_at<=now() THEN 'expired' ELSE 'pending' END AS status
    FROM kele.learning_invitations WHERE ${column}=$1 AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT 51`,[actor,checked.after??null]);
   await connection.query('COMMIT');const items=result.rows.slice(0,50);return {items,nextCursor:result.rows.length>50?items[49].id:null};
  }catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
 };
}
