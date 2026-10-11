BEGIN;
ALTER TABLE kele.activity_attempts ADD COLUMN content_id text;
ALTER TABLE kele.activity_attempts ADD COLUMN skill text;
-- Existing rows retain NULL: they cannot be replayed as newly scoped attempts.
CREATE POLICY reward_completion_insert ON kele.reward_ledger FOR INSERT WITH CHECK (
 reward_type='practice-completed' AND amount=1
 AND kele.has_profile_permission(family_id,member_id,'progress.write')
 AND EXISTS (SELECT 1 FROM kele.activity_attempts a
  WHERE a.id=reward_ledger.attempt_id AND a.family_id=reward_ledger.family_id
  AND a.member_id=reward_ledger.member_id AND a.status='completed'
  AND a.content_id IS NOT NULL AND a.skill IS NOT NULL)
);
COMMIT;
