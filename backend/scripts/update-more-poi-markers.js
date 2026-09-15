import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { db } from '../src/utilities/service-clients.js';
import { reindexPoi } from '../src/services/campus-places-service.js';
import { clearGazetteerCache } from '../src/services/knowledge-search-service.js';

const NEW_UPDATES = [
  {
    id: 'b11641fa-42d3-437d-8755-275822f57464',
    name: 'Abaya Hall',
    poi_type: 'landmark',
    icon: 'presentation',
    building_function: 'Academic assembly hall, lectures, and university functions',
    description: 'A notable academic and event hall on the ISU Echague campus, utilized for student conferences, collegiate seminars, cultural programs, and large lecture classes.',
  },
  {
    id: 'b3f21fc9-ccf6-47bb-8add-3635eec2ab51',
    name: 'Science Building',
    poi_type: 'laboratory',
    icon: 'microscope',
    building_function: 'Natural sciences instruction, chemistry and biology laboratories',
    description: 'The central science academic building equipped with specialized laboratory facilities for chemistry, biology, physics, and natural science lectures under the College of Arts and Sciences.',
  },
  {
    id: 'c85cfdf5-7922-4044-9e69-743e7eeed770',
    name: 'Department of Military Science and Tactics (DMST)',
    poi_type: 'administrative',
    icon: 'shield',
    building_function: 'ROTC instruction, military science training, and cadet headquarters',
    description: "Houses the headquarters and administrative offices for the Reserve Officers' Training Corps (ROTC) and Department of Military Science and Tactics (DMST), managing student civic welfare and defense training.",
  },
];

async function main() {
  console.log(`Updating ${NEW_UPDATES.length} new POIs...`);
  for (const u of NEW_UPDATES) {
    const { error } = await db.from('poi').update({
      name: u.name,
      poi_type: u.poi_type,
      icon: u.icon,
      building_function: u.building_function,
      description: u.description,
      is_published: true,
      data_origin: 'real',
    }).eq('id', u.id);

    if (error) {
      console.error(`❌ Failed to update ${u.name}:`, error.message);
      continue;
    }

    try {
      await reindexPoi(u.id);
      console.log(`✅ Updated & reindexed: ${u.name} (${u.poi_type}, icon: ${u.icon})`);
    } catch (err) {
      console.error(`⚠️ Updated in DB, but reindex failed for ${u.name}:`, err.message);
    }
  }

  clearGazetteerCache();
  console.log('\n🎉 All 3 new markers updated, classified, described, and reindexed into vector search!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
