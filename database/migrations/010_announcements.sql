-- =====================================================================
--  010 - Retire the legacy announcement ingestion table
--
--  Availability source documents are private operational inputs. They must
--  not be persisted as announcements or embedded into the searchable corpus.
--  This migration removes the superseded table if an earlier development
--  version created it; availability-event storage is introduced by 011.
-- =====================================================================

begin;
set search_path = geobot, public, extensions;

drop table if exists geobot.announcements;

commit;
