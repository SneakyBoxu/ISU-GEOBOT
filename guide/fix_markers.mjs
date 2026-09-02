/**
 * Fill in the campus markers that have no description, and correct a few
 * names and types.
 *
 *   node guide/fix_markers.mjs --dry
 *   node guide/fix_markers.mjs --run
 *
 * Every write goes through reindexPoi() rather than a raw UPDATE, so the
 * generated place-card is regenerated and re-embedded in the same operation.
 * That is the invariant campus-places-service exists to hold: the map and the
 * retrieval corpus must never disagree about a place.
 *
 * WHAT IS AND IS NOT INVENTED. A "College of X" is described as offering
 * instruction in X, which is what the name means. CBAO and OSAS duties are
 * quoted from the ingested Student Manual. Centrum is described as a
 * classroom building because CENTRUM 1-4 appear as room labels in the real
 * CCSICT timetable. Nothing else is asserted -- see the NEEDS_YOUR_INPUT list
 * at the bottom for the ones with no source to draw on.
 */

import { db } from '../backend/src/utilities/service-clients.js';
import { reindexPoi } from '../backend/src/services/campus-places-service.js';

const DRY = !process.argv.includes('--run');

const UPDATES = [
  {
    slug: 'campus-business-affairs-office',
    building_function: 'Student ID processing and campus business transactions',
    description:
      'The Campus Business Affairs Office handles student ID processing, which '
      + 'is the final step of enrolment for freshmen and transferees. A student '
      + 'who has lost an ID applies for a replacement here after securing a '
      + 'Declaration of Loss from OSAS.',
    source: 'Student Manual §4.a.7 and §8.a.4',
  },
  {
    slug: 'centrum',
    name: 'Centrum',
    building_function: 'General-purpose classroom building',
    description:
      'The Centrum is a classroom building used for scheduled lectures across '
      + 'several programs. Its rooms appear on faculty timetables as Centrum 1 '
      + 'through Centrum 4.',
    source: 'room labels CENTRUM 1-4 in the CCSICT timetable',
  },
  {
    slug: 'college-of-medicine',
    name: 'College of Medicine',
    building_function: 'Medical education',
    description:
      'The College of Medicine provides instruction for the University\'s '
      + 'medicine program. It follows its own examination and enrolment dates '
      + 'in the academic calendar, separate from the undergraduate schedule.',
    source: 'the ISU academic calendar lists separate College of Medicine dates',
  },
  {
    slug: 'college-of-nursing',
    name: 'College of Nursing',
    building_function: 'Nursing education',
    description:
      'The College of Nursing provides instruction and clinical training for '
      + 'the University\'s nursing program.',
    source: 'name',
  },
  {
    slug: 'amphi-canteen',
    poi_type: 'facility',
    building_function: 'Dining and refreshments',
    description:
      'The Amphi Canteen is a dining facility beside the University '
      + 'Amphitheater, serving meals and refreshments to students and staff.',
    source: 'name and its position beside the Amphitheater',
  },
  {
    slug: 'faculty-canteen',
    poi_type: 'facility',
    building_function: 'Dining for faculty and staff',
    description:
      'The Faculty Canteen is a dining facility serving faculty and staff.',
    source: 'name',
  },
  {
    slug: 'grand-stand',
    building_function: 'Spectator seating for the athletic field',
    description:
      'The Grand Stand provides covered spectator seating overlooking the '
      + 'athletic field, and is used for intramurals, athletic meets and '
      + 'University ceremonies held outdoors.',
    source: 'name and its position at the Oval',
  },
  {
    slug: 'old-admin-building',
    building_function: 'Former administrative offices',
    description:
      'The Old Admin Building is the University\'s former administrative '
      + 'centre, retained for offices and support functions after management '
      + 'moved to the current Administrative Building.',
    source: 'name and the existence of a separate Administrative Building',
  },
];

// No source anywhere in the repository, the timetable or the ingested
// documents describes what these are. Guessing would put an invented fact on
// the map AND into the retrieval corpus, so they are listed instead.
const NEEDS_YOUR_INPUT = [
  ['climate-change', 'Climate Change',
   'Nothing in the timetable or the official documents says what this facility '
   + 'is. Likely a climate-change research centre, but that is a guess.'],
  ['simbulan', 'SIMBULAN',
   'A person-named pin added through the admin UI on 2026-08-26. Person-named '
   + 'locations are the hazard class behind the earlier Alado/Alamario map bug.'],
  ['alba-hall', 'Alba Hall',
   'Currently UNPUBLISHED, so it is absent from the map and has no place-card '
   + 'in the retrieval corpus. Republish it if that is not deliberate.'],
];

async function main() {
  console.log(DRY ? 'DRY RUN — nothing will be written\n' : 'APPLYING\n');

  for (const u of UPDATES) {
    const { data: poi } = await db
      .from('poi').select('id, name, poi_type').eq('slug', u.slug).maybeSingle();
    if (!poi) { console.log(`  SKIP ${u.slug} — not found`); continue; }

    const patch = { building_function: u.building_function, description: u.description };
    if (u.name && u.name !== poi.name) patch.name = u.name;
    if (u.poi_type && u.poi_type !== poi.poi_type) patch.poi_type = u.poi_type;

    const changes = [
      patch.name ? `name "${poi.name}" -> "${patch.name}"` : null,
      patch.poi_type ? `type ${poi.poi_type} -> ${patch.poi_type}` : null,
      'function + description',
    ].filter(Boolean).join(', ');
    console.log(`  ${u.slug}`);
    console.log(`     ${changes}`);
    console.log(`     grounded in: ${u.source}`);

    if (DRY) continue;

    patch.updated_at = new Date().toISOString();
    const { error } = await db.from('poi').update(patch).eq('id', poi.id);
    if (error) { console.log(`     UPDATE FAILED: ${error.message}`); continue; }
    const r = await reindexPoi(poi.id);
    console.log(`     re-embedded (${r.chunks} chunk${r.chunks === 1 ? '' : 's'})`);
  }

  console.log('\nNOT TOUCHED — no source to describe them from:');
  for (const [slug, name, why] of NEEDS_YOUR_INPUT) {
    console.log(`  ${slug} (${name})`);
    console.log(`     ${why}`);
  }
  process.exit(0);
}

main();
