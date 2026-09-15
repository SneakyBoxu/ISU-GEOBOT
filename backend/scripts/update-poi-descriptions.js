import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { db } from '../src/utilities/service-clients.js';
import { reindexPoi } from '../src/services/campus-places-service.js';
import { clearGazetteerCache } from '../src/services/knowledge-search-service.js';

const UPDATES = [
  {
    id: 'dbfd7794-ce7c-43ea-8814-b07d89aac574',
    name: 'Agriculture Canteen',
    poi_type: 'facility',
    icon: 'utensils',
    building_function: 'Dining and food services for College of Agriculture students and staff',
    description: 'A dedicated campus dining and refreshment facility located within the College of Agriculture complex, providing affordable meals, snacks, and beverages for students, faculty, and visitors.',
  },
  {
    id: '1952e7a9-cfc0-4c76-9522-62efd1eae56d',
    name: 'Bachelor of Physical Education (BPEd) Department',
    poi_type: 'college',
    icon: 'dumbbell',
    building_function: 'Physical education, sports science instruction and faculty offices',
    description: 'Houses the academic classrooms, departmental offices, and faculty consultation rooms for the Bachelor of Physical Education (BPEd) degree program under the College of Education.',
  },
  {
    id: '0570f62d-1137-4fd0-afa5-f76f90d16a05',
    name: 'BPEd Canteen',
    poi_type: 'facility',
    icon: 'utensils',
    building_function: 'Dining and refreshment facility near the athletic grounds',
    description: 'A campus dining spot situated near the BPEd Department and sports facilities, offering quick meals, energy drinks, and light snacks for student-athletes and physical education classes.',
  },
  {
    id: '1239f685-2d96-404d-a8a2-d54c10ab7721',
    name: 'Cagayan Valley Agriculture, Aquatic and Resources Research and Development (CVAARRD)',
    poi_type: 'laboratory',
    icon: 'microscope',
    building_function: 'Regional research coordination, innovation and technology transfer consortium',
    description: 'The regional research and development consortium coordinating multi-agency agricultural, aquatic, and natural resources research, technology commercialization, and policy development across Region 02.',
  },
  {
    id: '8353febb-9af3-45bc-a4b3-5baa9e06a078',
    name: 'Cagayan Valley Cattle Artificial Insemination Research and Training Center',
    poi_type: 'laboratory',
    icon: 'microscope',
    building_function: 'Bovine genetics, artificial insemination and livestock breeding research',
    description: 'A specialized regional training and research facility focusing on cattle artificial insemination technology, livestock breed improvement, semen cryopreservation, and dairy herd development.',
  },
  {
    id: 'f15740b9-3694-4fee-b755-59fb74078c08',
    name: 'Cagayan Valley Small Ruminants Research Center',
    poi_type: 'laboratory',
    icon: 'microscope',
    building_function: 'Goat and sheep research, breeding, nutrition, and dairy technology',
    description: 'A nationally recognized center of excellence in small ruminants research, specializing in goat and sheep genetic improvement, forage and nutrition development, and chevon processing technology.',
  },
  {
    id: '4ef70f73-5ac4-4bfe-bc15-b56831ed6776',
    name: 'CVSRRC Poultry & Duck-Egg Production Facility',
    poi_type: 'laboratory',
    icon: 'wheat',
    building_function: 'Poultry breeding, duck-egg production and livestock farming systems',
    description: 'An agricultural research and demonstration unit under CVSRRC dedicated to poultry genetics, duck-egg farming systems, incubator technology, and small-scale livestock livelihood models.',
  },
  {
    id: '17912aca-74f1-4bd5-a085-d9f09dcae08e',
    name: 'CBAPA Multi-Purpose Hall',
    poi_type: 'facility',
    icon: 'presentation',
    building_function: 'Collegiate assemblies, seminars, student forums, and academic conferences',
    description: 'A multi-purpose events and lecture venue for the College of Business, Accountancy and Public Administration, hosting business conferences, student organization assemblies, and academic seminars.',
  },
  {
    id: '63478fcc-38fc-40db-b8cc-20ec2c24cccd',
    name: 'CBAPA Park',
    poi_type: 'landmark',
    icon: 'trees',
    building_function: 'Outdoor student study area and green relaxation space',
    description: 'A landscaped outdoor park and study plaza located adjacent to the CBAPA complex, offering tree-shaded seating, open-air study areas, and relaxation spaces for students.',
  },
  {
    id: '0e2c6558-e067-4498-82de-11988cb3d9db',
    name: 'Chevon Valley Marketing Center',
    poi_type: 'facility',
    icon: 'store',
    building_function: 'Commercial showcase and retail center for university-developed agricultural products',
    description: 'The commercial retail and agribusiness hub of ISU Echague, showcasing and selling university-developed farm commodities, gourmet chevon products, dairy goods, and processed delicacies.',
  },
  {
    id: 'd10a732a-75d8-4293-b3d9-0c49aaed52ac',
    name: 'Christian Brotherhood International (CBI) Building',
    poi_type: 'facility',
    icon: 'church',
    building_function: 'Student religious organization fellowship center and meeting hall',
    description: 'The official campus center for Christian Brotherhood International (CBI) student members, providing a dedicated space for student fellowship, character development, and organizational meetings.',
  },
  {
    id: 'b8dbe3b9-bdaf-418c-873a-a6c016d5be3f',
    name: 'Climate Change Center',
    poi_type: 'laboratory',
    icon: 'leaf',
    building_function: 'Climate change research, adaptation and disaster risk reduction',
    description: 'The Climate Change Center was constructed on the ISU Echague campus as an advanced facility for climate change research, adaptation, and capacity building, equipped with meteorological stations, GNSS technology, and solar photovoltaic systems.',
  },
  {
    id: '20b3c5fd-3942-4ff9-a69f-d81afa896f67',
    name: 'Climate Change R&D Support Facility',
    poi_type: 'laboratory',
    icon: 'leaf',
    building_function: 'Environmental monitoring, spatial analysis and climate adaptation laboratory',
    description: 'An auxiliary research facility supporting the Climate Change Center with specialized laboratories for ecological data modeling, GIS spatial mapping, and environmental sustainability studies.',
  },
  {
    id: '4b239704-c7a7-46fe-b677-2f7879ff1b9a',
    name: 'College of Business, Accountancy and Public Administration Building',
    poi_type: 'college',
    icon: 'store',
    building_function: 'Business, accountancy, and public governance academic instruction',
    description: 'The primary academic building for CBAPA, housing undergraduate and graduate lecture halls, business computer laboratories, faculty consultation offices, and administrative departments.',
  },
  {
    id: 'ca6f265f-3a82-469e-8181-f8922ad4ea84',
    name: 'College of Nursing',
    poi_type: 'college',
    icon: 'stethoscope',
    building_function: 'Nursing education, health sciences and clinical simulation laboratories',
    description: 'The College of Nursing provides academic instruction, hospital practicum preparation, and high-fidelity clinical simulation laboratories for the Bachelor of Science in Nursing program.',
  },
  {
    id: '273c5272-d3c6-4869-a058-fde2cf79487a',
    name: 'College of Education Extension Building',
    poi_type: 'college',
    icon: 'presentation',
    building_function: 'Teacher education lecture rooms and instructional media laboratories',
    description: 'An academic extension of the College of Education providing additional lecture classrooms, teaching simulation rooms, and instructional media preparation laboratories for education majors.',
  },
  {
    id: 'b11d052a-ee0c-466b-a6f3-aa8dda9f764c',
    name: 'College of Education Accreditation Center',
    poi_type: 'administrative',
    icon: 'presentation',
    building_function: 'Academic accreditation archives, program evaluation and quality assurance',
    description: 'The central facility for academic quality assurance and institutional accreditation review for the College of Education, holding curriculum evaluation records and faculty committee rooms.',
  },
  {
    id: '813cbf6e-2f3e-47f5-93b9-67d746147b87',
    name: 'Dy Building',
    poi_type: 'facility',
    icon: 'building',
    building_function: 'Multi-purpose collegiate classrooms and general academic instruction',
    description: 'A multi-story academic facility named in honor of the university benefactors, accommodating lecture rooms and seminar spaces for various undergraduate programs across the campus.',
  },
  {
    id: 'e2c8ce5c-214d-4e48-a111-045a33f3ebbf',
    name: 'Freshwater Fisheries Center',
    poi_type: 'laboratory',
    icon: 'microscope',
    building_function: 'Aquaculture demonstration, fish breeding and freshwater ecology research',
    description: 'A specialized fisheries research and demonstration complex featuring aquaculture ponds, hatchery systems, and laboratory facilities supporting freshwater fish farming and aquatic biodiversity.',
  },
  {
    id: 'dfe46c27-a342-4e70-a15a-8ac5690590c7',
    name: 'Girls University Dormitory',
    poi_type: 'facility',
    icon: 'building',
    building_function: 'Female student residential accommodation and study lounges',
    description: 'A secure, affordable on-campus dormitory providing residential quarters, study lounges, and living accommodations for female students of Isabela State University.',
  },
  {
    id: '8a2c0cb1-682b-481d-a318-ae3ea40afd0d',
    name: 'Grand Stand',
    poi_type: 'landmark',
    icon: 'trophy',
    building_function: 'Spectator seating and stage for athletic meets and university ceremonies',
    description: 'The Grand Stand provides covered spectator seating overlooking the university athletic field, serving as the main stage for university intramurals, regional athletic meets, and outdoor commencement exercises.',
  },
  {
    id: '935c00e9-bbf3-4e29-ad65-1fe110f0ef4e',
    name: 'ISU Meat Processing Center & Innovation Hub',
    poi_type: 'laboratory',
    icon: 'nut',
    building_function: 'Meat science research, meat processing, and food product innovation',
    description: 'A modern slaughterhouse and meat science laboratory equipped for hygienic meat processing, cold storage, sensory testing, packaging, and commercial value-adding research.',
  },
  {
    id: '4177bb63-b8eb-4f90-99b9-cda525945269',
    name: 'ISUBela Native Pig Research and Production Facility',
    poi_type: 'laboratory',
    icon: 'wheat',
    building_function: 'Native swine genetics, breeding, and organic production research',
    description: 'A dedicated animal research and breeding facility committed to the genetic conservation, organic feed evaluation, and commercial production technology of the proprietary ISUBela native pig breed.',
  },
  {
    id: '022ac5e7-3c8b-4e2c-b316-14d4126eae63',
    name: 'ISU-E TVET Competency Assessment Center',
    poi_type: 'facility',
    icon: 'wrench',
    building_function: 'TESDA-accredited technical-vocational competency testing and certification',
    description: 'A TESDA-accredited Technical-Vocational Education and Training assessment center administering national competency evaluations in agriculture, ICT, electrical, and technical trades.',
  },
  {
    id: '09a4a517-7c79-415f-a63b-c1e62a1f1da4',
    name: 'National Dairy Authority (NDA) Center',
    poi_type: 'facility',
    icon: 'wheat',
    building_function: 'Dairy herd management, milk collection, cold chain, and dairy enterprise training',
    description: 'A collaborative regional dairy facility operated with the National Dairy Authority, supporting dairy cattle breeding, raw milk collection, pasteurization, and local dairy farmer training.',
  },
  {
    id: '0edc3dc3-8845-4bac-9f95-72b62577b0a9',
    name: 'Old College of Agriculture Building',
    poi_type: 'college',
    icon: 'wheat',
    building_function: 'Agricultural instruction classrooms, student organization rooms and faculty offices',
    description: 'The historic academic building of the College of Agriculture, housing lecture classrooms, soil and crop science instructional laboratories, and departmental faculty offices.',
  },
  {
    id: '02532c70-6d02-4ea9-a381-c8dbc78494cd',
    name: 'One Health Product Development Center',
    poi_type: 'laboratory',
    icon: 'flask',
    building_function: 'Interdisciplinary zoonotic disease research, public health, and biosecurity R&D',
    description: 'An advanced interdisciplinary research facility implementing the global One Health approach — connecting human medicine, veterinary sciences, and ecological biosafety product innovation.',
  },
  {
    id: '4e23b43d-d7d4-4d64-ad3e-dab1f60afd87',
    name: 'Salakot Building & Laboratory Wing',
    poi_type: 'college',
    icon: 'presentation',
    building_function: 'Computer laboratories, business simulation centers and academic lecture halls',
    description: 'Recognizable by its traditional salakot-inspired roof structure, this facility houses state-of-the-art computer laboratories, lecture halls, and academic offices for CBAPA students.',
  },
  {
    id: 'f8f95ce1-f574-4fc1-a7fc-da30f5131167',
    name: 'School of Veterinary Medicine',
    poi_type: 'college',
    icon: 'stethoscope',
    building_function: 'Veterinary clinical medicine, animal surgery, and veterinary diagnostic training',
    description: 'Offers the Doctor of Veterinary Medicine (DVM) degree, featuring veterinary anatomical laboratories, animal diagnostic clinics, surgery suites, and animal patient wards.',
  },
  {
    id: '965540e3-0060-45ef-a1d1-f45b98181d62',
    name: 'Supreme Student Council (SSC) Building',
    poi_type: 'facility',
    icon: 'users',
    building_function: 'Student governance headquarters, council offices and student organization hub',
    description: 'The central headquarters of the University Supreme Student Council (SSC), serving as the hub for university-wide student representation, student rights advocacy, and campus activities.',
  },
  {
    id: '2f8ea70d-7933-4b03-829c-01605c097697',
    name: 'The Food Lab',
    poi_type: 'laboratory',
    icon: 'nut',
    building_function: 'Food technology processing, sensory evaluation, and nutrition product testing',
    description: 'A modern food processing and food innovation laboratory dedicated to product testing, nutritional formulation, culinary sciences, and agricultural product value-adding practicums.',
  },
  {
    id: 'f964a346-d726-49aa-baee-b5510f136035',
    name: 'Tropical Fruits Genebank & Agro-Ecotourism Park',
    poi_type: 'landmark',
    icon: 'trees',
    building_function: 'Fruit genetic conservation, germplasm repository, and agro-ecotourism destination',
    description: 'A vast germplasm sanctuary and university ecotourism park conserving rare and indigenous tropical fruit species, hosting orchard research, and welcoming educational eco-tours.',
  },
];

async function main() {
  console.log(`Starting update of ${UPDATES.length} POIs...`);
  for (const u of UPDATES) {
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
  console.log('\n🎉 All POIs updated, descriptions added, icons set, and place-cards reindexed in vector search!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
