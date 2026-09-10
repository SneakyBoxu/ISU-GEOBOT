-- =====================================================================
--  015 — Remove a place card left behind by a POI rename
--
--  ------------------------------------------------------------------
--  WHAT HAPPENED
--  ------------------------------------------------------------------
--  reindexPoi() (campus-places-service.js) deletes the previous place
--  card before writing the new one. It matches two provenance forms:
--
--    generated:poi:<uuid>   written by this service — matched by id,
--                           so a rename cannot orphan it
--    generated:poi          written by the original bulk import — it
--                           carries no identifier, so within that set
--                           the TITLE is the only handle on the POI
--
--  The POI "College of Teacher Education" was renamed to "College of
--  Education". The reindex that followed looked for a legacy card
--  titled 'Place card — College of Education', found none, and wrote a
--  fresh id-stamped card. The legacy card under the OLD title was never
--  matched again by anything, and stayed in the corpus.
--
--  ------------------------------------------------------------------
--  WHY IT MATTERED
--  ------------------------------------------------------------------
--  The card is embedded, so retrieval could return a college that is
--  not on the map and has no POI row — the assistant describing a
--  building a visitor cannot be directed to. It also consumed one of
--  the five top-k slots, which lands on Context Precision.
--
--  This is residue from a single historical rename, not an ongoing
--  defect: every card written since carries the id form and is
--  rename-safe. No code change is required.
-- =====================================================================

begin;
set search_path = geobot, public;

delete from document_chunk
where document_id in (
  select id from document
  where doc_type = 'poi_place_card'
    and source_origin = 'generated:poi'
    and title not in (select 'Place card — ' || name from poi)
);

delete from document
where doc_type = 'poi_place_card'
  and source_origin = 'generated:poi'
  and title not in (select 'Place card — ' || name from poi);

do $$
declare n integer;
begin
  select count(*) into n
  from document
  where doc_type = 'poi_place_card'
    and title not in (select 'Place card — ' || name from poi);
  if n > 0 then
    raise exception 'still % place card(s) with no matching POI', n;
  end if;
  raise notice 'no orphaned place cards remain';
end $$;

commit;
