BEGIN;
CREATE TABLE kele.profile_creation_operations (
 user_id uuid NOT NULL REFERENCES kele.users(id),
 operation_id uuid NOT NULL,
 profile_id uuid NOT NULL UNIQUE,
 input_hash text NOT NULL CHECK(length(input_hash)=64),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
ALTER TABLE kele.profile_creation_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.profile_creation_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY profile_creation_read ON kele.profile_creation_operations FOR SELECT USING(user_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
CREATE POLICY profile_creation_insert ON kele.profile_creation_operations FOR INSERT WITH CHECK(
 user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM kele.member_profiles p WHERE p.id=profile_id AND p.owner_user_id=user_id AND p.deleted_at IS NULL)
);
COMMIT;
