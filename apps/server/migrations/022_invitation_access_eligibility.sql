BEGIN;
-- This fixed read-only predicate crosses users' RLS boundaries. The function
-- owner must bypass RLS; never grant runtime membership in that owner role.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'INVITATION_PREDICATE_OWNER_MUST_BYPASS_RLS';
 END IF;
END $$;
CREATE FUNCTION kele.invitation_access_is_effective(target_invitation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM kele.learning_invitations i
  JOIN kele.member_profiles p ON p.family_id=i.family_id AND p.id=i.profile_id
  JOIN kele.family_memberships creator ON creator.family_id=i.family_id AND creator.user_id=i.creator_id
  JOIN kele.family_memberships recipient ON recipient.family_id=i.family_id AND recipient.user_id=i.recipient_id
  WHERE i.id=target_invitation
  AND i.recipient_id=nullif(pg_catalog.current_setting('kele.actor_id',true),'')::uuid
  AND i.accepted_at IS NOT NULL AND i.revoked_at IS NULL
  AND p.deleted_at IS NULL AND p.owner_user_id=i.creator_id
  AND creator.status='active' AND creator.role='admin' AND recipient.status='active'
  AND EXISTS(SELECT 1 FROM kele.profile_grants g WHERE g.family_id=i.family_id AND g.profile_id=i.profile_id AND g.user_id=i.creator_id AND g.permission='profile.use')
  AND EXISTS(SELECT 1 FROM kele.profile_grants g WHERE g.family_id=i.family_id AND g.profile_id=i.profile_id AND g.user_id=i.creator_id AND g.permission='progress.read')
 );
$$;
REVOKE ALL ON FUNCTION kele.invitation_access_is_effective(uuid) FROM PUBLIC;
-- Not wired into profile visibility or effective permissions yet. Only trusted
-- runtime roles may be granted EXECUTE after restricted-role verification.
COMMIT;
