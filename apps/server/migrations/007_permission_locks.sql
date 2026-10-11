BEGIN;
-- PostgreSQL locking SELECT also evaluates UPDATE visibility. These policies
-- permit locking authorized rows but WITH CHECK(false) forbids any mutation.
CREATE POLICY membership_lock ON kele.family_memberships FOR UPDATE
 USING(user_id=nullif(current_setting('kele.actor_id',true),'')::uuid AND status='active') WITH CHECK(false);
CREATE POLICY profile_lock ON kele.member_profiles FOR UPDATE
 USING(deleted_at IS NULL AND kele.has_profile_permission(family_id,id,'progress.write')) WITH CHECK(false);
CREATE POLICY grant_lock ON kele.profile_grants FOR UPDATE
 USING(user_id=nullif(current_setting('kele.actor_id',true),'')::uuid) WITH CHECK(false);
COMMIT;
