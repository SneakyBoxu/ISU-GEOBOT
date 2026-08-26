import {
  Bike, BookOpen, Building2, Church, Coffee, Cpu, Dumbbell, FlaskConical,
  GraduationCap, Landmark, Leaf, MapPin, Microscope, Music, Nut, ParkingCircle,
  Presentation, Scale, ShieldCheck, Stethoscope, Store, Trees, Trophy, Users,
  Utensils, Wheat, Wrench,
} from 'lucide-react';

/**
 * The letter each location category is drawn with.
 *
 * Shared between the map markers, the map legend and the campus index, because
 * the whole point of the letter is that it means the same thing everywhere. Two
 * copies of this table is one copy away from a legend that lies.
 *
 * Categories are distinguished by LETTER rather than by colour so the reading
 * survives greyscale, colour blindness and a printed appendix. Category colour
 * lives in `categoryColor` below and only ever REINFORCES the letter, which is
 * why this table holds letters and the colours are kept separate from it.
 */
export const TYPE_LETTER = {
  college: 'C',
  administrative: 'A',
  laboratory: 'L',
  library: 'B',
  facility: 'F',
  landmark: 'M',
  sports: 'S',
  other: '·',
};

export function glyphFor(type) {
  return TYPE_LETTER[type] ?? '·';
}

/**
 * The CSS custom property carrying each category's ink.
 *
 * A property name rather than a colour, so the value is whatever the active
 * theme says it is — the same call site serves day and night, and nothing in a
 * component ever names a hue.
 *
 * Colour here is REINFORCEMENT for the letter, never a replacement. Every
 * surface that paints one of these also draws `TYPE_LETTER`, which is what
 * keeps the categories legible in greyscale, under colour blindness, and in a
 * printed appendix.
 */
const TYPE_VAR = {
  college: '--cat-college',
  administrative: '--cat-administrative',
  laboratory: '--cat-laboratory',
  library: '--cat-library',
  facility: '--cat-facility',
  landmark: '--cat-landmark',
  sports: '--cat-sports',
  other: '--cat-other',
};

/**
 * A glyph per category, for surfaces with room for one.
 *
 * Icons appear on the location card, where there is space to read them and a
 * title beside them saying what they mean. They are NOT on the map pins: at
 * 28px a flask and a trophy are the same smudge, and the legend that decodes
 * them would have to be a picture dictionary. The pins keep the letter, which
 * a one-line legend can explain and which stays itself at any size.
 */
export const TYPE_ICON = {
  college: GraduationCap,
  administrative: Landmark,
  laboratory: FlaskConical,
  library: BookOpen,
  facility: Building2,
  landmark: Trees,
  sports: Trophy,
  other: MapPin,
};

/**
 * The icons a Campus Location administrator may choose from.
 *
 * A fixed allowlist, keyed by a short stable NAME. The database stores the
 * name; this table owns what it looks like. That is the whole reason it is not
 * a CSS class in a column — swapping icon sets later is an edit to this file,
 * not a migration over every row, and an unrecognised name degrades to the
 * category default instead of rendering nothing.
 */
export const ICON_CHOICES = [
  ['graduation-cap', 'Academic', GraduationCap],
  ['presentation', 'Lecture hall', Presentation],
  ['book-open', 'Library', BookOpen],
  ['flask', 'Laboratory', FlaskConical],
  ['microscope', 'Research', Microscope],
  ['cpu', 'Computing / ICT', Cpu],
  ['wrench', 'Engineering / workshop', Wrench],
  ['wheat', 'Agriculture', Wheat],
  ['nut', 'Cacao / processing', Nut],
  ['leaf', 'Nursery / greenhouse', Leaf],
  ['landmark', 'Administration', Landmark],
  ['scale', 'Law / criminal justice', Scale],
  ['building', 'General building', Building2],
  ['store', 'Shop / cooperative', Store],
  ['utensils', 'Canteen / dining', Utensils],
  ['coffee', 'Café', Coffee],
  ['stethoscope', 'Clinic / infirmary', Stethoscope],
  ['users', 'Student centre', Users],
  ['music', 'Auditorium / performance', Music],
  ['church', 'Chapel', Church],
  ['trophy', 'Sports', Trophy],
  ['dumbbell', 'Gymnasium', Dumbbell],
  ['trees', 'Park / green space', Trees],
  ['bike', 'Bicycles / transport', Bike],
  ['parking', 'Parking', ParkingCircle],
  ['shield', 'Security / gate', ShieldCheck],
  ['pin', 'Generic marker', MapPin],
];

const ICON_BY_NAME = Object.fromEntries(ICON_CHOICES.map(([k, , C]) => [k, C]));

/**
 * The icon for a location: its own override if it set one and the name is
 * still recognised, otherwise the icon its category implies.
 */
export function iconFor(type, icon) {
  return ICON_BY_NAME[icon] ?? TYPE_ICON[type] ?? TYPE_ICON.other;
}

/** `rgb(var(--cat-x))`, optionally at an alpha. */
export function categoryColor(type, alpha) {
  const v = TYPE_VAR[type] ?? TYPE_VAR.other;
  return alpha === undefined ? `rgb(var(${v}))` : `rgb(var(${v}) / ${alpha})`;
}
