BEGIN;
CREATE TABLE kele.login_sessions (
 token_hash text PRIMARY KEY CHECK(length(token_hash)=64),
 user_id uuid NOT NULL REFERENCES kele.users(id),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE kele.login_proofs (
 proof_hash text PRIMARY KEY CHECK(length(proof_hash)=64),
 user_id uuid NOT NULL REFERENCES kele.users(id),
 consumed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE kele.login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.login_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE kele.login_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.login_proofs FORCE ROW LEVEL SECURITY;
CREATE POLICY session_lookup ON kele.login_sessions FOR SELECT USING(token_hash=current_setting('kele.session_hash',true));
CREATE POLICY session_create ON kele.login_sessions FOR INSERT WITH CHECK(user_id=nullif(current_setting('kele.actor_id',true),'')::uuid AND revoked_at IS NULL AND expires_at>now() AND expires_at<=now()+interval '31 minutes');
CREATE POLICY session_revoke ON kele.login_sessions FOR UPDATE USING(token_hash=current_setting('kele.session_hash',true) AND user_id=nullif(current_setting('kele.actor_id',true),'')::uuid) WITH CHECK(revoked_at IS NOT NULL);
CREATE POLICY proof_create ON kele.login_proofs FOR INSERT WITH CHECK(user_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
CREATE POLICY proof_read ON kele.login_proofs FOR SELECT USING(user_id=nullif(current_setting('kele.actor_id',true),'')::uuid);
COMMIT;
