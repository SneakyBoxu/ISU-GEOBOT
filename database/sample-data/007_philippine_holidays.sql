-- =====================================================================
--  007 — Philippine Nationwide & Institutional Holidays (2026)
--
--  Source: Official Philippine Proclamations for Regular & Special Holidays
--          and ISU Institutional Calendar 2026.
-- =====================================================================

begin;
set search_path = geobot, public;

insert into institutional_event (event_date, event_type, title, disrupts_schedule, data_origin)
values
  (date '2026-01-01', 'holiday', 'New Year''s Day', true, 'real'),
  (date '2026-02-25', 'holiday', 'EDSA People Power Revolution Anniversary', true, 'real'),
  (date '2026-04-02', 'holiday', 'Maundy Thursday', true, 'real'),
  (date '2026-04-03', 'holiday', 'Good Friday', true, 'real'),
  (date '2026-04-04', 'holiday', 'Black Saturday', true, 'real'),
  (date '2026-04-09', 'holiday', 'Araw ng Kagitingan (Day of Valor)', true, 'real'),
  (date '2026-05-01', 'holiday', 'Labor Day', true, 'real'),
  (date '2026-06-10', 'convocation', 'ISU University Foundation Day', true, 'real'),
  (date '2026-06-12', 'holiday', 'Independence Day (Araw ng Kasarinlan)', true, 'real'),
  (date '2026-08-21', 'holiday', 'Ninoy Aquino Day', true, 'real'),
  (date '2026-08-31', 'holiday', 'National Heroes Day (Araw ng mga Bayani)', true, 'real'),
  (date '2026-11-01', 'holiday', 'All Saints'' Day (Todos los Santos)', true, 'real'),
  (date '2026-11-02', 'holiday', 'All Souls'' Day', true, 'real'),
  (date '2026-11-30', 'holiday', 'Bonifacio Day', true, 'real'),
  (date '2026-12-08', 'holiday', 'Feast of the Immaculate Conception', true, 'real'),
  (date '2026-12-24', 'holiday', 'Christmas Eve', true, 'real'),
  (date '2026-12-25', 'holiday', 'Christmas Day', true, 'real'),
  (date '2026-12-30', 'holiday', 'Rizal Day', true, 'real'),
  (date '2026-12-31', 'holiday', 'Last Day of the Year', true, 'real')
on conflict (event_date, event_type) do update
  set title = excluded.title,
      disrupts_schedule = excluded.disrupts_schedule,
      data_origin = excluded.data_origin;

commit;
