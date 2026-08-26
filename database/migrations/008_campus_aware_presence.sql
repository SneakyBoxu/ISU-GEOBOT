-- =====================================================================
--  008 — Presence resolution knows which campus it is answering for
--
--  Migration 005 added faculty_schedule.campus because 11 of the 37
--  CCSICT lecturers also teach in Santiago City. schedule_lookup_status()
--  was never taught to read it, so a Santiago class resolved as:
--
--      ('in_scheduled_class', 'class', false, null)
--
--  "In a scheduled class" means, to every caller, in a class HERE. The
--  system was telling a student standing outside an Echague office that
--  the lecturer was in a lecture, while the lecturer was two hours away.
--  That is not a missing feature; it is a false statement about a real
--  person, and it is exactly what the campus column was added to stop.
--
--  It also contaminates the comparison the thesis rests on.
--  schedule_rule_baseline.py calls this function, so the rule-based floor
--  was being scored on answers that were wrong for a reason unrelated to
--  rules-versus-model.
--
--  ------------------------------------------------------------------
--  THE NEW BLOCK KIND
--  ------------------------------------------------------------------
--  A block on another campus returns status 'unavailable_off_schedule'
--  with matched_block = 'class_other_campus'.
--
--  The status has to be one of the three availability_status codes, so
--  'unavailable' is the only honest choice: the person is not available
--  on this campus. But 'unavailable_off_schedule' alone loses WHY, and
--  "not available" reads as "not working today" when the truth is
--  "teaching, elsewhere". The distinct matched_block lets the assistant
--  phrase it correctly without inventing a fourth status class the
--  classifier was never trained on.
--
--  ------------------------------------------------------------------
--  WHY THE DROP
--  ------------------------------------------------------------------
--  Adding a defaulted parameter does NOT replace a function in Postgres,
--  it overloads it. A four-argument call would then match the old
--  function exactly and the new one via its default, and fail with
--  "function is not unique". Every existing caller passes four
--  arguments, so the old signature is dropped first and the default
--  keeps them all working unchanged.
-- =====================================================================

begin;
set search_path = geobot, public;

drop function if exists geobot.schedule_lookup_status(uuid, timestamptz, text, text);

create or replace function geobot.schedule_lookup_status(
  p_faculty_id  uuid,
  p_at          timestamptz default now(),
  p_semester    text default null,
  p_timezone    text default 'Asia/Manila',
  p_campus      text default 'echague'
)
returns table (
  status_code       text,
  matched_block     text,
  is_event_day      boolean,
  event_type        text
)
language plpgsql
stable
as $$
declare
  v_local     timestamp;
  v_dow       smallint;
  v_time      time;
  v_date      date;
  v_block     text;
  v_campus    text;
  v_event     text;
  v_disrupts  boolean := false;
begin
  v_local := p_at at time zone p_timezone;
  v_dow   := extract(dow from v_local)::smallint;
  v_time  := v_local::time;
  v_date  := v_local::date;

  select ie.event_type, ie.disrupts_schedule
    into v_event, v_disrupts
  from geobot.institutional_event ie
  where ie.event_date = v_date
    and ie.disrupts_schedule
  limit 1;

  if v_event is not null then
    return query select 'unavailable_off_schedule'::text, null::text, true, v_event;
    return;
  end if;

  -- A block on the queried campus wins over one elsewhere at the same
  -- moment. The timetable should not contain both, but if it ever does,
  -- being local is the more specific answer.
  select fs.block_kind, fs.campus
    into v_block, v_campus
  from geobot.faculty_schedule fs
  where fs.faculty_id = p_faculty_id
    and fs.day_of_week = v_dow
    and v_time >= fs.start_time
    and v_time <  fs.end_time
    and (p_semester is null or fs.semester = p_semester)
  order by (fs.campus is not distinct from p_campus) desc,
           case fs.block_kind
             when 'class' then 1 when 'consultation' then 2 else 3 end
  limit 1;

  if v_block is null then
    return query select 'unavailable_off_schedule'::text, null::text, false, null::text;
    return;
  end if;

  if v_campus is distinct from p_campus then
    return query select 'unavailable_off_schedule'::text,
                        'class_other_campus'::text, false, null::text;
    return;
  end if;

  if v_block = 'class' then
    return query select 'in_scheduled_class'::text, v_block, false, null::text;
  elsif v_block in ('consultation','admin') then
    return query select 'available_consultation'::text, v_block, false, null::text;
  else
    return query select 'unavailable_off_schedule'::text, null::text, false, null::text;
  end if;
end;
$$;

comment on function geobot.schedule_lookup_status is
  'Audit F-20 / C12. The rule-based comparison floor. If the Random Forest '
  'cannot beat this, that is a finding worth knowing BEFORE the panel finds it. '
  'p_campus (migration 008): a block on another campus is not availability '
  'here -- it returns unavailable_off_schedule with matched_block '
  '''class_other_campus'', so a caller can say "teaching, not on this campus" '
  'rather than the false "in a lecture" this function used to return for the '
  '11 lecturers who teach on both.';

commit;
