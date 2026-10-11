BEGIN;
CREATE TABLE kele.family_creation_operations (
 user_id uuid NOT NULL REFERENCES kele.users(id),
 operation_id uuid NOT NULL,
 family_id uuid NOT NULL UNIQUE,
 profile_id uuid NOT NULL UNIQUE,
 input_hash text NOT NULL CHECK(length(input_hash)=64),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
ALTER TABLE kele.family_creation_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.family_creation_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY family_creation_read ON kele.family_creation_operations FOR SELECT USING(user_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
CREATE POLICY family_creation_insert ON kele.family_creation_operations FOR INSERT WITH CHECK(
 user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM kele.families f WHERE f.id=family_id AND f.created_by=user_id)
 AND EXISTS(SELECT 1 FROM kele.member_profiles p WHERE p.id=profile_id AND p.family_id=family_creation_operations.family_id AND p.owner_user_id=user_id AND p.deleted_at IS NULL)
);
COMMIT;
