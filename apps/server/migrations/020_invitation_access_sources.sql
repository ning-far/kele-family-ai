BEGIN;
ALTER TABLE kele.learning_invitations ADD COLUMN accepted_at timestamptz;
ALTER TABLE kele.learning_invitations ADD CONSTRAINT invitation_source_identity
 UNIQUE(id,family_id,profile_id,recipient_id);
-- Separate from independent profile_grants: revoking a source must never delete
-- an unrelated grant. This table alone does not authorize any profile access.
CREATE TABLE kele.invitation_access_sources (
 invitation_id uuid NOT NULL,
 family_id uuid NOT NULL,
 profile_id uuid NOT NULL,
 recipient_id uuid NOT NULL,
 permission text NOT NULL CHECK(permission IN ('profile.use','progress.read')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(invitation_id,permission),
 FOREIGN KEY(invitation_id,family_id,profile_id,recipient_id)
 REFERENCES kele.learning_invitations(id,family_id,profile_id,recipient_id) ON DELETE CASCADE
);
ALTER TABLE kele.invitation_access_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.invitation_access_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY invitation_source_recipient_read ON kele.invitation_access_sources
 FOR SELECT USING(recipient_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
-- Runtime INSERT/UPDATE/DELETE remain denied. A controlled acceptance entry and
-- effective permission read policies must be verified before enabling the API.
COMMIT;
