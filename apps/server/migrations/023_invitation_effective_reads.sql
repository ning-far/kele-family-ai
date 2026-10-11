BEGIN;
CREATE OR REPLACE FUNCTION kele.effective_profile_permissions(target_family uuid,target_profile uuid)
RETURNS TABLE(permission text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,kele AS $$
 SELECT g.permission FROM kele.profile_grants g
 JOIN kele.family_memberships m ON m.family_id=g.family_id AND m.user_id=g.user_id
 JOIN kele.member_profiles p ON p.family_id=g.family_id AND p.id=g.profile_id
 WHERE g.family_id=target_family AND g.profile_id=target_profile
 AND g.user_id=nullif(current_setting('kele.actor_id',true),'')::uuid AND m.status='active' AND p.deleted_at IS NULL
 UNION
 SELECT s.permission FROM kele.invitation_access_sources s
 WHERE s.family_id=target_family AND s.profile_id=target_profile
 AND s.recipient_id=nullif(current_setting('kele.actor_id',true),'')::uuid
 AND kele.invitation_access_is_effective(s.invitation_id);
$$;
CREATE POLICY invitation_profile_read ON kele.member_profiles FOR SELECT USING(
 deleted_at IS NULL AND EXISTS(
  SELECT 1 FROM kele.invitation_access_sources s
  WHERE s.family_id=member_profiles.family_id AND s.profile_id=member_profiles.id
  AND s.recipient_id=nullif(current_setting('kele.actor_id',true),'')::uuid
  AND s.permission='profile.use' AND kele.invitation_access_is_effective(s.invitation_id)
 )
);
COMMIT;
