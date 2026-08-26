-- =====================================================================
--  009 — Remove superseded POI place cards from the retrieval corpus
--
--  ONE-TIME CORRECTIVE DATA CHANGE. No schema change, no new object.
--
--  ------------------------------------------------------------------
--  THE DEFECT
--  ------------------------------------------------------------------
--  Place cards reached `document` by two routes that disagreed about
--  provenance:
--
--    the bulk import      source_origin = 'generated:poi'
--    campus-places-service source_origin = 'generated:poi:<poi uuid>'
--
--  The service deletes the previous card before writing a new one, but
--  matched only its own format. Reindexing a POI through the admin UI
--  therefore left the imported card in place and added a second,
--  near-identical one beside it. Six POIs accumulated a duplicate:
--
--    Bike Station, College of Agriculture, Graduate School,
--    ICT Center, University Infirmary, University Library
--
--  Nothing failed and nothing logged. The only visible symptom is at
--  query time: two chunks with almost the same embedding both score
--  highly, so one of the top-k retrieval slots is spent restating the
--  other. That lands on Context Precision, and it would have been
--  measured and reported as the retriever's quality.
--
--  The code path is fixed in
--  backend/src/services/campus-places-service.js, which now matches the
--  legacy format as well. This file cleans up the rows that route
--  already created.
--
--  ------------------------------------------------------------------
--  WHICH COPY SURVIVES
--  ------------------------------------------------------------------
--  The one written by campus-places-service, because its source_origin
--  names the POI it belongs to. The legacy row cannot be traced back to
--  a POI by anything except its title, which is exactly why the delete
--  missed it.
--
--  A legacy card is removed ONLY where a modern card for the same POI
--  exists. The other 22 place cards were never reindexed, so their only
--  copy is the legacy one and it must stay. This is the whole reason
--  for the `exists` clause below rather than a delete by source_origin.
-- =====================================================================

begin;
set search_path = geobot, public;

-- ---------------------------------------------------------------------
-- Report before changing anything, so the transcript shows what was
-- actually here rather than what was expected.
-- ---------------------------------------------------------------------
do $$
declare n integer;
begin
  select count(*) into n
    from document legacy
   where legacy.doc_type = 'poi_place_card'
     and legacy.source_origin = 'generated:poi'
     and exists (
       select 1 from document modern
        where modern.doc_type = 'poi_place_card'
          and modern.title = legacy.title
          and modern.source_origin like 'generated:poi:%');
  raise notice 'superseded place cards to remove: %', n;
end $$;

-- Chunks first: document_chunk.document_id has no cascade, and orphaned
-- chunks stay retrievable, which would leave the defect in place while
-- looking fixed in the document table.
delete from document_chunk ch
 using document legacy
 where ch.document_id = legacy.id
   and legacy.doc_type = 'poi_place_card'
   and legacy.source_origin = 'generated:poi'
   and exists (
     select 1 from document modern
      where modern.doc_type = 'poi_place_card'
        and modern.title = legacy.title
        and modern.source_origin like 'generated:poi:%');

delete from document legacy
 where legacy.doc_type = 'poi_place_card'
   and legacy.source_origin = 'generated:poi'
   and exists (
     select 1 from document modern
      where modern.doc_type = 'poi_place_card'
        and modern.title = legacy.title
        and modern.source_origin like 'generated:poi:%');

-- ---------------------------------------------------------------------
-- Verify the corpus is now one card per POI, and that nothing was lost.
-- ---------------------------------------------------------------------
do $$
declare dupes integer; cards integer; pois integer; orphans integer;
begin
  select count(*) into dupes from (
    select title from document where doc_type = 'poi_place_card'
     group by title having count(*) > 1) x;

  select count(*) into cards from document where doc_type = 'poi_place_card';
  select count(*) into pois  from poi;

  select count(*) into orphans from document_chunk ch
   where not exists (select 1 from document d where d.id = ch.document_id);

  raise notice 'place cards: %, POIs: %, duplicate titles: %, orphan chunks: %',
    cards, pois, dupes, orphans;

  if dupes > 0 then
    raise exception 'still % duplicated place-card title(s)', dupes;
  end if;
  if orphans > 0 then
    raise exception '% orphaned chunk(s) left behind', orphans;
  end if;
  if cards <> pois then
    raise exception
      'place cards (%) no longer match POIs (%) -- a POI has lost its only '
      'card, which would make it unretrievable', cards, pois;
  end if;
end $$;

commit;
