BEGIN;
-- Invitation sources remain excluded until controlled acceptance and live
-- eligibility checks are implemented. This refactor adds no access rights.
CREATE FUNCTION kele.effective_profile_permissions(target_family uuid,target_profile uuid)
RETURNS TABLE(permission text) LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,kele AS $$
 SELECT DISTINCT g.permission FROM kele.profile_grants g
 JOIN kele.family_memberships m ON m.family_id=g.family_id AND m.user_id=g.user_id
 JOIN kele.member_profiles p ON p.family_id=g.family_id AND p.id=g.profile_id
 WHERE g.family_id=target_family AND g.profile_id=target_profile
 AND g.user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
 AND m.status='active' AND p.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION kele.effective_profile_permissions(uuid,uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION kele.has_profile_permission(target_family uuid,target_profile uuid,target_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,kele AS $$
 SELECT EXISTS(SELECT 1 FROM kele.effective_profile_permissions(target_family,target_profile) e WHERE e.permission=target_permission);
$$;
COMMIT;
