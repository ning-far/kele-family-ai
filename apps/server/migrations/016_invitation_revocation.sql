BEGIN;
ALTER TABLE kele.learning_invitations ADD COLUMN revoked_at timestamptz;
CREATE POLICY invitation_creator_revoke ON kele.learning_invitations FOR UPDATE
 USING(creator_id=nullif(current_setting('kele.actor_id',true),'')::uuid)
 WITH CHECK(creator_id=nullif(current_setting('kele.actor_id',true),'')::uuid AND revoked_at IS NOT NULL);
COMMIT;
