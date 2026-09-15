# machine-learning — what each file is

One line each. If a panelist opens a file, this is what it does.

Everything at this level either **runs in the deployed system** or **produced a
number in the thesis**. Build scripts and one-off utilities live in `tools/`.

---

## The deployed service

`start.bat` launches exactly one thing from this folder: `ai_api_service.py`.

| File | What it does |
|---|---|
| **`ai_api_service.py`** | The Flask service on port 5001. Hosts the sentence embedder and the classifier. The backend calls it; it is never exposed publicly. |
| **`feature_engineering.py`** | The 11 features, and the single source of truth for their order. Training and serving both import this so the two cannot drift. |
| **`database_connector.py`** | PostgreSQL access. Imported by almost everything here. |

## Ingestion — how documents and timetables get in

| File | What it does |
|---|---|
| **`document_upload.py`** | Accepts an uploaded document, hands it to the importer. |
| **`document_knowledge_importer.py`** | Chunks a document, propagates the parent heading into each chunk, embeds, stores. |
| **`schedule_upload.py`** | Accepts the departmental timetable workbook. |
| **`schedule_importer.py`** | Parses that workbook into class blocks. |
| **`calendar_parser.py`** | Parses the academic calendar into dated events. |

## The research — where the Chapter 4 numbers come from

| File | What it does |
|---|---|
| **`generate_synthetic_attendance.py`** | Generates the SIM-01..37 cohort. Real Daily Time Records could not be requested (RA 10173), so attendance is simulated against the real timetable. |
| **`dataset_loader.py`** | Builds the labelled training set from the schedule and the attendance rows. |
| **`train_availability_model.py`** | Trains the Random Forest. 300 trees, Gini, time-based split. Writes the model and its metrics to `rf_model_version`. |
| **`schedule_rule_baseline.py`** | The deterministic timetable lookup the model is compared against. |
| **`evaluate_rag_quality.py`** | RAGAS scoring. Four metrics, judged by a model deliberately different from the generator. |

## For the defense

| File | What it does |
|---|---|
| **`defense_results.ipynb`** | Every reported number, read live from the database, one section per objective. Run this rather than showing a table. |
| **`show_results.py`** | The same thing as a single script, if a terminal is easier than a notebook. |
| **`show_tree.py`** | Prints the decision rules of one tree out of the served forest. The answer to "can I see a tree?" |

## Folders

| | |
|---|---|
| `saved-models/` | The trained model artifacts. `rf-20260909-072845` is the one being served. |
| `training-data/` | The real CCSICT timetable workbook and the generated attendance workbook. |
| `institutional-documents/` | Source documents for the corpus. |
| `presentation/` | Diagram and screenshot generators. |
| `tools/` | Build scripts and one-off utilities. Nothing here runs in the system. |

---

## If you only remember three

1. **`feature_engineering.py`** — "what does the model look at?"
2. **`train_availability_model.py`** — "how was it trained?"
3. **`evaluate_rag_quality.py`** — "how did you get the RAGAS scores?"

Those are the three an AI panel is most likely to open.
