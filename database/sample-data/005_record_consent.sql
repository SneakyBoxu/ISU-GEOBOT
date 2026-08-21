-- =====================================================================
--  005 — Recording faculty consent (RA 10173)
--
--  TEMPLATE. Run one block per person, AFTER they have signed.
--
--  ------------------------------------------------------------------
--  WHAT THIS ROW MEANS
--  ------------------------------------------------------------------
--  is_consented = true is a claim that a specific person signed a
--  specific form on a specific date. It is not a configuration switch.
--  The assistant will begin answering questions about anyone flipped
--  here, so the row is the difference between a study participant and
--  someone being discussed without their agreement.
--
--  Set it only from a signed form in your hand. consent_date is the
--  date on that form -- the schema enforces that one cannot exist
--  without the other (constraint consent_requires_date).
--
--  ------------------------------------------------------------------
--  A PILOT COHORT, NOT THE WHOLE ROSTER
--  ------------------------------------------------------------------
--  Scope: 3-5 CCSICT instructors or advisers who agree to take part.
--  The other ~33 stay is_consented = false ON PURPOSE.
--
--  That is not an unfinished job, it is the demonstration. A system that
--  answers about everyone proves nothing about its privacy boundary; a
--  system that answers about five people and declines for the rest
--  proves the boundary is real and enforced in code rather than
--  described in a chapter. Keep the unconsented majority, and say so in
--  Chapter 3 — it is evidence, not a gap.
--
--  It also shrinks the ethics burden honestly: informed consent from
--  five colleagues you can brief in person is a far stronger claim than
--  37 signatures gathered at speed.
--
--  ------------------------------------------------------------------
--  WHY NOTHING IS PRE-FILLED
--  ------------------------------------------------------------------
--  All 37 lecturers are currently is_consented = false, which is why
--  the assistant refuses every question about them. That refusal is the
--  system working. Flipping the flag to make a demo work would put a
--  false compliance record in a research database, and it would still
--  be there at the defense.
--
--  ------------------------------------------------------------------
--  WHAT THE FORM SHOULD SAY
--  ------------------------------------------------------------------
--  Enough for consent to be informed:
--    - what is collected (teaching schedule, and attendance if any)
--    - what a student can see: a generalised status only, never a room,
--      a building, or a history of where they have been
--    - that they can pause disclosure themselves at any time, at
--      /validate, without asking the researchers
--    - that pausing is separate from withdrawing from the study
--    - who to contact, and how to have their data removed
-- =====================================================================

begin;
set search_path = geobot, public;

-- ---------------------------------------------------------------------
-- The pilot cohort. One row per SIGNED form: name exactly as it appears
-- in the roster (comma included), and the date printed on that form.
--
--   select full_name from geobot.faculty
--    where data_origin = 'real' order by 1;
-- ---------------------------------------------------------------------
update faculty f
   set is_consented = true,
       consent_date = v.signed_on
  from (values
    ('SURNAME, FIRST M.',        date '2026-08-20'),   -- <- edit
    ('SURNAME, FIRST M.',        date '2026-08-20'),   -- <- edit
    ('SURNAME, FIRST M.',        date '2026-08-20')    -- <- edit
  ) as v(full_name, signed_on)
 where f.full_name = v.full_name
   and f.data_origin = 'real';

-- ---------------------------------------------------------------------
-- Confirm the cohort is what you intended.
--
-- Two failure modes, both silent without this: a name that matches
-- nothing updates zero rows and looks fine, and an accidental
-- broad update consents people who never signed.
-- ---------------------------------------------------------------------
do $$
declare n integer; names text;
begin
  select count(*), string_agg(full_name, '; ' order by full_name)
    into n, names
    from faculty where is_consented and data_origin = 'real';

  if n = 0 then
    raise exception
      'No rows updated -- the names did not match the roster. Check with: '
      'select full_name from geobot.faculty where data_origin = ''real'' order by 1;';
  end if;

  if n > 8 then
    raise exception
      '% faculty are now consented. That is far beyond a 3-5 pilot cohort. '
      'Roll this back and check the WHERE clause before committing.', n;
  end if;

  raise notice 'Pilot cohort (%): %', n, names;
  raise notice 'The remaining faculty stay unconsented, which is the '
               'privacy boundary the study demonstrates.';
end $$;

commit;


-- =====================================================================
--  WITHDRAWAL — the other half of consent
-- =====================================================================
--  A signature is a one-time act; RA 10173 also gives a data subject an
--  ongoing right to object. Being able to say "they can switch it off
--  themselves, here" is a far stronger answer at a defense than "they
--  can email us".
--
--  Faculty pause disclosure themselves at /validate. That sets
--  availability_visible = false and records the change in
--  faculty_visibility_event, so its effect on evaluation coverage can be
--  reported honestly instead of appearing as missing data.
--
--  Full withdrawal from the study, by hand:
--
--    update geobot.faculty
--       set is_consented = false, consent_date = null,
--           availability_visible = false
--     where full_name = 'SURNAME, FIRST M.';
--
--  Their schedule rows may stay -- a timetable is institutional record
--  keeping. Anything derived about the PERSON should go:
--
--    delete from geobot.attendance_record
--     where pseudonym_id = (
--       select m.pseudonym_id from geobot.faculty_pseudonym_map m
--       join geobot.faculty f on f.id = m.faculty_id
--       where f.full_name = 'SURNAME, FIRST M.');
--
-- =====================================================================
--  AFTER CONSENT EXISTS
-- =====================================================================
--  The assistant answers about consented faculty immediately -- the
--  router's gazetteer refreshes every 60 seconds.
--
--  For a REPORTABLE availability result you additionally need real
--  attendance for those people. Until then the model is trained on the
--  synthetic SIM-01..SIM-37 cohort, every metric is stamped
--  data_origin = 'synthetic', and the evaluation harness refuses any
--  test set containing faculty_availability or combined queries.
-- =====================================================================
