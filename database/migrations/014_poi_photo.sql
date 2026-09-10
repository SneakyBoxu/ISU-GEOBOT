-- =====================================================================
--  014 — A photograph for each campus location
--
--  ------------------------------------------------------------------
--  WHY
--  ------------------------------------------------------------------
--  The place-detail card shows a glyph, a name, a category, a
--  description and a coordinate pair. For a navigation assistant that
--  is the missing half: a visitor standing in front of a building
--  identifies it from a photograph faster than from any sentence.
--
--  The image itself does NOT live here. poi.image_url holds a public
--  URL into the `campus-photos` storage bucket and nothing more.
--  GET /map/pois sends every marker to every visitor, and a base64
--  column would put hundreds of kilobytes per building into a payload
--  that currently carries twelve short fields.
--
--  ------------------------------------------------------------------
--  A PHOTOGRAPH OF A BUILDING IS NOT PERSONAL DATA
--  ------------------------------------------------------------------
--  Unlike the timetable and the attendance records elsewhere in this
--  schema, a picture of a building raises no consent question and
--  needs no data_origin distinction. It is the same class of
--  information as the coordinate already stored beside it.
--
--  ------------------------------------------------------------------
--  THE AUDIT CHECK, AND A BUG IT HAS BEEN HIDING
--  ------------------------------------------------------------------
--  poi_audit.action is constrained to five values. Two are added here
--  for the photo actions -- and a third, 'republish', which SHOULD
--  already have been there.
--
--  campus-places-service.js:341 writes audit('republish', ...) on
--  every republish. That value has never been accepted by the check,
--  so every one of those inserts has been rejected. Nobody noticed
--  because audit() swallows its own errors on purpose
--  (campus-places-service.js:179-183) -- an audit write must never
--  fail the operation it is recording. The cost is that the audit
--  trail has been quietly incomplete: this database holds 9 unpublish
--  rows and 0 republish rows.
--
--  Verify after applying:
--
--    select action, count(*) from geobot.poi_audit group by 1;
-- =====================================================================

begin;
set search_path = geobot, public;

-- 1. The photograph.
alter table poi add column if not exists image_url        text;
alter table poi add column if not exists image_alt        text;
alter table poi add column if not exists image_updated_at timestamptz;

comment on column poi.image_url is
  'Public URL of the location photograph in the campus-photos storage '
  'bucket. The bytes are never stored in this table: /map/pois returns '
  'every marker to every visitor.';

comment on column poi.image_alt is
  'Short alternative text for the photograph. Serves screen readers and '
  'the card caption. Deliberately NOT part of the place-card text -- the '
  'retrieval corpus takes prose, not interface captions.';

comment on column poi.image_updated_at is
  'When the photograph was last replaced. Null when there is none.';

-- 2. Widen the audit vocabulary.
alter table poi_audit drop constraint if exists poi_audit_action_check;

alter table poi_audit
  add constraint poi_audit_action_check
  check (action in ('create', 'update', 'delete',
                    'publish', 'unpublish', 'republish',
                    'photo', 'photo_removed'));

comment on constraint poi_audit_action_check on poi_audit is
  '''republish'' was missing and the service has been writing it since '
  'migration 002, silently failing every time. ''photo'' and '
  '''photo_removed'' are added for the location photograph.';

-- 3. Verification.
do $$
declare
  n_cols  integer;
  allowed text;
begin
  select count(*) into n_cols
    from information_schema.columns
   where table_schema = 'geobot' and table_name = 'poi'
     and column_name in ('image_url', 'image_alt', 'image_updated_at');
  if n_cols <> 3 then
    raise exception 'expected 3 photo columns on poi, found %', n_cols;
  end if;

  select pg_get_constraintdef(con.oid) into allowed
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'geobot'
     and rel.relname = 'poi_audit'
     and con.conname = 'poi_audit_action_check';

  if allowed is null or allowed not like '%republish%' then
    raise exception 'poi_audit_action_check did not take: %', allowed;
  end if;

  raise notice 'poi photo columns added; audit actions now: %', allowed;
end $$;

commit;
