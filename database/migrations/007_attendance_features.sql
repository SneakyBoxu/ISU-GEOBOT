-- =====================================================================
--  007 — Historical attendance features, at serving time
--
--  Thesis §3.5.2(b). The Random Forest is trained with three features
--  derived from a person's attendance history:
--
--      hist_presence_rate         P(on campus | this weekday + slot)
--      hist_punctuality_rate      P(checked in by the first class)
--      hist_early_departure_rate  P(left before the last class ended)
--
--  TRAIN/SERVE SKEW, WHICH THIS EXISTS TO PREVENT.
--
--  dataset_loader.py computes these when it builds training rows. The
--  serving path did not: faculty-presence-service.js sent seven features
--  and the Flask service defaulted the rest to zero. The model's second
--  strongest feature was therefore always 0 in production while carrying
--  ~28% of the decision in training.
--
--  A model in that state scores well offline and drifts toward one class
--  live, with nothing in the logs to say why -- feature_engineering.py
--  names it "the quietest and most damaging bug in a deployed
--  classifier". One definition, in one place, called by both sides.
--
--  DEFINITION NOTE. The denominator is every non-Sunday date in the
--  observed attendance window sharing the target's weekday and falling
--  strictly BEFORE it. Strictly-before matters: including the target day
--  would let a person's presence inform the prediction about that same
--  presence, which inflates offline accuracy and cannot be reproduced at
--  inference, where the future has not happened yet.
-- =====================================================================

begin;
set search_path = geobot, public;

create or replace function geobot.attendance_features(
  p_pseudonym text,
  p_at        timestamptz,
  p_timezone  text default 'Asia/Manila'
)
returns table (
  hist_presence_rate        double precision,
  hist_punctuality_rate     double precision,
  hist_early_departure_rate double precision
)
language sql
stable
security definer
set search_path = geobot, public
as $$
  with target as (
    select (p_at at time zone p_timezone)                       as local_ts,
           (p_at at time zone p_timezone)::date                 as local_date,
           extract(dow from (p_at at time zone p_timezone))::int as dow,
           -- 30-minute bucket, matching SLOT_MINUTES in dataset_loader.py
           date_trunc('hour', (p_at at time zone p_timezone))
             + interval '30 min' * floor(
                 extract(minute from (p_at at time zone p_timezone)) / 30)
                                                                as slot_start
  ),
  -- Presence intervals, rebuilt from check_in / check_out pairs.
  paired as (
    select a.pseudonym_id,
           (a.event_time at time zone p_timezone) as ts,
           a.event_type,
           lead(a.event_time at time zone p_timezone)
             over (partition by a.pseudonym_id order by a.event_time) as next_ts,
           lead(a.event_type)
             over (partition by a.pseudonym_id order by a.event_time) as next_type
      from attendance_record a
     where a.pseudonym_id = p_pseudonym
       and a.granularity = 'intraday'
  ),
  intervals as (
    select ts as started, next_ts as ended, ts::date as on_date
      from paired
     where event_type = 'check_in' and next_type = 'check_out' and next_ts is not null
  ),
  -- Every observed day, so an absence counts against the rate rather than
  -- vanishing from it.
  observed as (
    select distinct (event_time at time zone p_timezone)::date as on_date
      from attendance_record
     where granularity = 'intraday'
  ),
  eligible as (
    select o.on_date
      from observed o, target t
     where extract(dow from o.on_date)::int = t.dow
       and o.on_date < t.local_date
  ),
  presence as (
    select count(*) filter (
             where exists (
               select 1 from intervals i, target t
                where i.on_date = e.on_date
                  and i.started <= (e.on_date + (t.slot_start - t.local_date::timestamp))
                  and i.ended   >  (e.on_date + (t.slot_start - t.local_date::timestamp))
             ))::double precision as hits,
           count(*)::double precision as obs
      from eligible e
  ),
  -- Punctuality and early departure are per-person habits, so they are taken
  -- across every prior teaching day rather than one weekday slot.
  day_edges as (
    select i.on_date,
           min(i.started) as arrived,
           max(i.ended)   as left_at
      from intervals i, target t
     where i.on_date < t.local_date
     group by i.on_date
  ),
  sched as (
    select s.day_of_week,
           min(s.start_time) as first_start,
           max(s.end_time)   as last_end
      from faculty_schedule s
      join faculty_pseudonym_map m on m.faculty_id = s.faculty_id
     where m.pseudonym_id = p_pseudonym
     group by s.day_of_week
  ),
  habits as (
    select
      count(*)::double precision as days,
      count(*) filter (where d.arrived <= (d.on_date + s.first_start))::double precision as punctual,
      count(*) filter (where d.left_at <  (d.on_date + s.last_end))::double precision   as early
      from day_edges d
      join sched s on s.day_of_week = extract(dow from d.on_date)::int
  )
  select
    case when p.obs   > 0 then p.hits / p.obs      else 0.0 end,
    case when h.days  > 0 then h.punctual / h.days else 0.0 end,
    case when h.days  > 0 then h.early / h.days    else 0.0 end
  from presence p, habits h;
$$;

comment on function geobot.attendance_features is
  'Thesis §3.5.2(b) features at inference time. Must stay consistent with '
  'dataset_loader.py, which computes the same three rates when building '
  'training rows. Divergence between them is train/serve skew: the model '
  'scores well offline and behaves differently live, with nothing in the logs '
  'to explain it.';

commit;
