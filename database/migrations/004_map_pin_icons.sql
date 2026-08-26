-- =====================================================================
--  004 — Per-location icon
--
--  A location may override the glyph its category would otherwise give
--  it. The Bike Station is a `facility`, and so is the canteen and the
--  dormitory; drawing all three with the same building outline is
--  accurate and useless.
--
--  NULLABLE ON PURPOSE. The category icon is the default and stays the
--  default: this column exists to say "this one is different", not to
--  make someone choose a picture for twenty-eight buildings before the
--  map works. Nothing breaks if it is never set.
--
--  The value is a NAME, not markup and not a URL — it indexes a fixed
--  allowlist in the frontend (frontend/src/components/main-assistant/…).
--  Storing a class string, as the reference project does with
--  `fas fa-bicycle`, would put a third-party icon library's API into the
--  database and make swapping icon sets a data migration. A name that
--  the allowlist does not recognise falls back to the category icon, so
--  a stale value degrades rather than breaks.
-- =====================================================================

begin;
set search_path = geobot, public;

alter table poi add column if not exists icon text;

alter table poi drop constraint if exists poi_icon_check;
alter table poi add constraint poi_icon_check
  check (icon is null or icon ~ '^[a-z][a-z0-9-]{0,39}$');

comment on column poi.icon is
  'Optional icon NAME overriding the category default. Resolved against a '
  'fixed allowlist in the frontend; unknown values fall back to the category '
  'icon. Never markup, never a URL, never a third-party CSS class.';

-- ---------------------------------------------------------------------
-- Sensible defaults for the locations whose category glyph is actively
-- misleading. Everything not listed keeps its category icon, which is
-- the point of the column being nullable.
--
-- Matched on slug, so this is safe to re-run and safe to run before or
-- after anyone has set overrides by hand — `where icon is null` means a
-- deliberate choice in the portal is never overwritten by a migration.
-- ---------------------------------------------------------------------
update poi p set icon = v.icon
  from (values
  ('bike-station', 'bike'),
  ('canteen', 'utensils'),
  ('university-infirmary', 'stethoscope'),
  ('oval', 'trophy'),
  ('open-gymnasium', 'dumbbell'),
  ('cvcdc', 'nut'),
  ('ict-center', 'cpu'),
  ('university-library', 'book-open'),
  ('main-gate', 'shield'),
  ('student-plaza', 'users'),
  ('library-park', 'trees'),
  ('security-park', 'trees'),
  ('amphitheater', 'music'),
  ('college-engineering', 'wrench'),
  ('college-agriculture', 'wheat'),
  ('graduate-school', 'graduation-cap'),
  ('college-criminal-justice', 'scale'),
  ('emcc', 'wrench'),
  ('dormitory', 'building'),
  ('registrar', 'landmark'),
  ('alba-hall', 'music'),
  ('de-venecia-hall', 'presentation'),
  ('college-computing', 'cpu'),
  ('college-education', 'presentation'),
  ('college-business', 'store'),
  ('college-arts-sciences', 'microscope'),
  ('cashier-office', 'landmark'),
  ('admin-building', 'landmark')
) as v(slug, icon)
 where p.slug = v.slug
   and p.icon is null;

commit;

-- =====================================================================
--  AFTER RUNNING THIS
--
--  Nothing else is required. Every existing location keeps its category
--  icon until someone sets an override in the Campus Location portal.
--
--  Place-cards do NOT need regenerating: the icon is presentation and is
--  deliberately absent from the retrieval corpus. A building is not
--  easier to find because the assistant knows it is drawn with a bicycle.
-- =====================================================================
