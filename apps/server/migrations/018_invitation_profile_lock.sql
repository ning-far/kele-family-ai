BEGIN;
-- Lock visibility for a read-only learning invitation does not authorize updates.
CREATE POLICY profile_invitation_lock ON kele.member_profiles FOR UPDATE
 USING(deleted_at IS NULL AND owner_user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM kele.family_memberships m WHERE m.family_id=member_profiles.family_id AND m.user_id=member_profiles.owner_user_id AND m.role='admin' AND m.status='active')
 AND kele.has_profile_permission(family_id,id,'profile.use')
 AND kele.has_profile_permission(family_id,id,'progress.read'))
 WITH CHECK(false);
COMMIT;
