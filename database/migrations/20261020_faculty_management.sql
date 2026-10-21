-- Migration: faculty_management
-- Adds designation, office, and building_id to faculty table.
-- Allows linking faculty to buildings and departments for room & building directory.
-- Created: 2026-10-20

BEGIN;
SET search_path = geobot, public, extensions;

-- ---------------------------------------------------------------------------
-- Add columns if not existing
-- ---------------------------------------------------------------------------
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS designation VARCHAR(150) DEFAULT 'Faculty';
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS office VARCHAR(150);
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES poi(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS faculty_building_idx ON faculty (building_id);
CREATE INDEX IF NOT EXISTS faculty_department_idx ON faculty (department_id);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN faculty.designation IS
  'Academic designation or rank, e.g. Assistant Professor, Department Chair, Instructor.';

COMMENT ON COLUMN faculty.office IS
  'Static office room assignment or room code, e.g. Room 204.';

COMMENT ON COLUMN faculty.building_id IS
  'Assigned campus building (poi), optional if linked via department_id.';

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache so Supabase immediately recognizes the new columns
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;
