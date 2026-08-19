"""
Feature engineering for the Random Forest availability classifier.

SINGLE SOURCE OF TRUTH. train_rf.py and app.py both import from here, so the
training and serving feature vectors cannot drift. Train/serve skew is the
quietest and most damaging bug in a deployed classifier — it produces a model
that scores well offline and behaves randomly in the live demo.

Feature set (thesis §3.5.2 categories a, c, d + build brief):
    day_of_week          0=Sunday .. 6=Saturday
    time_slot            30-minute bucket index, 0..47
    is_consultation_hour 1 if the queried time falls in a consultation block
    is_scheduled_class   1 if it falls in a teaching block
    exam_period_flag     1 on an institutional exam-period day
    campus_event_flag    1 on a schedule-disrupting institutional event
    semester_phase       0=early 1=mid 2=finals
    faculty_ordinal      stable ordinal encoding of the PSEUDONYM (never a name)

Thesis §3.5.2 category (b) — historical attendance patterns capturing
"individual tendencies toward punctuality, early departure, or extended office
hours" — is IMPLEMENTED BUT OFF BY DEFAULT. See ATTENDANCE_FEATURES and
docs/OPEN_DECISIONS.md item 1.

Why it is off: the build brief's feature list omits attendance entirely. With
schedule-derived features AND schedule-derived labels, the forest reproduces
schedule_lookup_status() by construction and cannot outperform baseline_rule.py
— it *is* baseline_rule.py with a faculty column. Switching these on is what
makes the model something other than the rule baseline, and it requires
attendance data with intraday granularity (audit C4 / F-18).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time

# ---------------------------------------------------------------------------
# Feature contract
# ---------------------------------------------------------------------------

SCHEDULE_FEATURES = [
    "day_of_week",
    "time_slot",
    "is_consultation_hour",
    "is_scheduled_class",
    "exam_period_flag",
    "campus_event_flag",
    "semester_phase",
    "faculty_ordinal",
]

# Thesis §3.5.2(b). Enabled only when real intraday attendance exists.
ATTENDANCE_FEATURES = [
    "hist_presence_rate",      # P(signed in | this weekday+slot), per faculty
    "hist_punctuality_rate",   # P(check-in <= scheduled start), per faculty
    "hist_early_departure_rate",
]

CLASS_ORDER = [
    "available_consultation",
    "in_scheduled_class",
    "unavailable_off_schedule",
]

SEMESTER_PHASES = {"early": 0, "mid": 1, "finals": 2}

SLOT_MINUTES = 30
SLOTS_PER_DAY = 24 * 60 // SLOT_MINUTES  # 48


def feature_names(include_attendance: bool = False) -> list[str]:
    return SCHEDULE_FEATURES + (ATTENDANCE_FEATURES if include_attendance else [])


def time_slot(t: time) -> int:
    """30-minute bucket index, 0..47."""
    return (t.hour * 60 + t.minute) // SLOT_MINUTES


def semester_phase_of(when: datetime, semester_start, semester_end) -> int:
    """
    Coarse phase. Thesis §3.5.2(d): "proximity to examination periods or
    semester breaks, which historically correlate with changes in presence".
    Last 3 weeks of term = 'finals'; first 4 = 'early'; otherwise 'mid'.
    """
    if semester_start is None or semester_end is None:
        return SEMESTER_PHASES["mid"]
    d = when.date() if isinstance(when, datetime) else when
    total = (semester_end - semester_start).days or 1
    elapsed = (d - semester_start).days
    if elapsed <= 28:
        return SEMESTER_PHASES["early"]
    if (total - elapsed) <= 21:
        return SEMESTER_PHASES["finals"]
    return SEMESTER_PHASES["mid"]


@dataclass
class FacultyEncoder:
    """
    Stable ordinal encoding of pseudonymous faculty ids.

    Persisted inside the model artifact so serving reproduces training exactly.
    Unknown pseudonym at inference time -> -1, which the forest treats as its
    own branch rather than silently colliding with an existing faculty member.

    Audit F-19: the value encoded here is the PSEUDONYM from
    faculty_pseudonym_map, never a name and never the faculty UUID.
    """

    categories: list[str] = field(default_factory=list)

    def fit(self, pseudonyms) -> "FacultyEncoder":
        self.categories = sorted({p for p in pseudonyms if p})
        return self

    def transform(self, pseudonym: str | None) -> int:
        if not pseudonym:
            return -1
        try:
            return self.categories.index(pseudonym)
        except ValueError:
            return -1


@dataclass
class ContextRow:
    """Everything needed to build one feature vector, resolved from the DB."""

    pseudonym_id: str | None
    when: datetime
    is_consultation_hour: int = 0
    is_scheduled_class: int = 0
    exam_period_flag: int = 0
    campus_event_flag: int = 0
    semester_phase: int = SEMESTER_PHASES["mid"]
    hist_presence_rate: float = 0.0
    hist_punctuality_rate: float = 0.0
    hist_early_departure_rate: float = 0.0


def build_vector(
    row: ContextRow,
    encoder: FacultyEncoder,
    include_attendance: bool = False,
) -> list[float]:
    """Ordered feature vector. Order MUST match feature_names()."""
    vec = [
        # Python weekday() is Mon=0..Sun=6; the DB's day_of_week is Sun=0..Sat=6.
        # Convert so training rows and live inference agree with faculty_schedule.
        float((row.when.weekday() + 1) % 7),
        float(time_slot(row.when.time())),
        float(row.is_consultation_hour),
        float(row.is_scheduled_class),
        float(row.exam_period_flag),
        float(row.campus_event_flag),
        float(row.semester_phase),
        float(encoder.transform(row.pseudonym_id)),
    ]
    if include_attendance:
        vec += [
            float(row.hist_presence_rate),
            float(row.hist_punctuality_rate),
            float(row.hist_early_departure_rate),
        ]
    return vec
