import { CheckCircle2, GraduationCap, MinusCircle } from 'lucide-react';

/**
 * Status presentation.
 *
 * `label` is the display wording from the build brief. `thesisLabel` is the
 * §3.9 evaluated wording. Both are kept because they differ, and the deviation
 * is a live researcher decision (docs/OPEN_DECISIONS.md item 2) — not
 * something the UI should quietly pick a side on.
 *
 * Audit §4.3: there is deliberately NO confidence level, percentage or
 * High/Medium/Low badge here. Displaying confidence creates an evaluation
 * obligation the thesis does not plan for and hands the panel a metric that
 * cannot be defended.
 */
export const STATUS = {
  available_consultation: {
    label: 'Available for Consultation',
    thesisLabel: 'Available for Consultation',
    icon: CheckCircle2,
    tone: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
    dot: 'bg-brand-400',
  },
  in_scheduled_class: {
    label: 'In Scheduled Class / Lecture',
    thesisLabel: 'Currently in a Lecture',
    icon: GraduationCap,
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  unavailable_off_schedule: {
    label: 'Unavailable / Off-Schedule',
    thesisLabel: 'Unavailable',
    icon: MinusCircle,
    tone: 'border-ink-600 bg-ink-800 text-ink-300',
    dot: 'bg-ink-400',
  },
};

// ISU Echague Main Campus. Used only as an initial map view.
// Audit R4: real POI coordinates come from the on-site GPS survey (§3.4.1a).
// Placeholder POIs are marked [DEMO] by the API and rendered as such.
// The midpoint of the 28 surveyed campus locations. The previous value
// [16.7089, 121.6742] was left over from the synthetic placeholder set and was
// never updated when the real locations were imported — it sat 1.4km south-west
// of the campus, which is why the map opened on rice fields with the university
// off the right-hand edge.
//
// This is the FALLBACK. The workspace map fits itself to the actual bounds of
// whatever locations it loaded, so adding a building or correcting a coordinate
// during the GPS survey re-centres it without anyone editing this line.
export const CAMPUS_CENTER = [16.72142, 121.69050];
export const CAMPUS_ZOOM = 16;

export const POI_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'college', label: 'Colleges' },
  { key: 'administrative', label: 'Administrative' },
  { key: 'laboratory', label: 'Laboratories' },
  { key: 'library', label: 'Libraries' },
  { key: 'facility', label: 'Facilities' },
  { key: 'sports', label: 'Sports & Recreation' },
];
