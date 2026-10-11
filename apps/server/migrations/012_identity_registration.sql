BEGIN;
CREATE POLICY user_registration ON kele.users FOR INSERT WITH CHECK(id=nullif(current_setting('kele.actor_id',true),'')::uuid);
CREATE POLICY identity_registration ON kele.auth_identities FOR INSERT WITH CHECK(
 provider=current_setting('kele.identity_provider',true)
 AND subject=current_setting('kele.identity_subject',true)
 AND user_id=nullif(current_setting('kele.actor_id',true),'')::uuid
);
COMMIT;
