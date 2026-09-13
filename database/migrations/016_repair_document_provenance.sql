-- =====================================================================
--  016 — Point document.provided_by at a script that exists
--
--  ------------------------------------------------------------------
--  WHAT WAS WRONG
--  ------------------------------------------------------------------
--  document.provided_by records WHICH TOOL ingested each document. It is
--  provenance, and the thesis leans on provenance throughout: data_origin
--  separates real from synthetic, source_origin records where a place
--  card came from, source_checksum pins the exact bytes.
--
--  Ten rows named 'ingest.py'. That file was renamed to
--  document_knowledge_importer.py during an earlier cleanup, and the
--  rename updated the filename but not the string the script writes into
--  the database. The corpus therefore attributed a third of its
--  documents to a tool that cannot be found, run, or inspected.
--
--  Nothing was functionally broken -- provided_by is never read by the
--  retrieval path. It is wrong as a RECORD, which is the part that
--  matters for a study that asks to be trusted on provenance.
--
--  The script itself is fixed in the same change, so new ingests write
--  the correct name and this migration is a one-off repair.
-- =====================================================================

begin;
set search_path = geobot, public;

update document
   set provided_by = 'document_knowledge_importer.py'
 where provided_by = 'ingest.py';

do $$
declare n integer;
begin
  select count(*) into n from document where provided_by = 'ingest.py';
  if n > 0 then
    raise exception '% document row(s) still name a nonexistent tool', n;
  end if;
  raise notice 'document provenance now names only tools that exist';
end $$;

commit;
