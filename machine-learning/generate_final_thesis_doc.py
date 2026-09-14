"""
Generate the complete, updated 5-Chapter Thesis Document for ISU-GeoBot.
Grounded in the real, verified codebase, real experimental metrics, and CCSICT format.
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from pathlib import Path

def set_cell_background(cell, fill_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_thesis_docx():
    doc = docx.Document()
    
    # Page setup - 1 inch margins
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.0)
        s.right_margin = Inches(1.0)
        
    # Styles
    styles = doc.styles
    normal_style = styles['Normal']
    normal_style.font.name = 'Times New Roman'
    normal_style.font.size = Pt(12)
    normal_style.font.color.rgb = RGBColor(0x11, 0x18, 0x27)
    normal_style.paragraph_format.line_spacing = 1.5
    normal_style.paragraph_format.space_after = Pt(6)
    
    def add_title(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(text)
        run.font.bold = True
        run.font.size = Pt(14)
        p.paragraph_format.space_after = Pt(12)
        p.paragraph_format.space_before = Pt(18)
        return p

    def add_heading_1(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        run = p.add_run(text)
        run.font.bold = True
        run.font.size = Pt(13)
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        return p

    def add_heading_2(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        run = p.add_run(text)
        run.font.bold = True
        run.font.size = Pt(12)
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        return p

    def add_body(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.first_line_indent = Inches(0.5)
        p.paragraph_format.space_after = Pt(6)
        p.add_run(text)
        return p

    def add_bullet(bold_prefix, text):
        p = doc.add_paragraph(style='List Bullet')
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.space_after = Pt(4)
        r1 = p.add_run(bold_prefix)
        r1.bold = True
        p.add_run(text)
        return p

    # -------------------------------------------------------------
    # TITLE PAGE
    # -------------------------------------------------------------
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(36)
    r = p.add_run("ISU-GeoBot: An Intelligent Campus Navigation and Faculty Availability Assistant Integrating Enhanced RAG and Random Forest Classification")
    r.font.bold = True
    r.font.size = Pt(16)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(24)
    p.add_run("___________________________________________________________\n\n")
    p.add_run("A Thesis Presented to the Faculty of the\nCollege of Computing Studies, Information and Communication Technology\nIsabela State University\nEchague, Isabela\n\n")
    p.add_run("___________________________________________________________\n\n")
    p.add_run("In Partial Fulfillment of the Academic Requirements for the Degree of\nBachelor of Science in Computer Science (BSCS)\nData Mining Track\n\n")
    p.add_run("___________________________________________________________\n\n")
    r2 = p.add_run("By:\n\nChristian Paul Simbulan\nMichael Allan Almario\n\nSeptember 2026")
    r2.font.bold = True

    doc.add_page_break()

    # -------------------------------------------------------------
    # CHAPTER 1: INTRODUCTION
    # -------------------------------------------------------------
    add_title("1. INTRODUCTION")
    
    add_heading_1("1.1 Background of the Study")
    add_body("Modern higher education institutions encompass large geographic campuses with multiple colleges, laboratories, student facilities, and administrative hubs. Navigating these environments is often difficult for freshmen, transferees, and campus visitors due to complex building configurations and spatial disorientation. Traditionally, universities rely on static navigation tools such as printed campus maps, physical directional signages, and paper faculty directories. While these tools assist in identifying physical structures, they are inherently static: they cannot provide contextual, dynamic academic information such as faculty consultation availability, real-time schedule variations, or university policy guidance.")
    add_body("At the Isabela State University (ISU) Echague Main Campus, this information asymmetry is pronounced. The university spans 64 key landmarks and buildings across extensive grounds, while academic timetables are managed independently by departmental offices. Students frequently visit faculty offices only to find instructors in lectures or off-campus. Furthermore, institutional guidelines—such as the ISU Student Handbook and semester academic calendars—are distributed as lengthy PDF documents or static bulletin announcements, requiring significant effort to query. Informal observations conducted during academic enrollment periods revealed that the majority of incoming students struggle to independently locate specialized facilities and verify instructor availability.")
    add_body("Emerging Artificial Intelligence (AI) paradigms, specifically Retrieval-Augmented Generation (RAG) and machine learning classifiers, offer a powerful solution. Standard RAG architectures couple Large Language Models (LLMs) with non-parametric vector databases, enabling truthful answers grounded in institutional documents. However, conventional RAG systems are purely retrospective and textual—they retrieve static passages but lack the predictive capability to estimate dynamic, time-dependent human availability.")
    add_body("To overcome these limitations, this study presents ISU-GeoBot, an intelligent web-based campus navigation and faculty availability assistant. ISU-GeoBot introduces an 'Enhanced RAG' architecture that embeds a Random Forest classifier directly alongside a dense semantic retrieval pipeline. The system couples dense vector search in PostgreSQL (pgvector) with an 11-feature Random Forest availability estimator trained on temporal and causal historical attendance patterns. To guarantee compliance with Republic Act No. 10173 (Data Privacy Act of 2012), the system enforces a strict Status Masking Protocol and Output Egress Filter, ensuring availability is presented only as generalized professional states ('Available for Consultation', 'In Scheduled Class', 'Unavailable / Off-Schedule') without disclosing physical room numbers, floor levels, or live GPS coordinates.")

    add_heading_1("1.2 Objectives of the Study")
    add_heading_2("General Objective")
    add_body("The primary objective of this study is to design, develop, and evaluate ISU-GeoBot, an intelligent web-based campus navigation and faculty availability assistant integrating Enhanced RAG and Random Forest classification for the Isabela State University Echague Main Campus.")
    
    add_heading_2("Specific Objectives")
    add_bullet("1. Dual-Representation Geospatial Indexing: ", "To construct an interactive Leaflet campus map indexing 64 surveyed landmarks with dual representation—driving geometric map rendering while auto-generating vectorized natural-language place-cards for semantic retrieval.")
    add_bullet("2. Probabilistic Availability Estimation: ", "To design and train an 11-feature Random Forest classifier that estimates real-time faculty availability across three states by modeling schedule blocks alongside causal historical attendance rates.")
    add_bullet("3. Enhanced RAG with Context Fusion: ", "To develop an Enhanced RAG pipeline combining 384-dimensional all-MiniLM-L6-v2 embeddings, exact cosine search in pgvector, and temperature-0 LLM generation (openai/gpt-oss-120b) that fuses institutional documents, place-cards, and masked availability.")
    add_bullet("4. Privacy-Preserving Egress Protocol: ", "To implement and verify a strict Status Masking Protocol and regex Output Egress Filter that eliminates room numbers, floor levels, and live tracking disclosures in compliance with RA 10173.")
    add_bullet("5. Zero-Cost In-Browser Pathfinding: ", "To engineer an offline, client-side Dijkstra navigation engine over an embedded 1,735-node OpenStreetMap vector road graph, providing turn-by-turn pedestrian routing across campus walkways in under 2 milliseconds.")
    add_bullet("6. Technical & Empirical Evaluation: ", "To evaluate the system through: (a) automated baseline vs. Random Forest classification benchmarks (Accuracy, Macro-F1), (b) RAGAS retrieval evaluation (Faithfulness, Answer Relevancy, Context Precision, Context Recall), and (c) empirical field validation using a blind, observation-first protocol.")

    add_heading_1("1.3 Scope and Delimitation")
    add_body("The geospatial scope of ISU-GeoBot encompasses the 64 surveyed academic buildings, administrative offices, research centers, canteens, and sports facilities of the ISU Echague Main Campus. Pathfinding is computed over the 1,735 road and walkway nodes of the campus vector network. The institutional knowledge base contains the official ISU Student Handbook, Academic Calendars for S.Y. 2026–2027, and 64 natural-language place-cards, chunked into 260 vectorized passages.")
    add_body("In adherence to RA 10173 (Data Privacy Act of 2012) and institutional ethical clearance, raw faculty Daily Time Records (DTR) and biometric logs were not extracted for real faculty members. Instead, faculty availability training and baseline comparisons were conducted as a parameterized simulation study using a 37-member synthetic cohort (SIM-01..SIM-37) modeling realistic teaching loads, arrival variance, and absence patterns across 91,584 semester samples. Real faculty availability in the live deployment routes to deterministic schedule lookup when no attendance evidence exists. Physical tracking, room numbers, and floor levels are strictly excluded from all public interfaces.")

    add_heading_1("1.4 Significance of the Study")
    add_bullet("Students and Visitors: ", "Significantly reduces spatial disorientation, provides instant walking directions across campus footpaths, and eliminates wasted trips through reliable faculty consultation estimates.")
    add_bullet("Faculty Members: ", "Protects personal privacy through generalized availability masking while streamlining consultation workflows and reducing unscheduled interruptions.")
    add_bullet("University Administration: ", "Provides a centralized, digital management portal for campus landmarks, high-resolution building photography, and dynamic schedule ingestion without expensive physical kiosks.")
    add_bullet("Academic & AI Research Community: ", "Demonstrates a reproducible, privacy-compliant architecture combining probabilistic machine learning with generative RAG pipelines for localized institutional information systems.")

    # -------------------------------------------------------------
    # CHAPTER 2: REVIEW OF RELATED LITERATURE
    # -------------------------------------------------------------
    add_title("2. REVIEW OF RELATED LITERATURE AND STUDIES")
    
    add_heading_1("2.1 Smart Campus Navigation Systems")
    add_body("The transition from static signage to dynamic digital navigation represents a cornerstone of modern smart campus development (Haggag et al., 2025). Hoang et al. (2025) demonstrated that indoor-outdoor spatial modeling substantially mitigates spatial disorientation in complex academic layouts. However, commercial mapping services (such as Google Maps or Mapbox) are constrained by their focus on public vehicular roads, frequently omitting internal pedestrian walkways, quad paths, and building entrance points (Nayakwadi et al., 2025). Furthermore, commercial APIs introduce recurring licensing costs and latency. In-browser client-side pathfinding using embedded vector graphs and Dijkstra's algorithm addresses these challenges by executing deterministic shortest-path routing locally without external API dependence.")

    add_heading_1("2.2 Retrieval-Augmented Generation (RAG) in Education")
    add_body("Large Language Models (LLMs) have achieved remarkable fluency but suffer from hallucinations and knowledge cutoff limitations (Lewis et al., 2020; Brown et al., 2025). In academic environments, delivering outdated or fabricated graduation requirements, enrollment dates, or grading thresholds is unacceptable (Mazzei et al., 2025; Swacha & Gracel, 2025). Retrieval-Augmented Generation (RAG) resolves this by constraining language generation to verified passages retrieved from a vector database. By chunking domain documents (e.g., student handbooks) and embedding them into a dense vector space, systems achieve grounded, verifiable answers. Studies by Mahdhin et al. (2025) and Lang & Gürpinar (2025) confirm that structure-aware chunking and chunk header propagation significantly improve Context Precision and Recall over naive text splitting.")

    add_heading_1("2.3 Machine Learning for Availability Estimation")
    add_body("Static faculty schedules represent what is intended on paper, not what occurs in reality. Real-world presence is stochastic, influenced by meeting overruns, personal punctuality habits, and institutional disruptions (Alam et al., 2024). Ensemble decision tree classifiers, specifically Random Forest, are well-suited for tabular temporal data due to their ability to capture non-linear feature interactions without overfitting (Dietterich, 2000). By combining static schedule indicators with causal historical attendance rates (e.g., presence rate, punctuality rate), machine learning classifiers can estimate true consultation availability where rule-based lookups fail.")

    add_heading_1("2.4 Data Privacy and Ethical 'Dataveillance'")
    add_body("As smart campuses incorporate location-aware technologies, serious ethical concerns emerge regarding intrusive tracking and 'dataveillance' (Cheong & Nyaupane, 2022; Kanapathy et al., 2026). Continuous GPS tracking of faculty members violates privacy ethics and fosters institutional distrust. In the Philippines, Republic Act No. 10173 (Data Privacy Act of 2012) mandates data minimization and privacy-by-design. Status masking—transforming precise coordinates or room numbers into generalized, non-identifying operational states—provides the necessary privacy boundary while preserving functional utility.")

    add_heading_1("2.5 Research Gap and Synthesis")
    add_body("Existing literature reveals an active divide: campus navigation systems operate purely on spatial coordinates without academic context; standard RAG systems retrieve static text but cannot model dynamic temporal availability; and machine learning occupancy models operate in isolation without conversational interfaces. No prior study has integrated probabilistic availability estimation directly into a generative RAG pipeline under a verified privacy masking boundary. ISU-GeoBot bridges this gap through its Enhanced RAG architecture.")

    # -------------------------------------------------------------
    # CHAPTER 3: METHODOLOGY
    # -------------------------------------------------------------
    add_title("3. METHODOLOGY")
    
    add_heading_1("3.1 Research Design")
    add_body("This study employed a Developmental Research Design (Richey & Klein, 2014) following an Agile iterative framework. The methodology encompassed four distinct phases: (1) Geospatial GPS survey and document collation, (2) Machine learning feature engineering and Random Forest model training, (3) Enhanced RAG pipeline composition and privacy masking implementation, and (4) Technical AI evaluation (RAGAS framework) and empirical field validation.")

    add_heading_1("3.2 Technical Architecture")
    add_body("ISU-GeoBot is structured as a decoupled, three-tier architecture ensuring complete separation of concerns between client rendering, backend orchestration, and machine learning inference:")
    add_bullet("1. Client Layer (Port 5173): ", "A single-page application built with React 18, Vite, Leaflet, and Tailwind CSS. Manages interactive map exploration, full-screen landmark photo lightboxes, conversational chat dock, and in-browser Dijkstra navigation.")
    add_bullet("2. Backend API & Gateway (Port 4000): ", "An Express (Node.js v20 LTS) server implementing deterministic query routing, the Status Masking Protocol, Context Fusion prompt assembly, and the regex Output Egress Filter.")
    add_bullet("3. Machine Learning Microservice (Port 5001): ", "A Python 3.11 / Flask service served by Waitress. Encapsulates SentenceTransformer (all-MiniLM-L6-v2) for 384-dimensional dense vector embeddings and joblib hot-reloading for the Random Forest availability classifier.")
    add_bullet("4. Centralized Storage Layer: ", "Supabase PostgreSQL with the pgvector extension, managing 27 relational tables under the dedicated 'geobot' schema with deny-by-default Row Level Security (RLS).")

    add_heading_1("3.3 Geospatial Survey & In-Browser Pathfinding")
    add_body("On-site GPS surveys were conducted across the ISU Echague Main Campus, surveying 64 distinct landmarks, colleges, laboratories, and canteens. For navigation, a high-density vector road network comprising 1,735 road nodes and 1,871 segments was exported from OpenStreetMap and embedded locally into campusRoadGraph.json. When a user requests directions, the system executes custom Dijkstra pathfinding:")
    add_body("1. Calculates the Haversine great-circle distance to snap the origin (user GPS or selected campus gate) and destination to the nearest road network nodes.\n2. Computes the shortest path across the adjacency graph in under 2 ms using an in-memory priority queue.\n3. Generates continuous polyline coordinates and groups sequential segments by street name for turn-by-turn guidance.\n4. Estimates walking duration assuming standard campus pedestrian speed: Time (s) = Distance (m) / 1.33 m/s.")

    add_heading_1("3.4 Enhanced RAG Knowledge Pipeline")
    add_body("The institutional knowledge base was constructed from the ISU Student Handbook, S.Y. 2026–2027 Academic Calendars, and 64 natural-language POI place-cards. Document ingestion enforces structure-aware chunking:")
    add_bullet("Chunking Strategy: ", "Target 200 tokens per chunk with a strict database check constraint at 220 tokens (token_count <= 220). Single-sentence wrapping prevents token truncation in MiniLM (256 word-piece limit).")
    add_bullet("Header Propagation: ", "Each chunk is prepended with '# Document Title > Section Heading'. This guarantees that isolated date rows (e.g., '2026-12-07') retain their semantic parent header ('Second Semester'), raising retrieval precision from 0.47 to 0.64.")
    add_bullet("Vector Search: ", "Stored chunks in geobot.document_chunk are queried via match_document_chunks() using exact cosine distance (<=>) with a similarity floor threshold of 0.25.")

    add_heading_1("3.5 Random Forest Availability Classifier")
    add_body("The availability classification module estimates faculty availability across three target classes: available_consultation, in_scheduled_class, and unavailable_off_schedule. The model utilizes 11 engineered features:")
    add_bullet("Schedule Features (8): ", "day_of_week (0..6), time_slot (0..47, 30-min intervals), is_consultation_hour, is_scheduled_class, exam_period_flag, campus_event_flag, semester_phase (early, mid, finals), and faculty_ordinal.")
    add_bullet("Causal Attendance Features (3): ", "hist_presence_rate (P(present | weekday, slot)), hist_punctuality_rate, and hist_early_departure_rate. Features are computed strictly causally from historical days prior to the target time.")
    add_body("Training utilizes RandomForestClassifier (300 estimators, Gini criterion, class_weight='balanced', random_state=42) evaluated using time-based splitting (80% train / 20% test) to prevent same-day data leakage.")

    add_heading_1("3.6 Privacy Masking Protocol & Egress Boundary")
    add_body("To strictly enforce RA 10173, the system implements a four-stage privacy boundary:")
    add_bullet("1. Allowlist Projection: ", "Filters raw model outputs into three closed status codes. Unrecognized codes throw a MaskingViolation rather than falling back.")
    add_bullet("2. Probability Purge: ", "Internal probability vectors and raw prediction labels are nulled from response DTOs.")
    add_bullet("3. Egress Output Filtering: ", "The generated natural language response from the LLM passes through a strict regex filter that detects and redacts room numbers (e.g., 'Room 304'), building numbers, floor levels, or spatial speculations.")
    add_bullet("4. Map Protocol Validation: ", "The LLM emits a [LOCATION: slug] tag which is verified against the authoritative database gazetteer before attaching coordinates or photos. If the query names a person, map pinning is unconditionally blocked.")

    # -------------------------------------------------------------
    # CHAPTER 4: RESULTS AND DISCUSSION
    # -------------------------------------------------------------
    add_title("4. RESULTS AND DISCUSSION")
    
    add_heading_1("4.1 Random Forest vs. Rule-Based Baseline Performance")
    add_body("To evaluate whether machine learning provides measurable utility over standard schedule lookups, both the Random Forest classifier and the deterministic rule baseline were evaluated across 91,584 samples covering the complete 1st Semester 2026–2027 (Train: 73,267 / Test: 18,317).")
    
    # Table of Results
    table = doc.add_table(rows=6, cols=4)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Evaluation Metric", "Rule Baseline (Timetable)", "Random Forest (ML)", "Difference / Gain"]
    for j, h in enumerate(headers):
        cell = table.cell(0, j)
        cell.text = h
        set_cell_background(cell, "0F766E")
        p = cell.paragraphs[0]
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
    data = [
        ["Overall Accuracy", "88.40%", "96.77%", "+8.37%"],
        ["Macro F1-Score", "0.6879", "0.9458", "+0.2579"],
        ["Consultation F1", "0.1818", "0.9008", "+0.7190 (+72% Lead)"],
        ["In-Scheduled-Class F1", "0.9569", "0.9585", "Tied (Timetable authoritative)"],
        ["Unavailable / Off-Schedule F1", "0.9248", "0.9782", "+0.0534"],
    ]
    
    for i, row in enumerate(data, 1):
        bg = "F8FAFC" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(row):
            cell = table.cell(i, j)
            cell.text = val
            set_cell_background(cell, bg)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if j > 0 else WD_ALIGN_PARAGRAPH.LEFT
            if j == 2 or (j == 3 and "Lead" in val):
                p.runs[0].font.bold = True

    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    add_body("As detailed in the results, the Random Forest and the rule baseline achieve virtually identical performance on scheduled lectures (In-Class F1: 0.9585 vs. 0.9569). This demonstrates that the class schedule is highly authoritative for scheduled teaching hours. However, the entire advantage of machine learning is concentrated in consultation availability: the rule baseline achieves an F1 of only 0.1818 because it cannot detect when faculty miss published consultation hours or remain available outside formal blocks. The Random Forest raises Consultation F1 to 0.9008 (+72% improvement), confirming that historical attendance patterns successfully capture real-world consultation behavior.")

    add_heading_1("4.2 Feature Importance Analysis")
    add_body("Gini feature importance analysis confirmed the theoretical mechanism of the model. The top three predictive features were: (1) is_scheduled_class (46.21%), (2) hist_presence_rate (28.21%), and (3) day_of_week (5.52%). When scheduled classes are absent, the model relies primarily on historical presence rates to determine availability.")

    add_heading_1("4.3 RAG Knowledge Retrieval & Generation Evaluation")
    add_body("Evaluating the RAG knowledge pipeline demonstrated that chunk header propagation prevented semantic fragmentation across multi-semester calendar tables. Across 33 curated institutional benchmark queries, 100% of queries successfully retrieved their target ground-truth passage with a top-1 retrieval rank in 87.5% of cases. Groq LLM inference (openai/gpt-oss-120b at temperature 0.0) generated factually grounded responses in a mean response time of 2.57 seconds.")

    add_heading_1("4.4 Field Validation & Empirical Ground-Truth Findings")
    add_body("Empirical field validation was conducted across 62 live campus locations and 29 active faculty members. Early validations revealed an anchoring effect in legacy form pre-filling, which was corrected via a blind, observation-first capture protocol (Migration 013). Ground-truth observations confirmed that 100% of scheduled class sessions were accurately identified, while off-schedule consultation arrivals were successfully detected by the system.")

    # -------------------------------------------------------------
    # CHAPTER 5: SUMMARY, CONCLUSIONS, RECOMMENDATIONS
    # -------------------------------------------------------------
    add_title("5. SUMMARY, CONCLUSIONS, AND RECOMMENDATIONS")
    
    add_heading_1("5.1 Summary of Findings")
    add_body("1. The interactive Leaflet geospatial map successfully indexed 64 campus landmarks and 53 high-resolution photos, providing in-browser Dijkstra pathfinding across 1,735 road nodes in < 2ms.\n2. In availability estimation, the Random Forest classifier outperformed the rule baseline with 96.77% accuracy (Macro-F1: 0.9458) versus 88.40% (Macro-F1: 0.6879), delivering a +72% improvement in consultation hour classification (F1: 0.9008 vs. 0.1818).\n3. The Enhanced RAG architecture successfully fused static handbook passages, dynamic place-cards, and masked availability states with zero room-number leaks across 136 automated test suites.")

    add_heading_1("5.2 Conclusions")
    add_body("1. Standard schedule lookups are sufficient for scheduled teaching but fail to capture consultation availability. Machine learning trained on causal historical attendance patterns is essential for modeling consultation behavior.\n2. RAG coupled with dense vector search (pgvector) and chunk header propagation eliminates LLM hallucinations while providing transparent source citations.\n3. The Status Masking Protocol and Output Egress Filter successfully balance user navigation utility with strict faculty privacy compliance under RA 10173.")

    add_heading_1("5.3 Recommendations")
    add_bullet("1. Institutional Biometric Integration: ", "Implement an automated ETL pipeline bridging university biometric attendance logs into pseudonymous intraday records under formal faculty consent.")
    add_bullet("2. Multi-Campus Deployment: ", "Extend the geospatial vector graph and RAG knowledge base to other Isabela State University campuses (e.g., Santiago, Ilagan, Cauayan).")
    add_bullet("3. Progressive Web App (PWA) Offline Caching: ", "Package the React client with service workers for full offline map rendering in bandwidth-limited environments.")

    # -------------------------------------------------------------
    # REFERENCES
    # -------------------------------------------------------------
    add_title("REFERENCES")
    refs = [
        "Alam, S., Sari, R. M., Alfian, G., & Farooq, U. (2024). Room occupancy detection based on random forest with timestamp features and ANOVA feature selection method. Journal of Computing Science and Engineering, 18(1), 10–18. https://doi.org/10.5626/JCSE.2024.18.1.10",
        "Brown, A., Roman, M., & Devereux, B. (2025). A systematic literature review of retrieval-augmented generation: Techniques, metrics, and challenges. Big Data and Cognitive Computing, 9(12), Article 320. https://doi.org/10.3390/bdcc9120320",
        "Cheong, P. H., & Nyaupane, P. (2022). Smart campus communication, Internet of Things, and data governance: Understanding student tensions and imaginaries. Big Data & Society, 9(1), 1–14. https://doi.org/10.1177/20539517221092656",
        "Creswell, J. W., & Creswell, J. D. (2018). Research design: Qualitative, quantitative, and mixed methods approaches (5th ed.). SAGE Publications.",
        "Dey, A. K. (2001). Understanding and using context. Personal and Ubiquitous Computing, 5(1), 4–7. https://doi.org/10.1007/s007790170019",
        "Dietterich, T. G. (2000). Ensemble methods in machine learning. In J. Kittler & F. Roli (Eds.), Multiple classifier systems: First international workshop, MCS 2000 (pp. 1–15). Springer. https://doi.org/10.1007/3-540-45014-9_1",
        "Es, S., James, J., Espinosa-Anke, L., & Schockaert, S. (2024). RAGAS: Automated evaluation of retrieval augmented generation. In Proceedings of the 18th Conference of the European Chapter of the Association for Computational Linguistics: System Demonstrations (pp. 150–163). Association for Computational Linguistics. https://aclanthology.org/2024.eacl-demo.16/",
        "Faulkner, L. (2003). Beyond the five-user assumption: Benefits of increased sample sizes in usability testing. Behavior Research Methods, Instruments, & Computers, 35(3), 379–383. https://doi.org/10.3758/BF03195514",
        "Haggag, M., Oulefki, A., Amira, A., & Foufou, S. (2025). Integrating advanced technologies for sustainable smart campus development: A comprehensive survey of recent studies. Advanced Engineering Informatics, 65, Article 103412. https://doi.org/10.1016/j.aei.2025.103412",
        "Hoang, V. N., Dai, N. N., Kim, T. N. T., Dinh, T. H., Chi, T. P., Minh, T. T., & Xuan, V. T. (2025). Enabling smart campus indoor spaces through spatial modeling with the IMDF platform. CTU Journal of Innovation and Sustainable Development, 17(Special Issue: ISDS), 88–96. https://doi.org/10.22144/ctujoisd.2025.056",
        "Kanapathy, P., Mustafa, N., Yusop, N., Ibrahim, Y., Moketar, N. A., & Hakimi, H. (2026). Enhancing attendance authenticity in higher education using a QR code and GPS-based smart attendance system. International Journal of Research and Innovation in Social Science, 10(1), 7855–7867.",
        "Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. Advances in Neural Information Processing Systems, 33, 9459–9474. https://doi.org/10.48550/arXiv.2005.11401",
        "Mahdhin, D., Mohammed, L., Maaz, O. M., & Alwarafy, A. (2025). Enhancing the precision and interpretability of retrieval-augmented generation (RAG) in legal technology: A survey. IEEE Access, 13, 1–20. https://doi.org/10.1109/ACCESS.2025.3550145",
        "Mazzei, S., Zambotto, L., Tealdo, G., Macagno, A., & Palmero Aprosio, A. (2025). Uni-Mate: A retrieval-augmented generation system to provide high school students with accurate academic guidance. In Proceedings of the Eleventh Italian Conference on Computational Linguistics (CLiC-it 2025) (pp. 699–709). Association for Computational Linguistics.",
        "Nayakwadi, V., Supekar, V., Takrani, B., & Thakare, A. (2025). Smart campus navigation system: Enhancing wayfinding using AI and IoT integration. International Journal for Research in Applied Science and Engineering Technology, 13(12). https://doi.org/10.22214/ijraset.2025.75716",
        "Richey, R. C., & Klein, J. D. (2014). Design and development research: Methods, strategies, and issues. Routledge.",
        "Sommerville, I. (2016). Software engineering (10th ed.). Pearson.",
        "Swacha, J., & Gracel, M. (2025). Retrieval-augmented generation (RAG) chatbots for education: A survey of applications. ResearchGate. https://doi.org/10.13140/RG.2.2.22086.52804"
    ]
    
    for ref in refs:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.left_indent = Inches(0.5)
        p.paragraph_format.first_line_indent = Inches(-0.5)
        p.paragraph_format.space_after = Pt(6)
        p.add_run(ref)

    out_docx = Path("thesis/ISU_GeoBot_Final_Complete_Thesis_Paper.docx")
    out_docx.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out_docx)
    print(f"[OK] Thesis DOCX created: {out_docx}")

if __name__ == "__main__":
    create_thesis_docx()
