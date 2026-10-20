-- Migration: campus_rooms
-- Manages internal rooms, departments, and offices linked to campus buildings (poi table).
-- Powers room-level chatbot search ("Where is the research innovation room?").
-- Created: 2026-10-20

BEGIN;
SET search_path = geobot, public, extensions;

-- ---------------------------------------------------------------------------
-- campus_rooms table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campus_rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  UUID NOT NULL REFERENCES poi(id) ON DELETE CASCADE,
  room_name    VARCHAR(200) NOT NULL,
  room_code    VARCHAR(50),
  floor_level  VARCHAR(100),          -- e.g. "Ground Floor", "2nd Floor"
  department   VARCHAR(200),
  description  TEXT,
  aliases      TEXT[] DEFAULT '{}',   -- alternate names / search keywords
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Row-Level Security (Audit F-30 / W1)
-- ---------------------------------------------------------------------------
ALTER TABLE campus_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_rooms FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Building-scoped lookups (list all rooms in a building)
CREATE INDEX IF NOT EXISTS campus_rooms_building_idx
  ON campus_rooms (building_id);

-- Full-text search index (GIN) over room_name, department, description.
-- tsvector combines all three fields so a single index serves every query shape.
CREATE INDEX IF NOT EXISTS campus_rooms_fts_idx
  ON campus_rooms
  USING GIN (
    to_tsvector(
      'english',
      coalesce(room_name, '') || ' ' ||
      coalesce(department, '') || ' ' ||
      coalesce(description, '')
    )
  );

-- GIN index on the aliases array for containment queries (@>)
CREATE INDEX IF NOT EXISTS campus_rooms_aliases_idx
  ON campus_rooms USING GIN (aliases);

-- ---------------------------------------------------------------------------
-- Helpful view: rooms with their parent building's coordinates & category
-- (used by the room search endpoint to return map-ready results)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW campus_rooms_with_building AS
SELECT
  r.id,
  r.building_id,
  r.room_name,
  r.room_code,
  r.floor_level,
  r.department,
  r.description,
  r.aliases,
  r.created_at,
  p.name        AS building_name,
  p.poi_type    AS category,
  p.lat,
  p.lng,
  p.image_url,
  p.image_alt
FROM campus_rooms r
JOIN poi p ON p.id = r.building_id;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE campus_rooms IS
  'Internal rooms, offices, and departments linked to campus buildings (poi). '
  'Powers room-level chatbot navigation queries.';

COMMENT ON COLUMN campus_rooms.aliases IS
  'Alternate names and search keywords, e.g. {"IRC", "Innovation Center", "Research Lab"}.';

COMMENT ON COLUMN campus_rooms.floor_level IS
  'Human-readable floor label, e.g. "Ground Floor", "2nd Floor", "Basement".';

-- ---------------------------------------------------------------------------
-- Grants & PostgREST Schema Cache Reload
-- ---------------------------------------------------------------------------
GRANT ALL ON TABLE campus_rooms TO postgres, service_role;
GRANT SELECT ON TABLE campus_rooms TO authenticated;
GRANT ALL ON TABLE campus_rooms_with_building TO postgres, service_role;
GRANT SELECT ON TABLE campus_rooms_with_building TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
