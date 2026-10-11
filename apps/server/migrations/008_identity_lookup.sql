BEGIN;
ALTER TABLE kele.auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.auth_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_lookup ON kele.auth_identities FOR SELECT USING (
 provider=current_setting('kele.identity_provider',true)
 AND subject=current_setting('kele.identity_subject',true)
);
COMMIT;
