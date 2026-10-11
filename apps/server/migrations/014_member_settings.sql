BEGIN;
CREATE TABLE kele.member_settings (
 profile_id uuid PRIMARY KEY,
 family_id uuid NOT NULL,
 default_mode text NOT NULL CHECK(default_mode IN ('rhythm-game','primary-english','idiom-chain','voice-input-bridge','companion-chat','creator-studio')),
 sound boolean NOT NULL,
 font_size text NOT NULL CHECK(font_size IN ('标准','大字','特大')),
 version integer NOT NULL CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(family_id,profile_id) REFERENCES kele.member_profiles(family_id,id)
);
ALTER TABLE kele.member_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE kele.member_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY settings_read ON kele.member_settings FOR SELECT USING(kele.has_profile_permission(family_id,profile_id,'profile.use'));
CREATE POLICY settings_insert ON kele.member_settings FOR INSERT WITH CHECK(version=1 AND kele.has_profile_permission(family_id,profile_id,'profile.use') AND kele.has_profile_permission(family_id,profile_id,'settings.write'));
CREATE POLICY settings_update ON kele.member_settings FOR UPDATE USING(kele.has_profile_permission(family_id,profile_id,'profile.use') AND kele.has_profile_permission(family_id,profile_id,'settings.write')) WITH CHECK(kele.has_profile_permission(family_id,profile_id,'profile.use') AND kele.has_profile_permission(family_id,profile_id,'settings.write'));
CREATE FUNCTION kele.protect_settings_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.family_id<>OLD.family_id OR NEW.profile_id<>OLD.profile_id OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'INVALID_SETTINGS_UPDATE';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER settings_version_guard BEFORE UPDATE ON kele.member_settings FOR EACH ROW EXECUTE FUNCTION kele.protect_settings_update();
COMMIT;
