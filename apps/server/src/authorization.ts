export type VerifiedActor = { userId:string };
export type ProfilePermission = 'profile.use'|'progress.read'|'progress.write'|'settings.write'|'conversation.read'|'conversation.delete';
export type ProfileGrant = { familyId:string;profileId:string;userId:string;permissions:ProfilePermission[] };
export function requireProfilePermission(actor:VerifiedActor|null,familyId:string,profileId:string,permission:ProfilePermission,grants:readonly ProfileGrant[]):void {
  if(!actor) throw new Error('UNAUTHENTICATED');
  if(!grants.some(grant=>grant.userId===actor.userId && grant.familyId===familyId && grant.profileId===profileId && grant.permissions.includes(permission))) throw new Error('FORBIDDEN');
}
