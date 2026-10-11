BEGIN;
CREATE TABLE kele.activity_attempts (
 id uuid PRIMARY KEY,
 family_id uuid NOT NULL,
 member_id uuid NOT NULL,
 operation_id uuid NOT NULL,
 activity_id text NOT NULL,
 content_version text NOT NULL,
 input_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('accepted','completed','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(family_id,member_id) REFERENCES kele.member_profiles(family_id,id),
 UNIQUE(member_id,operation_id),
 UNIQUE(family_id,member_id,id)
);
CREATE TABLE kele.learning_progress (
 family_id uuid NOT NULL,
 member_id uuid NOT NULL,
 content_id text NOT NULL,
 skill text NOT NULL,
 completed_count integer NOT NULL DEFAULT 0 CHECK(completed_count>=0),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(family_id,member_id) REFERENCES kele.member_profiles(family_id,id),
 PRIMARY KEY(member_id,content_id,skill)
);
CREATE TABLE kele.reward_ledger (
 id uuid PRIMARY KEY,
 family_id uuid NOT NULL,
 member_id uuid NOT NULL,
 attempt_id uuid NOT NULL,
 reward_type text NOT NULL,
 amount integer NOT NULL CHECK(amount>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(family_id,member_id,attempt_id) REFERENCES kele.activity_attempts(family_id,member_id,id),
 UNIQUE(member_id,attempt_id,reward_type)
);
ALTER TABLE kele.activity_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.activity_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE kele.learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.learning_progress FORCE ROW LEVEL SECURITY;
ALTER TABLE kele.reward_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.reward_ledger FORCE ROW LEVEL SECURITY;
-- No policies or runtime grants until transactional domain functions are reviewed.
-- With RLS enabled, runtime access defaults to deny.
CREATE INDEX attempt_profile_time ON kele.activity_attempts(family_id,member_id,created_at);
COMMIT;
