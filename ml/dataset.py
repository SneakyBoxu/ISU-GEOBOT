"""
Training-row construction for the Random Forest.

Shared by train_rf.py and baseline_rule.py so both are evaluated on EXACTLY the
same rows. Comparing two classifiers on different samples is not a comparison.

SAMPLING SCHEME (audit F-21).
The thesis says "80-20 split with cross-validation" and stops there. That is not
a specification: how training rows are *generated* determines the class balance,
which determines the headline accuracy figure. The scheme here is explicit so it
can be written into Chapter 3 and defended:

    for each consented, active faculty member
      for each campus-local day in the semester window
        for each 30-minute slot inside OBSERVATION_HOURS

Rows outside teaching hours are excluded deliberately. Sampling all 48 daily
slots would swamp the set with trivially-Unavailable overnight rows and inflate
accuracy while telling you nothing about the decision the system actually makes.

LABELS (audit F-18, blocking question C4).
  schedule_derived   — labels from schedule_lookup_status(). Honest but
                       CIRCULAR when the features are also schedule-derived:
                       the forest is then learning the rule baseline and cannot
                       beat it. Usable for plumbing, NOT reportable as evidence
                       that ML outperforms rule-based lookup.
  attendance_derived — labels from real intraday attendance. What the thesis
                       actually describes. Requires check-in/check-out punches.

train_rf.py refuses to write metrics for a schedule_derived run unless it is
explicitly marked as a plumbing run.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, time

import db
from features import ContextRow, semester_phase_of

OBSERVATION_HOURS = (time(7, 0), time(19, 0))
SLOT_MINUTES = 30


@dataclass
class Sample:
    faculty_id: str
    pseudonym_id: str
    when: datetime
    context: ContextRow
    label: str


def _slots_for_day(d: date):
    start, end = OBSERVATION_HOURS
    cur = datetime.combine(d, start)
    stop = datetime.combine(d, end)
    while cur < stop:
        yield cur
        cur += timedelta(minutes=SLOT_MINUTES)


def load_roster() -> list[dict]:
    return db.fetch_all(
        """
        select f.id::text as faculty_id,
               m.pseudonym_id
        from geobot.faculty f
        join geobot.faculty_pseudonym_map m on m.faculty_id = f.id
        where f.is_active and f.is_consented
        order by f.id
        """
    )


def load_schedule(semester: str) -> dict[str, list[dict]]:
    rows = db.fetch_all(
        """
        select faculty_id::text as faculty_id, day_of_week,
               start_time, end_time, block_kind
        from geobot.faculty_schedule
        where semester = %s
        """,
        (semester,),
    )
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r["faculty_id"], []).append(r)
    return out


def load_events() -> dict[date, dict]:
    rows = db.fetch_all(
        "select event_date, event_type, disrupts_schedule from geobot.institutional_event"
    )
    return {r["event_date"]: r for r in rows}


def _block_at(blocks: list[dict], when: datetime) -> str | None:
    dow = (when.weekday() + 1) % 7
    t = when.time()
    hit = None
    for b in blocks:
        if b["day_of_week"] != dow:
            continue
        if b["start_time"] <= t < b["end_time"]:
            if b["block_kind"] == "class":
                return "class"
            hit = b["block_kind"]
    return hit


def build_samples(
    semester: str,
    semester_start: date,
    semester_end: date,
    label_source: str = "schedule_derived",
) -> list[Sample]:
    if label_source not in ("schedule_derived", "attendance_derived"):
        raise ValueError("label_source must be schedule_derived or attendance_derived")

    roster = load_roster()
    schedule = load_schedule(semester)
    events = load_events()
    attendance = _load_attendance_index() if label_source == "attendance_derived" else {}

    samples: list[Sample] = []
    day = semester_start
    while day <= semester_end:
        if day.weekday() == 6:  # skip Sundays
            day += timedelta(days=1)
            continue

        ev = events.get(day)
        campus_event = 1 if ev and ev["disrupts_schedule"] else 0
        exam_period = 1 if ev and ev["event_type"] == "exam_period" else 0
        phase = semester_phase_of(datetime.combine(day, time(0, 0)),
                                  semester_start, semester_end)

        for person in roster:
            blocks = schedule.get(person["faculty_id"], [])
            for when in _slots_for_day(day):
                block = _block_at(blocks, when)
                ctx = ContextRow(
                    pseudonym_id=person["pseudonym_id"],
                    when=when,
                    is_consultation_hour=1 if block == "consultation" else 0,
                    is_scheduled_class=1 if block == "class" else 0,
                    exam_period_flag=exam_period,
                    campus_event_flag=campus_event,
                    semester_phase=phase,
                )

                if label_source == "schedule_derived":
                    label = _schedule_label(block, campus_event)
                else:
                    label = _attendance_label(
                        attendance, person["pseudonym_id"], when, block, campus_event
                    )
                    if label is None:
                        continue  # no observation for this slot; drop the row

                samples.append(
                    Sample(person["faculty_id"], person["pseudonym_id"], when, ctx, label)
                )
        day += timedelta(days=1)

    return samples


def _schedule_label(block: str | None, campus_event: int) -> str:
    if campus_event:
        return "unavailable_off_schedule"
    if block == "class":
        return "in_scheduled_class"
    if block in ("consultation", "admin"):
        return "available_consultation"
    return "unavailable_off_schedule"


def _load_attendance_index() -> dict:
    """
    Presence intervals per pseudonym, from intraday punches only.

    Audit F-18. A daily sign-in sheet yields one bit per day and CANNOT support
    intra-day labels: imputing them from the schedule would make the labels
    circular. Rows with granularity != 'intraday' are refused loudly rather
    than silently degraded.
    """
    rows = db.fetch_all(
        """
        select pseudonym_id, event_time, event_type, granularity
        from geobot.attendance_record
        order by pseudonym_id, event_time
        """
    )
    if not rows:
        raise RuntimeError(
            "label_source='attendance_derived' but attendance_record is empty. "
            "Audit C4: obtain real attendance data and confirm its granularity "
            "before training a reportable model."
        )
    bad = {r["granularity"] for r in rows} - {"intraday"}
    if bad:
        raise RuntimeError(
            f"attendance_record contains non-intraday granularity {sorted(bad)}. "
            "Daily sign-in sheets cannot produce intra-day availability labels "
            "without imputing them from the schedule, which is circular "
            "(audit F-18). Either obtain intraday punches or change the ML "
            "formulation and amend Chapter 3."
        )

    index: dict[str, list[tuple[datetime, datetime]]] = {}
    open_at: dict[str, datetime] = {}
    for r in rows:
        pid = r["pseudonym_id"]
        if r["event_type"] == "check_in":
            open_at[pid] = r["event_time"]
        elif pid in open_at:
            index.setdefault(pid, []).append((open_at.pop(pid), r["event_time"]))
    return index


def _attendance_label(index, pseudonym, when, block, campus_event) -> str | None:
    intervals = index.get(pseudonym)
    if not intervals:
        return None
    present = any(s <= when < e for s, e in intervals)
    if not present:
        return "unavailable_off_schedule"
    if campus_event:
        return "unavailable_off_schedule"
    if block == "class":
        return "in_scheduled_class"
    return "available_consultation"
