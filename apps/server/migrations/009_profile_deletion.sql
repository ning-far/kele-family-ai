BEGIN;
CREATE TABLE kele.deletion_jobs (
 id uuid PRIMARY KEY,
 profile_id uuid NOT NULL UNIQUE,
 requester_id uuid NOT NULL REFERENCES kele.users(id),
 operation_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(requester_id,operation_id)
);
-- No FK to the target: the non-content tombstone must survive target purging.
ALTER TABLE kele.deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.deletion_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY deletion_read ON kele.deletion_jobs FOR SELECT USING(requester_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
CREATE POLICY deletion_insert ON kele.deletion_jobs FOR INSERT WITH CHECK (
 requester_id=nullif(current_setting('kele.actor_id',true),'')::uuid AND status='pending'
 AND EXISTS(SELECT 1 FROM kele.member_profiles p WHERE p.id=profile_id AND p.owner_user_id=requester_id AND p.deleted_at IS NOT NULL)
);
CREATE POLICY profile_lifecycle_read ON kele.member_profiles FOR SELECT USING (
 id::text=current_setting('kele.lifecycle_target',true)
 AND owner_user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM kele.family_memberships m WHERE m.family_id=member_profiles.family_id AND m.user_id=member_profiles.owner_user_id AND m.status='active')
);
CREATE POLICY profile_lifecycle_update ON kele.member_profiles FOR UPDATE
 USING(id::text=current_setting('kele.lifecycle_target',true) AND owner_user_id=nullif(current_setting('kele.actor_id',true),'')::uuid)
 WITH CHECK(id::text=current_setting('kele.lifecycle_target',true) AND owner_user_id=nullif(current_setting('kele.actor_id',true),'')::uuid AND deleted_at IS NOT NULL);
CREATE FUNCTION kele.protect_profile_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.family_id IS DISTINCT FROM OLD.family_id
 OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR NEW.display_name IS DISTINCT FROM OLD.display_name
 OR NEW.age_band IS DISTINCT FROM OLD.age_band OR NEW.version<>OLD.version+1
 OR OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
  RAISE EXCEPTION 'PROFILE_UPDATE_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER protect_profile_update BEFORE UPDATE ON kele.member_profiles FOR EACH ROW EXECUTE FUNCTION kele.protect_profile_update();
COMMIT;
