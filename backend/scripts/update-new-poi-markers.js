import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { db } from '../src/utilities/service-clients.js';
import { reindexPoi } from '../src/services/campus-places-service.js';
import { clearGazetteerCache } from '../src/services/knowledge-search-service.js';

const NEW_UPDATES = [
  {
    id: '2cfe2158-063e-4f6b-a6c1-12cdc0913b51',
    name: 'BSHRTM Laboratory',
    poi_type: 'laboratory',
    icon: 'utensils',
    building_function: 'Hospitality, culinary arts, and hotel & restaurant simulation laboratory',
    description: 'A specialized skills training laboratory for the Hotel, Restaurant, and Tourism Management (BSHRTM) program under CBAPA, equipped with commercial kitchens, dining simulation suites, and hospitality service practice areas.',
  },
  {
    id: '4b10d20a-fa46-44f9-83aa-6b9848acd92e',
    name: 'ISU-PAGASA Agrometeorological and Radar Station',
    poi_type: 'laboratory',
    icon: 'leaf',
    building_function: 'Weather forecasting, Doppler radar tracking, and agrometeorological climate monitoring',
    description: 'A joint facility operated by Isabela State University and DOST-PAGASA equipped with a high-resolution Doppler weather radar and agrometeorological sensors to monitor regional typhoons, rainfall distribution, and agricultural climate risks.',
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
  console.log('\n🎉 New markers updated, classified, described, and reindexed into vector search!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
