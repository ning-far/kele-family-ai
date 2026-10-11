BEGIN;
CREATE POLICY invitation_recipient_read ON kele.learning_invitations FOR SELECT
 USING(recipient_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
CREATE INDEX invitation_recipient_cursor ON kele.learning_invitations(recipient_id,id);
CREATE INDEX invitation_creator_cursor ON kele.learning_invitations(creator_id,id);
COMMIT;
