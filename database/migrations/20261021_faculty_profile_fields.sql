-- Migration: faculty_profile_fields
-- Adds image_url, email, and phone to faculty table.
-- Created: 2026-10-21

BEGIN;
SET search_path = geobot, public, extensions;

-- ---------------------------------------------------------------------------
-- Add columns if not existing
-- ---------------------------------------------------------------------------
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS phone VARCHAR(100);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN faculty.image_url IS
  'Faculty portrait or avatar image URL.';

COMMENT ON COLUMN faculty.email IS
  'Official university directory institutional email address.';

COMMENT ON COLUMN faculty.phone IS
  'Official campus department trunkline extension or office contact.';

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache so Supabase immediately recognizes the new columns
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;
