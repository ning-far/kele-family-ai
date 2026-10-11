BEGIN;
CREATE TABLE kele.learning_invitations (
 id uuid PRIMARY KEY,
 creator_id uuid NOT NULL REFERENCES kele.users(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES kele.users(id) ON DELETE CASCADE,
 family_id uuid NOT NULL,
 profile_id uuid NOT NULL,
 operation_id uuid NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(creator_id<>recipient_id),
 FOREIGN KEY(family_id,profile_id) REFERENCES kele.member_profiles(family_id,id) ON DELETE CASCADE,
 UNIQUE(creator_id,operation_id)
);
ALTER TABLE kele.learning_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.learning_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invitation_creator_read ON kele.learning_invitations FOR SELECT USING(creator_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
CREATE POLICY invitation_creator_insert ON kele.learning_invitations FOR INSERT WITH CHECK(
 creator_id=nullif(current_setting('kele.actor_id',true),'')::uuid
 AND expires_at>now() AND expires_at<=now()+interval '24 hours'
 AND EXISTS(SELECT 1 FROM kele.member_profiles p JOIN kele.family_memberships m ON m.family_id=p.family_id AND m.user_id=creator_id
 WHERE p.id=profile_id AND p.family_id=learning_invitations.family_id AND p.owner_user_id=creator_id AND p.deleted_at IS NULL AND m.role='admin' AND m.status='active')
 AND kele.has_profile_permission(family_id,profile_id,'profile.use')
 AND kele.has_profile_permission(family_id,profile_id,'progress.read')
);
COMMIT;
