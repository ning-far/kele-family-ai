BEGIN;
CREATE FUNCTION kele.has_profile_permission(target_family uuid,target_profile uuid,target_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,kele AS $$
 SELECT EXISTS (
  SELECT 1 FROM kele.profile_grants g
  JOIN kele.family_memberships m ON m.family_id=g.family_id AND m.user_id=g.user_id
  JOIN kele.member_profiles p ON p.family_id=g.family_id AND p.id=g.profile_id
  WHERE g.family_id=target_family AND g.profile_id=target_profile
  AND g.user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
  AND g.permission=target_permission AND m.status='active' AND p.deleted_at IS NULL
 );
$$;
REVOKE ALL ON FUNCTION kele.has_profile_permission(uuid,uuid,text) FROM PUBLIC;
CREATE POLICY attempt_read ON kele.activity_attempts FOR SELECT USING(kele.has_profile_permission(family_id,member_id,'progress.read'));
CREATE POLICY attempt_insert ON kele.activity_attempts FOR INSERT WITH CHECK(kele.has_profile_permission(family_id,member_id,'progress.write'));
CREATE POLICY progress_read ON kele.learning_progress FOR SELECT USING(kele.has_profile_permission(family_id,member_id,'progress.read'));
CREATE POLICY progress_insert ON kele.learning_progress FOR INSERT WITH CHECK(kele.has_profile_permission(family_id,member_id,'progress.write'));
CREATE POLICY progress_update ON kele.learning_progress FOR UPDATE USING(kele.has_profile_permission(family_id,member_id,'progress.write')) WITH CHECK(kele.has_profile_permission(family_id,member_id,'progress.write'));
CREATE POLICY reward_read ON kele.reward_ledger FOR SELECT USING(kele.has_profile_permission(family_id,member_id,'progress.read'));
-- Reward INSERT remains unavailable to runtime SQL until a controlled domain
-- function verifies completion and commits attempt/progress/reward atomically.
COMMIT;
