-- 1. Create the locations table
CREATE TABLE public.locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL
);

-- 2. Turn off Row Level Security so our simple HTML editor can read and write without logging in
ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY;

-- 3. Insert the initial data from locations.js
INSERT INTO public.locations (id, name, category, icon, description, lat, lng) VALUES
('admin-building', 'Administrative Building', 'admin', 'fas fa-building-columns', 'The main administrative hub of ISU Echague, housing the Office of the University President, Vice Presidents, and other top management offices.', 16.72086, 121.68961),
('registrar', 'Office of the Registrar', 'admin', 'fas fa-file-signature', 'Handles student enrollment, academic records, transcripts, and other registration services for the university.', 16.72098, 121.68981),
('cashier-office', 'Cashier''s Office', 'admin', 'fas fa-money-check-alt', 'Manages financial transactions, tuition fee payments, and other monetary matters for students and staff.', 16.72059, 121.6896),
('college-engineering', 'College of Engineering', 'academic', 'fas fa-cogs', 'Offers engineering programs including Agricultural Engineering, Civil Engineering, Electrical Engineering, and Mechanical Engineering.', 16.721, 121.6932),
('college-education', 'College of Teacher Education', 'academic', 'fas fa-chalkboard-teacher', 'Prepares future educators with programs in Elementary Education, Secondary Education, and other teacher training courses.', 16.7219, 121.6934),
('college-arts-sciences', 'College of Arts and Sciences', 'academic', 'fas fa-flask', 'Offers programs in natural sciences, social sciences, humanities, and communication arts.', 16.7184, 121.68911),
('college-agriculture', 'College of Agriculture', 'academic', 'fas fa-seedling', 'The flagship college of ISU, providing programs in Agricultural Sciences, Animal Science, Crop Science, and Soil Science.', 16.72349, 121.69089),
('college-business', 'College of Business, Accountancy & Public Administration', 'academic', 'fas fa-briefcase', 'Offers business-related programs including Accountancy, Business Administration, Public Administration, and Hospitality Management.', 16.7201, 121.6931),
('college-computing', 'College of Computing, Information and Communication Technology', 'academic', 'fas fa-laptop-code', 'Provides programs in Information Technology, Computer Science, and Information Systems, equipped with modern computer laboratories.', 16.71871, 121.68841),
('college-criminal-justice', 'College of Criminal Justice Education', 'academic', 'fas fa-gavel', 'Offers the Bachelor of Science in Criminology program, preparing students for careers in law enforcement and criminal justice.', 16.7175, 121.6925),
('graduate-school', 'Graduate School', 'academic', 'fas fa-user-graduate', 'Offers master''s and doctoral programs across various disciplines, supporting advanced academic research and professional development.', 16.7203, 121.6905),
('university-library', 'University Library', 'facility', 'fas fa-book-open', 'The main library of ISU Echague, housing thousands of volumes of books, periodicals, and digital resources for academic research.', 16.7196, 121.6903),
('university-infirmary', 'University Infirmary', 'facility', 'fas fa-hospital', 'Provides primary healthcare services, first aid, and medical consultations for students, faculty, and staff.', 16.7183, 121.6905),
('cvcdc', 'Cagayan Valley Cacao Development Center (CVCDC)', 'facility', 'fas fa-industry', 'A state-of-the-art research and development center dedicated to cacao production, processing, and quality improvement in the Cagayan Valley region.', 16.7235, 121.694),
('emcc', 'Equipment Manufacturing Cluster Center (EMCC)', 'facility', 'fas fa-tools', 'A fabrication and manufacturing facility that supports research and development of agricultural equipment and machinery.', 16.7215, 121.694),
('ict-center', 'ICT Center', 'facility', 'fas fa-network-wired', 'The university''s information and communications technology hub, managing campus network infrastructure and IT services.', 16.72, 121.692),
('dormitory', 'University Dormitory', 'facility', 'fas fa-bed', 'Student residential facilities providing affordable accommodation for students from distant municipalities and provinces.', 16.72117, 121.69549),
('canteen', 'University Canteen', 'facility', 'fas fa-utensils', 'The main dining area where students, faculty, and staff can enjoy affordable meals and refreshments throughout the day.', 16.72, 121.6892),
('oval', 'The Oval (Athletic Field)', 'sports', 'fas fa-running', 'The main athletic field used for sports activities, physical education classes, intramurals, and university-wide fitness programs.', 16.71982, 121.69398),
('open-gymnasium', 'Covered Court / Open Gymnasium', 'sports', 'fas fa-basketball-ball', 'An open-air gymnasium used for basketball, volleyball, badminton, and other indoor sports activities and university events.', 16.719, 121.6932),
('amphitheater', 'University Amphitheater', 'landmark', 'fas fa-theater-masks', 'An open-air venue for university-wide events, forums, ceremonies, cultural performances, and large gatherings.', 16.71877, 121.69245),
('alba-hall', 'Alba Hall', 'landmark', 'fas fa-landmark', 'A major venue for formal events, MOA signings, seminars, conferences, and university ceremonies.', 16.7205, 121.6888),
('de-venecia-hall', 'De Venecia Hall', 'landmark', 'fas fa-building', 'A multi-purpose hall used for academic and administrative functions, named in honor of notable benefactors of the university.', 16.72533, 121.69192),
('student-plaza', 'Student Plaza', 'landmark', 'fas fa-users', 'A central gathering space for students featuring seating areas, bulletin boards, and spaces for student organization activities.', 16.7201, 121.6896),
('main-gate', 'Main Gate', 'landmark', 'fas fa-dungeon', 'The primary entrance to the ISU Echague Main Campus along the national highway, featuring the university signage and security checkpoint.', 16.72165, 121.68551),
('library-park', 'Library Park', 'landmark', 'fas fa-tree', 'A serene green space near the university library, perfect for reading, relaxation, and quiet contemplation amidst nature.', 16.7198, 121.6906),
('security-park', 'Security Park', 'landmark', 'fas fa-shield-alt', 'A landscaped park area near the campus security office, serving as a peaceful rest area and assembly point.', 16.7213, 121.6862),
('bike-station', 'Bike Station', 'facility', 'fas fa-bicycle', 'Free transport bike station providing eco-friendly mobility for students to travel conveniently around the 355-hectare campus.', 16.7214, 121.686);
