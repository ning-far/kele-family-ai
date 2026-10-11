BEGIN;
ALTER TABLE kele.families ADD COLUMN created_by uuid REFERENCES kele.users(id);
ALTER TABLE kele.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.users FORCE ROW LEVEL SECURITY;
CREATE POLICY user_self ON kele.users FOR SELECT USING(id=nullif(current_setting('kele.actor_id',true),'')::uuid);
ALTER TABLE kele.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.families FORCE ROW LEVEL SECURITY;
CREATE POLICY family_creator_read ON kele.families FOR SELECT USING(created_by=nullif(current_setting('kele.actor_id',true),'')::uuid);
CREATE POLICY family_creator_insert ON kele.families FOR INSERT WITH CHECK(created_by=nullif(current_setting('kele.actor_id',true),'')::uuid);
ALTER TABLE kele.family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.family_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_self_read ON kele.family_memberships FOR SELECT USING(user_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
CREATE POLICY initial_admin_insert ON kele.family_memberships FOR INSERT WITH CHECK(
 user_id=nullif(current_setting('kele.actor_id',true),'')::uuid AND role='admin' AND status='active'
 AND EXISTS(SELECT 1 FROM kele.families f WHERE f.id=family_id AND f.created_by=user_id)
);
ALTER TABLE kele.profile_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.profile_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY grants_self_read ON kele.profile_grants FOR SELECT USING(user_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
-- Grant writes stay denied until a controlled bootstrap function validates
-- profile ownership without a recursive profile/grant SELECT policy.
CREATE POLICY initial_profile_insert ON kele.member_profiles FOR INSERT WITH CHECK(
 owner_user_id=nullif(current_setting('kele.actor_id',true),'')::uuid AND deleted_at IS NULL
 AND EXISTS(SELECT 1 FROM kele.family_memberships m WHERE m.family_id=member_profiles.family_id
 AND m.user_id=member_profiles.owner_user_id AND m.role='admin' AND m.status='active')
);
-- Membership changes, invitations and grants to other users remain denied.
COMMIT;
