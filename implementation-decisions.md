# ISU-GeoBot — Implementation Decision Report

> **Purpose:** Resolve architectural ambiguities in the thesis before any code is written.
> **Role:** Senior systems architect and thesis defense reviewer.
> **Authoritative source:** [ISU_GeoBot_revised1.pdf](file:///c:/Users/Admin/Desktop/thesis-website/ISU_GeoBot_revised1.pdf)
> **Companion document:** [thesis_analysis.md](file:///C:/Users/Admin/.gemini/antigravity-ide/brain/55814744-68cf-4688-b1a6-140323ba9960/thesis_analysis.md)

---

## 1. Random Forest Prediction Target

### What the thesis says — verbatim evidence

The thesis makes **two distinct claims** about what the RF model outputs:

| Section | Claim | Interpretation |
|---------|-------|----------------|
| **3.5.2** (RF Module) | *"The trained model will output one of the following generalized availability statuses: 'Available for Consultation,' 'Currently in a Lecture,' or 'Unavailable.'"* | RF predicts **status classes** directly |
| **3.5.2** (Gini) | *"C = total number of classes (Available, Late, Absent)"* | RF predicts **status classes** (with different labels) |
| **3.5.3** (Status Masking) | *"The Random Forest classification module generates a raw classification output, which typically represents a specific physical location class (e.g., Class_Room_302 or Off_Campus_Tag)."* | RF predicts **location classes** |
| **3.5.3** (Code sample) | `statusHashMap = { "Room_304": "Currently in a Lecture", "Faculty_Lounge": "Available for Consultation" }` | RF predicts **location classes**, hash map translates to statuses |
| **3.5.4** (Context Fusion) | *"This probabilistic estimation (e.g., 'Available,' 'In a Lecture,' or 'Absent') is then processed through the Status Masking Protocol"* | RF outputs **status labels**, masking sanitizes them |

### Analysis

These are two genuinely different ML problem formulations:

| | **Interpretation A: Status Prediction** | **Interpretation B: Location Prediction** |
|---|---|---|
| **Target variable** | {Available, In_Lecture, Unavailable} | {Room_304, Faculty_Lounge, Off_Campus, ...} |
| **Training labels needed** | What status the faculty was in at time T | Which physical location the faculty was at at time T |
| **Data sources required** | Schedule data + attendance check-in/check-out logs → sufficient | Room-level presence data (sensors, room-specific biometrics) → **not described as available** |
| **Number of classes** | 3 (fixed) | Potentially dozens (one per room/location on campus) |
| **Status masking role** | Maps internal labels ("Available", "Late", "Absent") to user-friendly strings — a simple renaming | Maps sensitive location identifiers to generalized statuses — a genuine privacy transformation |

### Verdict

**Interpretation A (Status Prediction) is more faithful to the thesis** for three reasons:

1. **Section 3.5.2 is the dedicated RF module specification** — it explicitly defines three output classes. Section 3.5.3 is the masking protocol specification and its code sample is introduced as illustrative (*"To illustrate the programmatic execution..."*).
2. **Data feasibility** — the thesis's stated data sources (schedules + attendance logs) can produce status labels but cannot produce room-level location labels without IoT sensors, which the thesis never mentions.
3. **The Gini Impurity formula** lists `C = (Available, Late, Absent)` — these are status labels, not location identifiers.

However, **the status masking protocol must still exist** because:
- The thesis explicitly requires it as a core architectural component (Section 3.5.3)
- It serves a defensible purpose even under Interpretation A: the RF's internal reasoning may use schedule data that implies specific rooms; the masking ensures only the generalized status is injected into the LLM prompt
- The thesis evaluation (functional validation) tests status outputs, not location outputs

### Decision

| Decision | Label |
|----------|-------|
| The RF model predicts **availability status classes** directly: `Available`, `In_Lecture`, `Unavailable` | `IMPLEMENTATION DECISION` — reconciling contradictory thesis sections in favor of the dedicated RF specification (3.5.2) |
| The Status Masking Protocol still operates as middleware that (a) applies the deterministic guard override, (b) maps internal model labels to user-facing strings, and (c) purges any intermediate variables before LLM injection | `THESIS REQUIREMENT` |
| The hash map in the masking layer maps internal labels (e.g., `"available"` → `"Available for Consultation"`, `"in_lecture"` → `"Currently in a Lecture"`, `"unavailable"` → `"Unavailable"`) rather than room names | `IMPLEMENTATION DECISION` |

> [!IMPORTANT]
> **Researcher decision needed:** Michael and Christian should confirm that the RF predicts status categories (3 classes), not physical locations (N classes). This affects training data preparation, the number of features, and the evaluation methodology.

---

## 2. Probability Outputs

### What the thesis says

- Section 3.5.2: *"estimate the probability that a faculty member is actually present and available"*
- Section 3.5.2: *"real-time probabilistic analytics"*
- Section 3.5.4: *"real-time availability probability estimate"*
- Section 1.2 (General Objective): *"probabilistic estimates of faculty availability"*
- Section 3.5.2: *"The trained model will output one of the following generalized availability statuses"* — the final output is categorical
- Functional Validation (3.8.2): Faculty validators compare system's **status classification** (not probability percentages) against their actual status

### Analysis

The thesis uses "probabilistic" to describe the **method** (Random Forest produces class probabilities internally via `predict_proba`), not the **user-facing output**. The user always sees a categorical status. The evaluation instrument measures classification accuracy, precision, recall, and F1-score against categorical labels — not calibration of probability values.

### Decision

| Decision | Label |
|----------|-------|
| The RF model internally uses `predict_proba()` to produce probability distributions across the 3 classes | `THESIS REQUIREMENT` — the thesis explicitly calls for probabilistic ML |
| The **user-facing output** is always a single categorical status string (the argmax class) | `THESIS REQUIREMENT` — stated in 3.5.2 and validated categorically in 3.8.2 |
| The backend **retains the full probability vector internally** (e.g., `{available: 0.72, in_lecture: 0.21, unavailable: 0.07}`) for logging, debugging, and potential RAGAS evaluation | `IMPLEMENTATION DECISION` — not stated but necessary for research evaluation |
| The probability vector is **never exposed to the user or injected into the LLM prompt** | `THESIS REQUIREMENT` — only the masked categorical status is injected (Section 3.5.3, Step 3) |
| The confidence threshold for classification defaults to argmax (highest probability wins) | `IMPLEMENTATION DECISION` — thesis does not specify a threshold |

> [!NOTE]
> The probability vector may be valuable for the thesis defense: "The model was 92% confident Prof. X was available." If researchers want this in logs/admin views, it is compatible with the thesis. But it must never reach the LLM prompt or the end user.

---

## 3. Query Routing

### What the thesis says

- Section 3.5: *"routes requests to the appropriate processing module: the Random Forest Prediction Module for faculty availability queries, or the RAG Pipeline for document-based information retrieval"*
- Section 3.5.4 (Process Flow, step 2): *"the system determines whether the query involves faculty availability, campus navigation, or general institutional information"*

The thesis identifies **three query categories** but does not specify the routing mechanism.

### Recommended Routing Strategy

#### 3a. General Institutional Queries
*Example: "What is the academic calendar for this semester?"*

| Step | Action | Label |
|------|--------|-------|
| 1 | Query embedding via all-MiniLM-L6-v2 | `THESIS REQUIREMENT` |
| 2 | Cosine similarity search against pgvector document store | `THESIS REQUIREMENT` |
| 3 | Top-K document chunks + user query → LLM prompt | `THESIS REQUIREMENT` |
| 4 | No RF invocation, no status masking | `THESIS REQUIREMENT` — RF is only for faculty queries |

#### 3b. Campus Navigation Queries
*Example: "Where is the College of Engineering building?"*

| Step | Action | Label |
|------|--------|-------|
| 1 | Query embedding + cosine similarity retrieval (same as general) | `THESIS REQUIREMENT` |
| 2 | Geospatial data for the matched building/POI is included in the context | `THESIS REQUIREMENT` — Section 3.5.1: geospatial data points are *"associated with contextual metadata"* |
| 3 | LLM generates response with location information | `THESIS REQUIREMENT` |
| 4 | Frontend highlights the location on the Leaflet.js map | `IMPLEMENTATION DECISION` — thesis states the map enables users to *"visually locate buildings"* but does not specify chatbot→map coordination |

#### 3c. Faculty Availability Queries
*Example: "Is Prof. Santos available right now?"*

| Step | Action | Label |
|------|--------|-------|
| 1 | Extract faculty identifier from the query | `IMPLEMENTATION DECISION` |
| 2 | Check deterministic guard logs (Supabase) | `THESIS REQUIREMENT` — Section 3.5.3 code sample |
| 3 | If off-campus → return "Unavailable", bypass RF | `THESIS REQUIREMENT` |
| 4 | If on-campus → invoke RF Flask microservice with `(faculty_id, current_time, current_day, ...)` | `THESIS REQUIREMENT` |
| 5 | Apply status masking → produce categorical status string | `THESIS REQUIREMENT` |
| 6 | Simultaneously retrieve relevant document chunks via RAG | `THESIS REQUIREMENT` — Section 3.5.4 step (4): *"simultaneously"* |
| 7 | Context Fusion: merge query + document chunks + masked status → LLM | `THESIS REQUIREMENT` |

#### 3d. Combined / Ambiguous Queries
*Example: "Where is Prof. Santos and is she available?"*

| Step | Action | Label |
|------|--------|-------|
| 1 | Treat as a faculty availability query (superset — includes geospatial context) | `IMPLEMENTATION DECISION` |
| 2 | Execute the full Enhanced RAG pipeline (3c above) | `IMPLEMENTATION DECISION` |
| 3 | Geospatial data for the faculty member's department/building is included in the retrieved context | `IMPLEMENTATION DECISION` |

#### Routing Mechanism

| Decision | Label |
|----------|-------|
| Use the **LLM itself** (via a lightweight classification prompt) to categorize the query before processing | `IMPLEMENTATION DECISION` — the thesis does not specify the mechanism; LLM-based routing is the most robust approach for natural language queries |
| **Alternative considered:** Keyword-based routing (regex for faculty names, "where is", "available") — simpler but brittle | `IMPLEMENTATION DECISION` — acceptable as a first pass; can be upgraded |
| The routing decision should be logged for RAGAS evaluation purposes | `IMPLEMENTATION DECISION` |

> [!IMPORTANT]
> **Researcher decision needed:** Should query routing use a quick LLM call (more accurate, adds ~200ms latency) or keyword matching (faster, less accurate)? A hybrid approach (keywords first, LLM fallback) is also viable.

---

## 4. Guard / Security Presence Logging

### What the thesis says

- Section 3.5: *"a dedicated security dashboard for manual campus presence tracking"*
- Section 3.5.3 (code): `isFacultyOnCampus = await checkGuardLogs(facultyId)` — boolean check
- IPO Model (Section 2.2): *"real-time manual campus presence logs provided by security personnel"*
- Section 3.5.3: Used as a **deterministic override** — if guard says "left campus," system bypasses RF entirely

### Minimum Viable Data Model

`THESIS REQUIREMENT` — the data model must support the guard log check shown in the code sample.

```
Table: guard_presence_logs
─────────────────────────────────
id              UUID (PK, auto)
faculty_id      UUID (FK → faculty)
is_on_campus    BOOLEAN
logged_by       UUID (FK → guard user)
logged_at       TIMESTAMP (auto, UTC)
```

**Why this is minimal:**
- The thesis code sample checks a single boolean: `isFacultyOnCampus`
- The system only needs the **most recent log entry** per faculty member
- No check-out time is needed — a new entry with `is_on_campus = false` supersedes the previous

### Minimum Viable Workflow

| Step | Action | Label |
|------|--------|-------|
| 1 | Security personnel opens the Security Dashboard | `THESIS REQUIREMENT` |
| 2 | Security selects a faculty member (from a list/search) | `IMPLEMENTATION DECISION` — thesis does not specify the selection UI |
| 3 | Security toggles presence status: "On Campus" / "Left Campus" | `IMPLEMENTATION DECISION` — derived from the boolean nature of the code sample |
| 4 | System records the log entry with timestamp and guard identity | `IMPLEMENTATION DECISION` |
| 5 | When a faculty availability query arrives, system queries the most recent log for that faculty member | `THESIS REQUIREMENT` |

| Decision | Label |
|----------|-------|
| Guard accounts require authentication (login) to prevent unauthorized log entries | `IMPLEMENTATION DECISION` — thesis doesn't specify but this is a minimum security requirement for data integrity |
| The guard dashboard is a **separate, simple interface** — not the chatbot | `THESIS REQUIREMENT` — thesis says *"dedicated"* dashboard |
| No notification system for guards (e.g., push alerts) | Not adding — `UNSPECIFIED / REQUIRES RESEARCHER DECISION` |
| No batch import of guard logs | Not adding — `UNSPECIFIED / REQUIRES RESEARCHER DECISION` |

---

## 5. Embedding Execution

### What the thesis says

- Section 3.7: *"the system will employ the all-MiniLM-L6-v2 sentence transformer model"*
- Section 3.7: *"lightweight inference requirements... enabling efficient embedding generation without requiring dedicated GPU infrastructure"*
- Architecture: Node.js + Express.js backend; Python + Flask microservice for RF

### Tradeoff Analysis

| Option | Pros | Cons |
|--------|------|------|
| **A: Run in the Python Flask microservice** | Natural home for ML models; `sentence-transformers` library is Python-native; single ML runtime; model loaded once at startup | Adds embedding responsibility to the RF microservice (coupling); every query requires a Python HTTP call for embeddings |
| **B: Run in Node.js via `@xenova/transformers`** | Keeps embedding in the main request path (lower latency); Node.js handles the web request directly; no cross-service HTTP call for embeddings | JavaScript ML ecosystem is less mature; model loading is heavier in Node.js; mixes ML inference into the web server |
| **C: Separate Python embedding microservice** | Clean separation of concerns; independently scalable | Over-engineering for a thesis project; adds a third service to manage |

### Decision

| Decision | Label |
|----------|-------|
| Run all-MiniLM-L6-v2 in the **Python Flask microservice** alongside the RF model | `IMPLEMENTATION DECISION` |
| Expose two endpoints: `/predict` (RF classification) and `/embed` (text embedding) | `IMPLEMENTATION DECISION` |
| The model is loaded once at Flask startup and kept in memory | `IMPLEMENTATION DECISION` |

**Rationale:** This preserves the thesis architecture (Python for ML, Node.js for web serving) and avoids introducing a JavaScript ML dependency. The Flask service becomes the single "AI microservice" — which aligns with Section 3.7: *"This microservice architecture ensures separation of concerns between the web application layer and the machine learning inference layer."*

> [!NOTE]
> If researchers prefer to keep the Flask service strictly for RF, the Node.js `@xenova/transformers` option is viable but departs slightly from the thesis's separation-of-concerns principle. This is a low-stakes decision.

---

## 6. Privacy — Minimum Technical Safeguards

### What the thesis requires

The thesis describes a specific three-step protocol (Section 3.5.3) and a legal compliance claim (RA 10173, Section 3.10). The implementation must faithfully reproduce the protocol; it should not add unsupported legal compliance claims.

### Minimum Safeguards

| # | Safeguard | Label |
|---|-----------|-------|
| P1 | **Status masking hash map**: Backend middleware maps RF output labels to user-facing status strings before any LLM or frontend exposure | `THESIS REQUIREMENT` |
| P2 | **Variable purging**: After mapping, the raw RF prediction variable is set to `null`/deleted — not retained in the request context, session, or logs accessible to users | `THESIS REQUIREMENT` — code sample: `rawPrediction = null;` |
| P3 | **LLM prompt contains only the masked status string** — never raw predictions, probability vectors, room numbers, or faculty schedule details | `THESIS REQUIREMENT` — Section 3.5.3: *"Only the sanitized, generalized status string is transmitted as context"* |
| P4 | **No exact faculty location is stored, transmitted, or displayed to end users** — this is the hard boundary | `THESIS REQUIREMENT` — Section 3.5.3 final paragraph |
| P5 | **Attendance training data is anonymized** — PII removed, only temporal patterns retained | `THESIS REQUIREMENT` — Section 3.4, Phase 1 |
| P6 | **Guard logs accessible only to authenticated security personnel** — not exposed via the chatbot or public API | `IMPLEMENTATION DECISION` — necessary to enforce P4 |
| P7 | **The internal probability vector** (`{available: 0.72, ...}`) may be logged server-side for research evaluation but must never be included in API responses to the frontend | `IMPLEMENTATION DECISION` |

### What NOT to claim

| Claim | Status |
|-------|--------|
| "The system is fully compliant with RA 10173" | ❌ **Do not claim.** The thesis says the system is *designed* to comply. Full legal compliance requires a formal Data Protection Impact Assessment, which is outside the scope of the thesis. |
| "End-to-end encryption" | ❌ **Not stated.** Do not implement or claim unless researchers decide to. |
| "GDPR compliance" | ❌ **Not stated.** The thesis references only Philippine law (RA 10173). |

---

## 7. Website Scope — First Working Version

### MUST HAVE — Directly supported by the thesis

These features are required for the system to match the thesis specification and support the evaluation methodology.

| # | Feature | Thesis Source |
|---|---------|---------------|
| M1 | **Chatbot interface** — text input, natural language responses, conversation display | Sec 3.5, 3.5.4 |
| M2 | **Interactive campus map** — Leaflet.js rendering GPS coordinates of buildings, offices, POIs | Sec 3.5.1 |
| M3 | **Faculty availability query flow** — full Enhanced RAG pipeline: guard check → RF → masking → RAG retrieval → Context Fusion → LLM response | Sec 3.5.2–3.5.4 |
| M4 | **General/institutional query flow** — RAG retrieval → LLM response (no RF) | Sec 3.5 |
| M5 | **Security dashboard** — dedicated page for guards to log faculty on-campus/off-campus status | Sec 3.5 |
| M6 | **Status masking middleware** — hash map translation + variable purging | Sec 3.5.3 |
| M7 | **Document ingestion pipeline** — chunk, embed, store in pgvector | Sec 3.5.4 |
| M8 | **RF Flask microservice** — `/predict` endpoint callable from Node.js backend | Sec 3.7 |
| M9 | **Supabase database** — tables for geospatial data, faculty schedules, guard logs, document embeddings | Sec 3.7 |

### SHOULD HAVE — Reasonable for a complete thesis demonstration

| # | Feature | Rationale | Label |
|---|---------|-----------|-------|
| S1 | **Map-chatbot coordination** — when the chatbot mentions a building, highlight it on the map | Improves demonstration quality; thesis implies location-aware responses | `OPTIONAL IMPROVEMENT` |
| S2 | **Loading/typing indicators** — visual feedback during LLM response generation | Standard UX for chatbots; Groq API has variable latency | `OPTIONAL IMPROVEMENT` |
| S3 | **Confidence indicator** — display a qualitative confidence level (e.g., "High confidence") alongside the status | Not in thesis but adds research value; probability vector is already available internally | `OPTIONAL IMPROVEMENT` |
| S4 | **Admin data management page** — interface to upload/manage institutional documents and faculty schedules | Thesis mentions data ingestion but no admin UI; a script-based ingestion is sufficient for MVP | `OPTIONAL IMPROVEMENT` |
| S5 | **Guard authentication** — login flow for security personnel | Thesis does not specify but is necessary for data integrity | `IMPLEMENTATION DECISION` |
| S6 | **Error handling for Groq API failures** — graceful degradation message | Not in thesis but critical for live demonstration reliability | `IMPLEMENTATION DECISION` |

### DO NOT BUILD (for V1)

| Feature | Reason |
|---------|--------|
| Student login/registration | ❌ Not in thesis — the chatbot appears to be public |
| Faculty self-service portal | ❌ Not in thesis |
| Mobile native app | ❌ Thesis specifies web-based only |
| Push notifications | ❌ Not in thesis |
| Historical analytics dashboard | ❌ Not in thesis |
| Multi-language support | ❌ Not in thesis |
| Offline mode | ❌ Not in thesis |

---

## 8. Research Integrity Constraints

### The coding agent must NOT fabricate:

| # | Item | Explanation |
|---|------|-------------|
| R1 | **Trained RF model or its accuracy metrics** | The thesis is a proposal. No model has been trained. The code should include the training pipeline but the model must be trained on **actual ISU data** collected by the researchers. |
| R2 | **Faculty schedule data** | Must come from ISU department heads. Placeholder/synthetic data may be used for development testing but must be clearly labeled as synthetic and replaced before evaluation. |
| R3 | **Geospatial coordinates** | Must come from actual GPS mapping of the ISU Echague campus. Placeholder coordinates may be used during development but must be replaced. |
| R4 | **Institutional documents** | Must be real university memoranda, calendars, handbooks. The RAG pipeline should be buildable and testable with placeholder documents, but evaluation must use real data. |
| R5 | **RAGAS evaluation results** | These are the thesis's primary quantitative evidence. They must be computed from real system outputs against researcher-prepared ground-truth answers. |
| R6 | **Faculty validation results** | Classification accuracy, precision, recall, F1, confusion matrix — all must come from actual faculty validators interacting with the live system. |
| R7 | **Guard presence logs** | Must reflect actual security personnel entries during the evaluation period. |
| R8 | **Historical attendance records** | Must come from departmental logbooks or HR biometric systems, anonymized per the thesis. |

### Critical distinction

| Category | What it means for the codebase |
|----------|-------------------------------|
| **Proposed functionality** | The system should be **built and functional** — this is the development deliverable |
| **Validated results** | The system's outputs must be **evaluated with real data and real users** — this is the research deliverable. The codebase must not hardcode, simulate, or fabricate evaluation results. |

> [!CAUTION]
> Any synthetic/placeholder data used during development must be clearly segregated (e.g., in a `seed/` or `dev-data/` directory) and must be trivially replaceable with real data. The evaluation must never run against synthetic data.

---

## Decisions Requiring Researcher Approval

The following decisions must be confirmed by Michael and Christian before coding begins:

| # | Decision | Options | Recommended |
|---|----------|---------|-------------|
| **D1** | RF prediction target | (A) Predict 3 status classes directly, or (B) Predict location classes with hash map translation | **(A) Status classes** — more faithful to Section 3.5.2, feasible with stated data sources |
| **D2** | Query routing mechanism | (A) LLM-based classification (~200ms overhead), (B) Keyword/regex matching (fast, brittle), (C) Hybrid (keywords first, LLM fallback) | **(C) Hybrid** — pragmatic balance |
| **D3** | Embedding model execution | (A) Python Flask service (alongside RF), (B) Node.js via `@xenova/transformers`, (C) Separate Python service | **(A) Python Flask** — preserves thesis architecture |
| **D4** | Guard dashboard authentication | (A) Supabase Auth (email/password), (B) Simple shared PIN, (C) No auth for now | **(A) Supabase Auth** — minimum viable security |
| **D5** | Student/public user authentication | (A) Required login, (B) Public/anonymous access to chatbot + map | **(B) Public access** — thesis does not mention student auth |
| **D6** | Synthetic development data | (A) Build with placeholders and replace later, (B) Wait for real data before any development | **(A) Placeholders** — enables parallel work; clearly labeled |
| **D7** | Map-chatbot coordination | (A) Build interactive map-chatbot linking for V1, (B) Map and chatbot are independent features for V1 | Researchers decide — both are defensible |
| **D8** | Confidence display to users | (A) Show qualitative confidence (High/Medium/Low), (B) Show only categorical status (thesis-faithful) | **(B) Status only** — thesis-faithful; confidence can be added later |
