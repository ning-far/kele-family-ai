-- Apply with the migration owner. Runtime roles must not own tables or bypass RLS.
BEGIN;
CREATE SCHEMA IF NOT EXISTS kele;
CREATE TABLE kele.users (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE kele.auth_identities (
  provider text NOT NULL,
  subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES kele.users(id),
  PRIMARY KEY (provider, subject)
);
CREATE TABLE kele.families (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE kele.family_memberships (
  family_id uuid NOT NULL REFERENCES kele.families(id),
  user_id uuid NOT NULL REFERENCES kele.users(id),
  role text NOT NULL CHECK (role IN ('admin','member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  PRIMARY KEY (family_id,user_id)
);
CREATE TABLE kele.member_profiles (
  id uuid PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES kele.families(id),
  owner_user_id uuid REFERENCES kele.users(id),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  age_band text NOT NULL CHECK (age_band IN ('child','adult','senior')),
  deleted_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  UNIQUE (family_id,id)
);
CREATE TABLE kele.profile_grants (
  family_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('profile.use','progress.read','progress.write','settings.write','conversation.read','conversation.delete')),
  FOREIGN KEY (family_id,profile_id) REFERENCES kele.member_profiles(family_id,id),
  FOREIGN KEY (family_id,user_id) REFERENCES kele.family_memberships(family_id,user_id),
  PRIMARY KEY (family_id,profile_id,user_id,permission)
);
CREATE INDEX membership_actor ON kele.family_memberships(user_id,family_id);
CREATE INDEX profile_family ON kele.member_profiles(family_id,id) WHERE deleted_at IS NULL;
-- Missing request actor fails closed. Set only from a verified server identity,
-- via SET LOCAL within the request transaction, never from client role fields.
ALTER TABLE kele.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.member_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY profile_read ON kele.member_profiles FOR SELECT USING (
  deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM kele.profile_grants g
    JOIN kele.family_memberships m ON m.family_id=g.family_id AND m.user_id=g.user_id
    WHERE g.family_id=member_profiles.family_id AND g.profile_id=member_profiles.id
      AND g.user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
      AND m.status='active' AND g.permission='profile.use'
  )
);
COMMIT;
