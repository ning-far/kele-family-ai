BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'INVITATION_ACCEPTANCE_OWNER_MUST_BYPASS_RLS';
 END IF;
END $$;
CREATE FUNCTION kele.accept_learning_invitation(target_invitation uuid)
RETURNS TABLE(id uuid,profile_id uuid,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
 actor uuid:=nullif(pg_catalog.current_setting('kele.actor_id',true),'')::uuid;
 invitation kele.learning_invitations%ROWTYPE;
 membership_status text;
 eligible_count integer;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT i.* INTO invitation FROM kele.learning_invitations i
 WHERE i.id=target_invitation AND i.recipient_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF invitation.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'INVITATION_REVOKED'; END IF;
 PERFORM 1 FROM kele.member_profiles p
 JOIN kele.family_memberships m ON m.family_id=p.family_id AND m.user_id=invitation.creator_id
 JOIN kele.profile_grants g ON g.family_id=p.family_id AND g.profile_id=p.id AND g.user_id=invitation.creator_id
 WHERE p.id=invitation.profile_id AND p.family_id=invitation.family_id
 AND p.owner_user_id=invitation.creator_id AND p.deleted_at IS NULL
 AND m.role='admin' AND m.status='active' AND g.permission IN ('profile.use','progress.read')
 FOR SHARE OF p,m,g;
 GET DIAGNOSTICS eligible_count=ROW_COUNT;
 IF eligible_count<>2 THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 -- Serialize absent membership creation across different invitation rows.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('invitation-member:'||invitation.family_id::text||':'||actor::text,0));
 SELECT m.status INTO membership_status FROM kele.family_memberships m
 WHERE m.family_id=invitation.family_id AND m.user_id=actor FOR UPDATE;
 IF membership_status='revoked' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF invitation.accepted_at IS NOT NULL THEN
  IF membership_status IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT invitation.id,invitation.profile_id,true; RETURN;
 END IF;
 -- Wall-clock time after waiting for locks, not transaction-start time.
 IF invitation.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION 'INVITATION_EXPIRED'; END IF;
 IF membership_status IS NULL THEN
  INSERT INTO kele.family_memberships(family_id,user_id,role,status)
  VALUES(invitation.family_id,actor,'member','active');
 END IF;
 INSERT INTO kele.invitation_access_sources(invitation_id,family_id,profile_id,recipient_id,permission)
 VALUES(invitation.id,invitation.family_id,invitation.profile_id,actor,'profile.use'),
       (invitation.id,invitation.family_id,invitation.profile_id,actor,'progress.read');
 UPDATE kele.learning_invitations i SET accepted_at=pg_catalog.clock_timestamp() WHERE i.id=invitation.id;
 RETURN QUERY SELECT invitation.id,invitation.profile_id,false;
END;
$$;
REVOKE ALL ON FUNCTION kele.accept_learning_invitation(uuid) FROM PUBLIC;
COMMIT;
