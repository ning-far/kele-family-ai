BEGIN;
ALTER POLICY profile_read ON kele.member_profiles USING (
 deleted_at IS NULL AND (
  owner_user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
  OR EXISTS (
   SELECT 1 FROM kele.profile_grants g
   JOIN kele.family_memberships m ON m.family_id=g.family_id AND m.user_id=g.user_id
   WHERE g.family_id=member_profiles.family_id AND g.profile_id=member_profiles.id
   AND g.user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
   AND m.status='active' AND g.permission='profile.use'
  )
 )
);
CREATE POLICY owner_grant_insert ON kele.profile_grants FOR INSERT WITH CHECK (
 user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
 AND EXISTS (
  SELECT 1 FROM kele.member_profiles p
  JOIN kele.family_memberships m ON m.family_id=p.family_id AND m.user_id=p.owner_user_id
  WHERE p.family_id=profile_grants.family_id AND p.id=profile_grants.profile_id
  AND p.owner_user_id=profile_grants.user_id AND p.deleted_at IS NULL AND m.status='active'
 )
);
-- No ability to grant access to another person's profile or another account.
COMMIT;
