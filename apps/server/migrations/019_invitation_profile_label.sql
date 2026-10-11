BEGIN;
ALTER TABLE kele.learning_invitations ADD COLUMN profile_label text NOT NULL DEFAULT '学习档案' CHECK(length(profile_label) BETWEEN 1 AND 80);
COMMIT;
