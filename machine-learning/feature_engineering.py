"""
Feature engineering for the Random Forest availability classifier.

SINGLE SOURCE OF TRUTH. train_availability_model.py and ai_api_service.py both import from here, so the
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
hours" — lives in ATTENDANCE_FEATURES, behind the --attendance-features flag.

THE FLAG DEFAULTS TO OFF, BUT THE DEPLOYED MODEL WAS TRAINED WITH IT ON.
Do not read the default as a description of the shipped model. The record that
settles it is rf_model_version.feature_list, which for the current model reads:

    day_of_week, time_slot, is_consultation_hour, is_scheduled_class,
    exam_period_flag, campus_event_flag, semester_phase, faculty_ordinal,
    hist_presence_rate, hist_punctuality_rate, hist_early_departure_rate

The last three are this block. Every training run writes its own feature list
there, so the database — not this default — is the answer to "which features
did the model actually use?"

WHY THE FLAG EXISTS AT ALL. With schedule-derived features AND schedule-derived
labels, the forest reproduces schedule_lookup_status() by construction and
cannot outperform schedule_rule_baseline.py — it *is* that baseline with a
faculty column. Turning attendance on is what makes the model something other
than the rule baseline, and it requires attendance with intraday granularity
(audit C4 / F-18). The synthetic cohort supplies exactly that, which is why the
comparison in thesis §4.4 is a real comparison and not a tautology.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time

# ---------------------------------------------------------------------------
# Feature contract
# ---------------------------------------------------------------------------

# THE ORDER OF THIS LIST IS THE MODEL'S INPUT CONTRACT. build_vector() below
# appends values in exactly this sequence, and the trained forest learned column
# 0 to mean day_of_week, column 1 to mean time_slot, and so on. Reorder either
# list without the other and every prediction is computed from the wrong
# columns -- no exception, no warning, just quietly wrong answers. The model
# artifact stores this list so serving can be checked against training.
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
    """The column names, in model order. Pairs with build_vector()."""
    # Attendance features are APPENDED, never interleaved. That is what lets a
    # schedule-only model and an attendance model share the first eight columns.
    return SCHEDULE_FEATURES + (ATTENDANCE_FEATURES if include_attendance else [])


def time_slot(t: time) -> int:
    """30-minute bucket index, 0..47."""
    # Thirty minutes is the resolution of the timetable itself -- classes start
    # on the hour or the half hour -- so a finer bucket would invent precision
    # the schedule does not have, and a coarser one would merge a class with the
    # consultation window beside it.
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
    # Four weeks in, three weeks out. The boundaries are deliberately coarse:
    # the feature is meant to capture "is this exam season" and nothing finer.
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
        # -1 for both "no pseudonym" and "never seen in training". Returning 0
        # instead would map an unknown lecturer onto whichever real one happens
        # to sort first, and the forest would answer confidently about the
        # wrong person. -1 is outside every trained branch, so the tree falls
        # back on the other features instead.
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
    # Every line below is positional. Deleting one shifts all the columns after
    # it left by one, and the forest then reads, say, exam_period_flag as though
    # it were semester_phase. sklearn will not complain -- the vector is still a
    # list of floats of plausible length -- so this is the one edit in this file
    # that breaks the model without breaking the program.
    vec = [
        # Python weekday() is Mon=0..Sun=6; the DB's day_of_week is Sun=0..Sat=6.
        # Convert so training rows and live inference agree with faculty_schedule.
        # Drop the "+ 1) % 7" and every day shifts by one: Monday's classes are
        # scored against Sunday's schedule, for training AND serving alike, so
        # the accuracy stays plausible and the answers are wrong all week.
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
