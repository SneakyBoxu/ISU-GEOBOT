# ISU-GeoBot — Final Pre-Implementation Audit

**Role of this document:** adversarial architecture review, performed independently against the thesis PDF, of the earlier `thesis_analysis.md` and `implementation_decisions.md`.
**Authoritative source:** `ISU_GeoBot_revised1.pdf` (Chapters 1–3 only; no Chapter 4/5 exists).
**Audience:** Michael Allan Almario, Christian Paul Simbulan → then handed to the implementing agent.
**Status of the system:** nothing has been built. No model trained. No data collected. Every number in this project is currently unknown and must stay unknown until measured.

---

## 0. Headline verdict

The previous report is **directionally right on the two questions it chose to focus on** (Random Forest predicts status, not location; probabilities stay internal) but is **wrong or dangerously thin on six things that matter more**:

| # | Previous report said | Audit finds |
|---|---|---|
| 1 | Guard log = `BOOLEAN is_on_campus`, "no check-out needed", "this is minimal" | **Breaks the entire study.** A two-state boolean makes "no log" indistinguishable from "left campus", so every faculty member defaults to `Unavailable`, the RF is never invoked, and the Enhanced RAG contribution never fires. Must be tri-state and time-scoped. → **F-07 (BLOCKER)** |
| 2 | Listed 9 MUST-HAVE features (M1–M9) | **The most important thesis-required component is missing from that list: the Standard RAG baseline pipeline.** Specific Objective 2 is a comparison. No baseline, no thesis. Also missing: response-time instrumentation, evaluation-run logging, rule-based schedule baseline. → **F-01, F-02, F-03 (BLOCKER)** |
| 3 | Status masking = hash map + variable purge | **Masking as specified only filters the LLM's _input_. Nothing constrains the LLM's _output_, and nothing constrains the RAG corpus** — which the thesis explicitly says contains "faculty directory information". A navigation query can retrieve a professor's office room number straight out of a retrieved chunk, bypassing the protocol entirely. → **F-27, F-28 (BLOCKER)** |
| 4 | Restated the thesis's "no PII stored" as NFR-01 | **The thesis contradicts itself and the previous report propagated it.** The system cannot answer "Is Prof. Santos available?" without storing faculty identity, and the guard table is a real-time personal presence log. That *is* personal information under RA 10173. Most likely single question to sink the defense. → **F-25 (BLOCKER)** |
| 5 | Treated Interpretation A as settled with three reasons | Right answer, **partly wrong reasoning**, and it missed the strongest evidence (§1.3 Scope and Delimitation) *and* a real unresolved conflict it waved away as "a simple renaming": the thesis contains **three mutually inconsistent class vocabularies**, and `Late → "Currently in a Lecture"` is not a rename, it is a different variable. → **F-09, F-10 (MAJOR)** |
| 6 | Labelled ~20 items `THESIS REQUIREMENT` | Roughly a third of those are **inferences, not statements**. Over-labelling is itself a defense risk: one "where does the thesis say that?" you cannot answer costs credibility for everything after it. → **F-06 (MAJOR)** |

Beyond correcting the previous report, this audit raises **fourteen issues neither prior document mentions at all**, including: the RAGAS comparison being structurally unable to move two of its four metrics (**F-04**), the thesis's stated method for justifying ML not actually supporting its claim (**F-20**), the anonymisation-versus-personalisation contradiction in the RF features (**F-19**), the aggregation attack on a public chatbot (**F-29**), the all-MiniLM-L6-v2 256-token truncation trap (**F-34**), and the complete absence of any homepage analysis (**Section 10**).

**Nothing here blocks starting work.** The ingestion, map, and UI shell tracks can begin immediately (Section G). What is blocked is anything touching the evaluation harness, the guard data model, or the privacy boundary, until the decisions in Section C are made.

### Classification legend

| Tag | Meaning |
|---|---|
| `[TR]` | **THESIS REQUIREMENT** — the thesis states it. Quotable. |
| `[ID]` | **IMPLEMENTATION DECISION** — thesis is silent; we choose; defensible either way. |
| `[OI]` | **OPTIONAL IMPROVEMENT** — not needed to satisfy the thesis. |
| `[RD]` | **UNSPECIFIED / RESEARCHER DECISION** — Michael and Christian must decide; it changes the research, not just the code. |

Severity: **BLOCKER** (do not start the affected component) · **MAJOR** (defensible answer required before defense) · **MINOR**.

---

## 1. Requirements completeness

### 1.1 Requirements the previous report MISSED

#### F-01 — The Standard RAG baseline is a build deliverable and is absent from the MUST-HAVE list · BLOCKER · `[TR]`

> §1.2 Specific Objective 2: *"To evaluate and compare the performance of the **standard and Enhanced RAG architectures**…"*
> §3.4 Phase 2: *"Once **both the standard RAG and Enhanced RAG pipelines are operational**, the researchers will conduct the Technical AI Evaluation."*
> §3.8.1: *"…compare the outputs of the **standard RAG pipeline (retrieval + LLM only)** against the Enhanced RAG pipeline (retrieval + Random Forest classification + LLM)…"*

The previous report's MUST-HAVE table (M1–M9) does not contain it. This is the **primary evaluation methodology of the entire thesis**. Without a runnable Standard RAG arm there is no Chapter 4.

**Hard architectural constraint this imposes:** the two arms must differ in *exactly one* variable — the presence of the fused status block. Same retriever, same K, same embedding model, same LLM, same temperature, same prompt template, same router. If the standard arm uses a different prompt, the comparison is confounded and a panelist can void the result.

**Consequence:** the pipeline must be built as **one code path with a mode flag**, not two pipelines. `mode ∈ {standard, enhanced}`. The only branch is whether the fusion step appends the status block.

#### F-02 — Response Time is a required reported metric with no instrumentation planned · BLOCKER · `[TR]`

> §1.2 Objective 2: *"…in terms of **Response Time** and RAGAS metrics…"*

Neither prior document specifies capturing it, and it cannot be reconstructed after the fact.

Two sub-issues, both `[RD]`:

- **End-to-end or component-level?** The thesis does not say. Enhanced RAG will be **slower** — it adds a guard-log query plus an HTTP round-trip to Flask. You will be reporting a regression on one of your four headline comparisons. You need component-level timings so you can say *"the RF path adds N ms, which is the cost of the availability capability"* rather than just *"ours is slower."*
- **Groq latency is the dominant term and it is not yours.** It varies by minute and by queue depth. If you measure the two arms at different times you are measuring Groq's load, not your architecture. **Both arms must be run interleaved in the same session**, and you should report median and p95 over repeated runs, never a single measurement.

**Minimum instrumentation:** per request record `t_route, t_guard, t_rf, t_embed, t_retrieve, t_llm, t_total`, plus `mode`, `groq_model_id`, `run_id`.

#### F-03 — No persistence layer for evaluation artifacts · BLOCKER · `[TR]` (implied by §3.8.1 and §3.9)

RAGAS requires, per query, a tuple of `question`, `contexts` (the retrieved chunks, verbatim), `answer`, `ground_truth`. If the system does not persist the exact retrieved chunks at generation time, RAGAS cannot be computed and the run cannot be reproduced.

Neither prior document has a table for this. It is not optional — Context Precision and Context Recall are *defined over the retrieved contexts*.

#### F-04 — Two of the four RAGAS metrics are structurally incapable of distinguishing the two arms · BLOCKER · `[RD]`

**This is the most consequential finding in the audit and neither prior document raises it.**

Context Precision and Context Recall are **retriever metrics**. The Enhanced RAG uses the *identical retriever* as the Standard RAG — injecting an RF status downstream does not change which chunks come back from pgvector. Therefore, under the naive reading, **Context Precision and Context Recall are identical between arms by construction.** You would present two of four primary metrics as a flat comparison and be asked why you bothered.

Faithfulness is worse than flat — it may move the *wrong way*. Faithfulness scores whether every claim in the answer is inferable from the retrieved context. For an availability query:

- **Standard arm** has no availability context, so a well-behaved LLM says *"I don't have information about that."* Perfectly faithful → **1.0**.
- **Enhanced arm** asserts *"Prof. Santos is currently in a lecture."* If the status is not counted as part of the context, that claim is **unsupported** → **score drops**.

**Left as-is, the thesis's own primary evaluation is set up to show Standard RAG beating Enhanced RAG on two metrics and tying on two.**

**The fix — a research decision, not a coding decision:** the masked status must be passed to RAGAS as a **context item** in the Enhanced arm's `contexts` list, not merely embedded in the prompt string. It *is* retrieved context; it is simply retrieved from the RF module rather than from pgvector. This is a legitimate and explainable framing, and it is consistent with the thesis's own language — §3.5.4 calls Context Fusion the merging of *"three distinct information sources"* into the prompt. Under that framing:

| Metric | Effect |
|---|---|
| **Context Recall** | rises for the Enhanced arm on availability queries — the ground truth contains an availability claim only the Enhanced arm's context supports ✅ |
| **Context Precision** | roughly flat; the status is relevant when the query is about availability ⚠️ still weak |
| **Faithfulness** | now scores the Enhanced arm fairly ✅ |
| **Answer Relevancy** | where the Enhanced arm should win most clearly — the Standard arm cannot answer the question asked ✅ |

**This must be decided before the pipeline is written**, because it determines what the pipeline must *log*. Retrofitting is not possible.

**Second-order issue, also `[RD]`:** the **composition of the curated test set** determines the result. If most queries are navigation/institutional, the RF never fires and the arms are identical. If all are availability queries, you are not evaluating a campus assistant. The mix is a defensible research choice but it **must be written down before any run**, and reported. Choosing the mix after seeing results is p-hacking and a panelist may name it as such.

#### F-05 — The RAGAS judge model is unspecified, and the obvious choice is biased · MAJOR · `[RD]`

RAGAS is not a closed-form formula. Three of its four metrics use an LLM to decompose claims and generate synthetic questions, plus an embedding model for Answer Relevancy. The thesis names neither.

Using **Llama 3.1 8B as both generator and judge** is self-evaluation. A panelist who knows RAGAS will ask. Additionally, 8B-class models are weak at claim decomposition and produce noisy Faithfulness scores.

`[RD]` **Decide and disclose:** (a) which model judges; (b) that it differs from the generator; (c) the embedding model used for Answer Relevancy — all-MiniLM-L6-v2 is legitimate here and keeps the stack consistent; (d) judging temperature 0. Whatever you choose, **the identical judge configuration must be used for both arms, in the same session.**

#### F-06 — Systematic over-labelling of inferences as `THESIS REQUIREMENT` · MAJOR · methodological

Spot-check of `implementation_decisions.md` §3:

| Previous label | Actual status | Evidence |
|---|---|---|
| "No RF invocation for general queries" = `TR` | `[ID]` | Thesis never says this. Sound inference, but an inference. |
| "Geospatial data for the matched building is included in the context" = `TR` | `[RD]` — **and it hides a real architecture fork** (F-37) | §3.5.1 says POIs carry metadata. It does *not* say geospatial rows enter the LLM prompt. |
| "Invoke RF with `(faculty_id, current_time, current_day, …)`" = `TR` | `[TR]` for *"Flask microservice over HTTP"*; `[ID]` for the payload | §3.7 states the transport only. |
| "Frontend highlights location on Leaflet" = `ID` | ✅ correct |
| "Top-K chunks → LLM" = `TR` | `[TR]` for retrieve-then-generate; **K itself is `[RD]`** | No value of K appears anywhere in the thesis. |

The pattern matters more than any single row. **Rule for the implementing agent: if you cannot paste a sentence from the PDF, it is not `[TR]`.**

#### F-07 — Guard presence log: the previous report's data model breaks the study · BLOCKER · `[RD]`

The thesis's illustrative code is:

```
let isFacultyOnCampus = await checkGuardLogs(facultyId);
if (!isFacultyOnCampus) { safeStatus = "Unavailable"; }
```

The previous report took this literally, specified `is_on_campus BOOLEAN`, and asserted *"No check-out time is needed"* and *"this is minimal."* Three failures follow:

1. **No-log is indistinguishable from off-campus.** An unlogged faculty member (`undefined`) takes the `Unavailable` branch. On day one of the evaluation period, with a guard who has logged nobody, **every** faculty member is `Unavailable`, the RF is **never invoked**, and the thesis's entire claimed contribution is dead code during its own validation — while faculty validators dutifully rate the accuracy of a path that never ran.
2. **No staleness bound.** A log written last Tuesday still reads `true` today. "Real-time presence" backed by a week-old row is indefensible.
3. **Guards do not have full coverage.** Multi-gate campus, shift changes, unmanned entrances. Absence of evidence is not evidence of absence; the boolean encodes it as such.

**Required model — tri-state, time-scoped:**

| Value | Meaning | System behaviour |
|---|---|---|
| `confirmed_on_campus` | arrival logged, within validity window | → proceed to RF |
| `confirmed_off_campus` | departure logged, within validity window | → deterministic override, return `Unavailable`, **skip RF** `[TR]` |
| `unknown` | no log, or last log outside the validity window | → **proceed to RF** `[ID]` |

The `unknown → proceed to RF` rule is an implementation decision, but it is the *only* one under which the thesis's evaluation can run. It is also the more honest one: the RF is precisely the component meant to estimate presence when ground truth is absent.

`[RD]` **Set the validity window.** Same-calendar-day is the natural default and easy to defend ("a departure log governs until end of day"). Anything longer is not defensible as "real-time".

`[RD]` **Decide whether the deterministic override is inside the evaluation at all.** If guards log inconsistently, the override fires unpredictably and becomes an uncontrolled variable in your accuracy numbers. Honest options: (a) keep it and report override-rate alongside accuracy; (b) keep it but exclude override-served queries from the RF accuracy computation and report them separately; (c) descope guard logging to demonstrated-but-not-evaluated. **(b) is the most defensible** — you keep the architecture the thesis describes, and your RF accuracy number actually measures the RF.

#### F-08 — No mechanism specified for capturing the faculty validation checklist · MAJOR · `[RD]`

§3.8.2 requires each validator to record, per query: the system's estimated status, their actual status, and correct / partially correct / incorrect. §3.9 computes accuracy, per-category precision, recall, F1, and a confusion matrix from it.

Note that the three-level correctness scale does **not** map onto a confusion matrix, which needs `(predicted, actual)` pairs. **"Partially correct" has no cell.** `[RD]` Either drop it, or define it explicitly — e.g. recorded but excluded from the confusion matrix and reported separately. Decide *before* validators start, not after.

`[RD]` **Paper form or in-system capture?** Paper is zero build cost and thesis-sufficient. In-system capture is stronger evidence — the system's own prediction is recorded automatically, so validators cannot misremember what it said — and costs one small authenticated page. **Recommendation: in-system, because it removes a transcription-error attack on your results.** Your call; it adds a table and a screen.

### 1.2 Requirements the previous report INCORRECTLY interpreted

#### F-09 — "The thesis's three status vocabularies are a simple renaming" is false · MAJOR · `[RD]`

The previous report dismissed the label mismatch as *"a simple renaming."* It is not. The thesis contains **three different class vocabularies**:

| Source | Vocabulary |
|---|---|
| §3.5.2, Gini definition | `{Available, Late, Absent}` |
| §3.5.4, Context Fusion | `{Available, In a Lecture, Absent}` |
| §3.5.2 output sentence, §3.3, §3.9 | `{Available for Consultation, Currently in a Lecture, Unavailable}` |

`Late` and `Currently in a Lecture` are **not the same variable**. "Late" is an attendance-behaviour class (arrived after scheduled start). "Currently in a Lecture" is a schedule-state class (has a scheduled class right now). Mapping one to the other is not a rename; it is a silent change of what is being predicted. A panelist reading §3.5.2 and §3.9 side by side will notice.

**Resolution — and this is the defensible one:** the **third** vocabulary is binding, because it is the one the *evaluation* is defined over. §3.9 computes per-category precision and recall explicitly for `"Available for Consultation," "Currently in a Lecture," "Unavailable"`, and §3.3 states that faculty confirm against exactly those three. The `{Available, Late, Absent}` list in the Gini paragraph is best read as an illustrative instantiation of the symbol `C`, not as a specification.

`[RD]` **Michael and Christian must state this in writing** — that the model's three classes are the three evaluated classes, and that the Gini paragraph's list is illustrative. If they instead intend `Late` to be a real class, the evaluation section is wrong and Chapter 3 needs an erratum. **Do not let the implementing agent pick silently.**

#### F-10 — The previous report's RF argument omitted its own strongest evidence · MAJOR

The previous report defended Interpretation A (status prediction) on three grounds, the weakest of which was *"the Gini formula lists Available/Late/Absent"* — a list that F-09 has just shown is itself unreliable, so it is a poor pillar.

It **missed the decisive citation**, which is §1.3 Scope and Delimitation:

> *"The probabilistic Random Forest model will **analyze temporal schedule data to output a generalized faculty availability status** (e.g., "Available for Consultation," "Currently in a Lecture," or "Unavailable") **rather than outputting exact physical room coordinates**."*

A Scope and Delimitation statement is the binding declaration of what the study does and does not do. It is the one section a panel treats as contractual. It says, in one sentence, that the model outputs a status and explicitly *not* coordinates. **Lead with this.** See Section 3 for the full treatment.

#### F-11 — "The Security Dashboard is well specified" · MAJOR

The previous report devotes a full section to guard dashboard workflow and data model, presented with high confidence. The actual textual basis in the thesis is **two clauses**:

- §3.5: *"…and a dedicated security dashboard for manual campus presence tracking."*
- §2.2 Phase 1: *"…and real-time manual campus presence logs provided by security personnel."*

Plus one function call in an illustrative code block. That is the whole specification. Everything else — the selection UI, the toggle, the identity of the logger, the workflow — is `[ID]` at best, and the previous report labelled several of these steps `THESIS REQUIREMENT`. See Section 7.
---

## 2. Architectural correctness

The stack itself is **thesis-mandated and correct** — React 18, Leaflet 1.9, Node 20 + Express 4, Supabase/PostgreSQL + pgvector, Python 3.11 + scikit-learn 1.4 behind Flask, Llama 3.1 8B via Groq, all-MiniLM-L6-v2. §3.7 names every one of these. Do not substitute any of them without recording the deviation. The problems are not in the component list; they are in the **boundaries and the flow**.

### 2.1 Frontend

| Finding | Class |
|---|---|
| React 18 + Leaflet 1.9 | `[TR]` §3.7 |
| Three surfaces: interactive map, chatbot, security dashboard | `[TR]` §3.5 |
| SPA vs SSR, router, state management, CSS framework, component library | `[RD]` — thesis silent. **Recommend plain SPA (Vite + React Router).** SSR buys nothing here and adds a deployment dimension you would have to defend. |
| Map and chatbot on one screen or separate routes | `[RD]` — thesis silent. **Recommend one screen, split pane, because it demonstrates Context-Aware Navigation (§2.3 def. 1) in a single frame during the defense.** |
| *"web-based system to ensure accessibility across different devices"* (§1.3) | `[TR]` as a **claim you have made**. If you claim it you should be able to show it. Responsive layout is therefore not optional polish — it is a claim you must be able to demonstrate on a phone in the defense room. |

#### F-12 — The security dashboard should not ship inside the public bundle · MAJOR · `[ID]`

If the guard dashboard is a route in the same React app, its code, its Supabase table names, and its query shapes are in the JavaScript every anonymous visitor downloads. That is not a vulnerability by itself, but it hands an attacker the map of your most sensitive table (F-30). **Recommend: separate route with lazy-loaded chunk at minimum; separate small app ideally.** `[OI]`

### 2.2 Backend

| Finding | Class |
|---|---|
| Node 20 + Express 4 routes queries to modules | `[TR]` §3.5, §3.7 |
| Status masking implemented as Node middleware | `[TR]` §3.5.3 — *"The backend server utilizes a predefined associative array (hash map) to intercept this raw output"* |
| Context Fusion implemented in Node | `[TR]` §3.5.4 by placement in the backend tier |

#### F-13 — Masking-in-Node is only safe under Interpretation A · MAJOR · analysis

Worth stating explicitly because it is a *supporting argument* for the RF decision in Section 3. If the RF returned physical room labels (Interpretation B), those labels would cross a network boundary — Flask → HTTP → Node — before being masked. They would land in Flask access logs, Node request logs, and any proxy in between. A privacy protocol whose sensitive value traverses the network and is written to three log files before being sanitised is not a privacy protocol.

Under **Interpretation A** the raw value never encodes a location at all, so masking-in-Node is sound. **This is an independent architectural argument for Interpretation A that neither prior document makes**, and it is a good answer to give if a panelist asks why masking lives in the backend rather than in the ML service.

### 2.3 Database

`[TR]` Supabase/PostgreSQL as the single store, with pgvector for embeddings rather than an external vector DB — §3.7 is explicit and gives the rationale (*"a unified and efficient data architecture"*). Keep it. It is also a good defense answer.

Gaps in the previous report's schema thinking are covered in Section E. The two structural omissions: **no evaluation/run tables** (F-03) and **no data-provenance marking** (F-38).

### 2.4 Python/ML service

| Finding | Class |
|---|---|
| RF served by Flask, invoked by Node over internal HTTP | `[TR]` §3.7, §2.3 def. 16 |
| Embedding model **also** hosted in the Flask service | `[ID]` — previous report's D3; **audit concurs, with a stronger rationale it did not give** |

#### F-14 — Three reasons for Python-hosted embeddings, only one of which the previous report gave

The previous report argued from separation of concerns. Two stronger reasons exist:

1. **RAGAS runs in Python and needs an embedding model.** Answer Relevancy is computed by embedding synthetic questions. If embeddings live in Node, your evaluation harness and your runtime use two different implementations of "the embedding model", and any drift between them is a confound in your primary result.
2. **Ingestion is a batch Python job anyway.** Chunking and embedding a document corpus is offline work; `sentence-transformers` is the reference implementation. Having a second, different embedding path in Node for queries means **your query vectors and your document vectors could be produced by different code.** That is a silent, catastrophic retrieval bug — and exactly the kind that shows up as "our Context Recall was surprisingly low" in Chapter 4.

**Point 2 is decisive: query embeddings and document embeddings must be produced by the same code path.** That settles D3 in favour of Python far more firmly than "separation of concerns" does.

**Cost to acknowledge:** every query now makes a Node→Flask hop for the embedding, on the hot path, inflating the Response Time metric you are required to report (F-02). Mitigations: keep the model warm at Flask startup `[ID]`, co-locate the two services `[ID]`, and **report component-level latency so the embedding hop is visible and attributable** `[ID]`. Do not hide it.

#### F-15 — The Flask service needs more than `/predict` · MINOR · `[ID]`

The previous report lists `/predict` and `/embed`. For a research system also expose:

- `/embed/batch` — ingestion would otherwise make one HTTP call per chunk.
- `/healthz` — needed for a stable defense demo.
- `/model/info` — returns model version, training run ID, class order, feature list, sklearn version. **This is a reproducibility requirement**, not a nicety: when you report accuracy in Chapter 4 you must be able to say which artifact produced it. Neither prior document mentions model versioning at all.

### 2.5 Service boundaries — the one boundary rule that matters

The thesis's own flow (§3.5.4 process flow) plus F-01's constraint yields a single rule the implementing agent must not violate:

> **Routing and retrieval are identical in both arms. The *only* difference between Standard and Enhanced is whether the masked status block is appended during Context Fusion.**

Any design where the router behaves differently in standard mode, or retrieves different chunks, or uses a different prompt skeleton, invalidates the thesis's primary evaluation. This constraint is not stated in either prior document and it constrains the code more tightly than anything else in this audit.

### 2.6 API design

Neither prior document specifies the Node API surface. See Section F. Two design notes here:

#### F-16 — `mode` must be a server-side parameter, not a client toggle · MAJOR · `[ID]`

The Standard/Enhanced switch is an **evaluation harness concern**. If it is exposed as a query parameter on the public chat endpoint, anyone can request the standard arm, and — more importantly — your evaluation runs and your live traffic become indistinguishable in the logs. **Recommend: a separate, authenticated `/api/eval/run` endpoint that drives the same core pipeline with `mode` set explicitly, while the public `/api/chat` is hard-wired to `enhanced`.**

#### F-17 — Streaming responses conflict with your own measurement · MINOR · `[ID]`

Streaming tokens is nice UX and Groq supports it. But "Response Time" is then ambiguous — time-to-first-token or time-to-completion? `[RD]` If you stream, define and report **both**. Simplest defensible choice: **do not stream during evaluation runs**; stream only in the live UI if you want it. Keep the measured path non-streaming.

---

## 3. Random Forest design

### 3.1 Does the thesis support predicting availability status directly?

**Yes — in four separate places, including the two most authoritative ones.**

| § | Quote | Weight |
|---|---|---|
| **1.3 Scope and Delimitation** | *"The probabilistic Random Forest model will analyze temporal schedule data to **output a generalized faculty availability status** … rather than outputting exact physical room coordinates."* | **Highest.** Scope statements are contractual. |
| **3.5.2** (the dedicated RF module spec) | *"The trained model will **output one of the following generalized availability statuses** for each faculty member: 'Available for Consultation,' 'Currently in a Lecture,' or 'Unavailable.'"* | **Highest.** This is the module's own specification. |
| **1.1 Background** | *"…the probabilistic output undergoes a status masking protocol, transforming **raw probability estimates** into generalized faculty availability statuses…"* | High — and note it says masking transforms *probability estimates*, not locations. |
| **3.5.4 Context Fusion** | *"…the Random Forest Classification Module generates a real-time availability probability estimate… This probabilistic estimation (e.g., 'Available,' 'In a Lecture,' or 'Absent')…"* | High |

### 3.2 Does any section imply physical-location prediction?

**Yes — exactly one section, §3.5.3, and it does so twice:**

> Step 1: *"The Random Forest classification module generates a raw classification output, **which typically represents a specific physical location class** (e.g., `Class_Room_302` or `Off_Campus_Tag`)."*
> Code: `const statusHashMap = { "Room_304": "Currently in a Lecture", "Faculty_Lounge": "Available for Consultation" };`

That is the entire basis for Interpretation B. It is one subsection, and it is the subsection about *masking*, not about the model.

### 3.3 Which interpretation is most defensible?

**Interpretation A — the RF predicts the three availability statuses directly.** Five arguments, in descending strength:

1. **The Scope and Delimitation says so explicitly** (F-10). This outranks a mid-methodology illustration.
2. **The stated data cannot produce location labels.** §3.4.1(b) lists the training inputs: official class schedules, and *"historical attendance logs … from departmental logbooks or HR biometric records."* A logbook or biometric terminal records **one event at one point** — that a person signed in. It does not record which room they were in at 14:30. To train a room-level classifier you would need per-room presence ground truth, which means sensors or room-level check-ins. **The thesis never mentions any such infrastructure**, and §1.3 explicitly rejects *"invasive physical tracking."* You cannot train a model on labels you have no mechanism to collect.
3. **§3.5.3 contradicts itself.** It says the RF may output `Off_Campus_Tag` — but off-campus is determined **deterministically by the guard log, before the RF is ever called**, in the very same code block. An output class that the control flow makes unreachable is a sign of an illustrative sketch, not a specification.
4. **The evaluation is defined over statuses.** §3.9 computes per-category precision and recall for the three status categories; §3.3 says faculty confirm *"whether the system's predicted availability status … corresponds to their actual real-world presence."* Nothing in the evaluation ever inspects a location class. A model whose output is never evaluated in the form it is produced is the wrong model.
5. **Masking-in-Node is only coherent under A** (F-13).

**Cross-examination — the strongest case *against* A, which you must be ready for:**

> *"If the model already outputs the user-facing status, what exactly does your Status Masking Protocol mask? You have named it as a research contribution."*

This is the sharpest available attack and the previous report did not treat it as one — it called masking-under-A *"a simple renaming"* and moved on. **A renaming is not a contribution, and §2.1.7 lists privacy-preserving masking as part of the study's gap-filling claim.** See F-26 for the required reframing. Do not go into the defense without it.

### 3.4 Ambiguity statement — do not let this be resolved silently

The thesis is **genuinely internally inconsistent** on this point. The honest framing for Chapter 3 and the defense is:

> §3.5.3 describes the masking protocol using a location-class example inherited from the general form of the technique in the privacy literature. §1.3 and §3.5.2 specify the model's actual output as a generalized availability status. The implemented system follows §1.3 and §3.5.2. §3.5.3's example is illustrative of the masking mechanism, not a specification of the classifier's label space.

`[RD]` **Michael and Christian must approve that paragraph, or an equivalent, and it should appear in the thesis text as an erratum or clarification.** Presenting a system that contradicts §3.5.3 without acknowledging the contradiction is far riskier than acknowledging it.

### 3.5 What training labels and data would actually be required

Under **Interpretation A**, for each `(faculty, timestamp)` sample you need a label in `{Available for Consultation, Currently in a Lecture, Unavailable}`.

| Label | How it is actually derivable | Difficulty |
|---|---|---|
| `Currently in a Lecture` | Deterministic from the official schedule — **and this is a problem, see F-20** | Trivial |
| `Available for Consultation` | Requires evidence the person was present *and* not teaching. From attendance logs: signed in, and no scheduled class at that time. | Moderate — depends entirely on logbook granularity |
| `Unavailable` | Not signed in, or signed out, or on leave, or in a university-wide event | Moderate |

#### F-18 — Label quality is capped by attendance-log granularity, and nobody has checked what that granularity is · BLOCKER for the ML track · `[RD]`

This is a **go/no-go question that must be answered before any ML work starts.** §3.4.1(b) says logs come from *"departmental logbooks or HR biometric records."* The two are wildly different:

- **A biometric terminal with in/out punches** gives you presence intervals. Labels are derivable. The project works.
- **A daily sign-in sheet** gives you one bit per day: "came to work." From that you **cannot** distinguish `Available` from `Unavailable` at 14:30. Every intra-day label would have to be imputed from the schedule — at which point **your Random Forest is being trained on labels generated by the rule-based baseline it is supposed to outperform.** That is circular and a panelist will find it.

`[RD]` **Action before writing any training code: obtain a sample of the actual attendance data and confirm its time granularity.** If it is daily-only, the ML formulation must change — realistically to a coarser but honest target (e.g. predicting *presence on campus during a given time block*), and Chapter 3 must be amended. **Neither prior document raises this and it is the single largest feasibility risk in the entire project.**

#### F-19 — "Anonymized" attendance data and per-faculty behavioural modelling are contradictory · MAJOR · `[RD]`

§3.4.1(b) and §3.4 Phase 1: attendance records will be *"sanitized and anonymized — removing personally identifiable information and retaining only temporal patterns."*

§3.5.2 feature category (b): *"historical attendance patterns, including aggregated records of past faculty check-ins or sign-ins that capture **individual tendencies toward punctuality, early departure, or extended office hours**."*

**These cannot both be true.** Modelling *individual* tendencies requires linking each historical record to a specific individual, and linking that individual to the live query "Is Prof. Santos available?" True anonymisation severs exactly that link and destroys the feature.

**Resolution:** what the thesis describes is **pseudonymisation**, not anonymisation — a stable surrogate key (`faculty_id`) replaces the name in the ML feature store, with the name↔id mapping held separately and never given to the model. That preserves per-individual signal while keeping names out of the training pipeline.

`[RD]` **This wording should be corrected in Chapter 3**, because under RA 10173 pseudonymised data is still personal data, whereas anonymised data is not. Claiming the stronger term while implementing the weaker one is exactly the kind of discrepancy a panel with a data-privacy-aware member will pursue. The implemented behaviour is fine; the label on it is wrong.

`[RD]` **Related, unaddressed:** is there **one global model with `faculty_id` as a feature**, or **one model per faculty member**? With 15 or so validators and one semester of data, per-faculty models will be badly underfit. **Recommend a single global model with pseudonymous faculty ID plus per-faculty aggregate features** (historical punctuality rate, etc.) rather than raw ID as a high-cardinality categorical. Neither prior document mentions this decision exists.

#### F-20 — The thesis's stated method does not support its stated claim about ML necessity · MAJOR · `[RD]`

§3.5.2: *"Feature importance analysis will be conducted to identify which categories of input features … contribute most to classification accuracy, **thereby validating the necessity of the machine learning approach over a simple rule-based alternative**."*

**Feature importance cannot validate that claim.** Feature importance is an *intra-model* diagnostic: it ranks features within the Random Forest. It tells you nothing about how a rule-based schedule lookup would have performed. The only way to validate "ML beats rules" is to **implement the rule-based baseline and compare accuracy on the same test set.**

This is a logical gap **in the thesis itself**, it is trivially spotted by any panelist with an ML background, and it goes directly at the study's central justification (§2.1.3, §3.5.2 both lean on "better than rule-based").

**It also has an architecture consequence, which is why it belongs in this audit:** you must **build a third pipeline** — a deterministic schedule-lookup classifier producing the same three labels — and evaluate it against the same faculty-validated ground truth.

So the system needs **three comparison arms in total**, and only one prior document mentions any of them:

| Arm | Purpose | Thesis basis |
|---|---|---|
| **Standard RAG** | RAGAS comparison | `[TR]` §1.2 Obj. 2 — missed by previous report (F-01) |
| **Enhanced RAG** | the system | `[TR]` |
| **Rule-based schedule lookup** | justify ML over rules | **`[RD]`** — implied by §3.5.2's claim; the stated method is invalid |

The rule-based baseline is cheap to build (a schedule query) and is the **single highest-value addition** you can make to your defense. If the RF beats it, you have quantitative proof of your central premise. If it does not, you need to know that before the panel does — and there is an honest, publishable answer either way ("the RF matched the rule baseline on lecture detection but outperformed it on availability during unscheduled hours" would be a genuinely interesting finding).

#### F-21 — The 80/20 split as specified will leak · MAJOR · `[ID]`

§3.5.2: *"splitting the prepared dataset into training and testing subsets using an 80-20 ratio, and cross-validation will be applied."*

A naive random `train_test_split` on `(faculty, timestamp)` rows puts **the same faculty member on the same day** in both train and test. The model then memorises "Prof. X was in on 12 March" rather than learning temporal patterns, and reports an inflated accuracy. This is one of the most commonly-raised criticisms in ML thesis defenses.

**Recommend:** split by **time** (train on earlier weeks, test on later weeks) — this also matches the deployment reality, where you predict the future from the past. If you additionally want to claim generalisation to unseen faculty, use a grouped split by `faculty_id`. `[ID]` Whatever you choose, **state the splitting strategy explicitly in Chapter 3** — "80/20" alone is not a specification.

`[RD]` **Class imbalance is unaddressed.** Depending on how sampling times are chosen, one class will dominate. If you sample only working hours, `Unavailable` may be rare; if you sample all hours, it will swamp the others. **The sampling scheme for generating training rows is itself an undocumented research decision** and it determines your class balance, which determines your headline accuracy. Document it. Report per-class support alongside precision/recall — §3.9 already requires per-category metrics, which is good, because a bare accuracy figure on imbalanced classes is meaningless.
---

## 4. Probabilistic output

### 4.1 What does "probabilistic availability estimate" mean in the thesis?

The thesis uses "probabilistic" in **three different senses** and never disambiguates them. This matters because Objective 4 says you will validate *"the system's faculty availability **probability estimates**"* — and what you actually validate depends on which sense is meant.

| Sense | Where | What it would mean to evaluate |
|---|---|---|
| **(a) Method-level** — the algorithm is probabilistic (ensemble voting, Gini over class distributions) | §2.2 Ensemble Learning Theory; §2.3 def. 4 *"a single, more precise probabilistic result"* | Nothing extra; it is a property of Random Forest |
| **(b) Epistemic** — the *status* is an estimate, not a fact | §3.5.2 *"estimate the probability that a faculty member is actually present"*; §1.1 *"raw probability estimates"* | Evaluate classification correctness — which is what §3.9 does |
| **(c) Numeric** — a probability *value* is produced and surfaced | Implied by *"probability estimates"* in Obj. 4 and §3.8.2 | Would require calibration analysis, Brier score, reliability curves — **none of which appear anywhere in the thesis** |

**§3.9 settles it.** The statistical treatment section defines *only* Classification Accuracy Rate, per-category Precision, Recall, F1, and a confusion matrix. Every one of these operates on **categorical labels**. There is no calibration metric, no threshold analysis, no expected-vs-observed frequency test. **Sense (c) is not evaluated anywhere in the thesis.**

The previous report reached the same conclusion. **The audit concurs**, and adds the sharper articulation above: it is §3.9's *exhaustive list of categorical metrics*, not the categorical phrasing in §3.5.2, that makes this airtight.

#### F-22 — Terminology risk in Objective 4 · MAJOR · `[RD]`

Objective 4 and §3.8.2 both say you will validate *"probability estimates."* You will in fact validate **classifications**. A panelist can legitimately ask: *"Your objective says probability estimates. Show me the calibration."*

**Two honest ways out, both fine, pick one now:**
- **(i)** Reword Objective 4 to *"faculty availability status estimates"* / *"probabilistic classification outputs."* Cheapest, cleanest.
- **(ii)** Keep the wording and **actually add a calibration analysis** — retain `predict_proba`, bin predictions by confidence, compare predicted probability against observed correctness from the faculty validation data. This is genuinely more impressive and turns a vulnerability into a contribution. **Cost:** you need enough validation samples per bin, which with 15 validators is tight but not impossible. `[OI]` if you have the volume.

**Recommend (i) unless you are confident of validation volume.** Do not leave the mismatch unaddressed.

### 4.2 What should remain internal

| Item | Disposition | Class |
|---|---|---|
| Full `predict_proba` vector | **Internal only.** Persist server-side for research; never in an API response to the browser | `[ID]` |
| Argmax class before masking | Internal | `[TR]` §3.5.3 |
| Feature vector sent to the RF | Internal — it encodes the schedule | `[ID]`, and see F-27 |
| Model version / run ID | Internal, but **must be persisted** for reproducibility | `[ID]` (F-22) |
| Guard log rows | Internal; guards and researchers only | `[ID]` |

### 4.3 What should be shown to users

**Exactly one of the three status strings. Nothing else.** `[TR]` §3.5.2, §3.5.3.

`[RD]` **Two additions worth deciding on deliberately:**

- **A freshness timestamp** ("as of 2:14 PM"). Not in the thesis. Strongly recommended anyway: the system claims real-time; a timestamp is honest about *when* the estimate applies and costs nothing. `[OI]`
- **An "estimate" qualifier in the UI.** Not in the thesis. **Recommend yes, and treat it as a privacy control, not decoration** — a user who reads "Currently in a Lecture" as a fact is being told something more precise than the system knows, and the thesis's whole ethical posture is that these are estimates. `[OI]` but strongly advised.

**Do not show:** the probability value, a confidence percentage, or a "High/Medium/Low" badge. The previous report listed a confidence indicator as a SHOULD-HAVE (S3) and then correctly recommended against it in D8. **The audit is firmer than the previous report here:** displaying confidence creates an evaluation obligation you have not planned for (F-22 sense (c)) and gives the panel a metric you cannot defend. **Do not build it.** `[ID]`

### 4.4 What should be evaluated

| Evaluated | Not evaluated |
|---|---|
| Classification accuracy rate `[TR]` §3.9 | Probability calibration — unless you choose (ii) above |
| Per-category precision, recall, F1 `[TR]` §3.9 | Ranking quality of the probability vector |
| Confusion matrix `[TR]` §3.9 | Threshold sensitivity |
| RAGAS × 4, both arms `[TR]` §3.8.1 | |
| Response time, both arms `[TR]` §1.2 | |
| **Rule-based baseline accuracy** | — **add this** (F-20) `[RD]` |

---

## 5. Query routing

### 5.1 What the thesis actually requires

> §3.5: *"…routes requests to the appropriate processing module: the Random Forest Prediction Module for faculty availability queries, or the RAG Pipeline for document-based information retrieval."* `[TR]`
> §3.5.4 flow step 2: *"the system determines whether the query involves **faculty availability, campus navigation, or general institutional information**."* `[TR]`

Three categories are named. **The mechanism is never specified.** Everything below the category list is `[ID]` or `[RD]`.

Note also that §3.5.4 step 4 says retrieval happens *"simultaneously"* — so **retrieval is not conditional on the route.** `[TR]` The router decides whether to *add* the RF path, not whether to retrieve. The previous report got this right in effect but labelled the combined-query handling `[ID]` when it is actually thesis-supported.

### 5.2 The four cases

| Case | Behaviour | Class |
|---|---|---|
| **(a) General institutional** — *"What is the academic calendar?"* | Embed → retrieve top-K → fuse → LLM. No guard check, no RF. | Retrieval path `[TR]`; "no RF" `[ID]` |
| **(b) Campus navigation** — *"Where is the College of Engineering?"* | Same retrieval path; POI context included (see F-37 for *how*); frontend may pan/highlight the map | Retrieval `[TR]`; POI-into-prompt mechanism `[RD]`; map coordination `[ID]` |
| **(c) Faculty availability** — *"Is Prof. Santos available?"* | Resolve faculty → guard check → (tri-state) → RF → mask → **and simultaneously retrieve** → fuse → LLM | Guard-then-RF-then-mask `[TR]` §3.5.3; simultaneous retrieval `[TR]` §3.5.4(4); faculty resolution `[RD]` (F-31) |
| **(d) Combined** — *"Where is Prof. Santos's office and is she free?"* | Superset of (b) and (c) | `[TR]`-supported, because retrieval always runs and the RF path is additive. **Correction to previous report, which labelled this `[ID]`.** |

**Because retrieval is unconditional, routing reduces to one binary question:** *does this query require a faculty availability status?* Everything else is retrieval, which happens regardless. This is a much smaller and much more testable problem than "classify into three categories", and framing it this way is both simpler to build and easier to defend.

### 5.3 What routing mechanism is justified

The previous report recommended LLM-based or hybrid routing. **The audit disagrees on the default**, for three reasons it did not consider:

1. **An LLM routing call adds latency to a metric you are required to report** (F-02). You would be spending 150–300 ms of your Response Time budget on a classification that a database lookup answers in 2 ms.
2. **Non-determinism is a reproducibility problem in a research system.** If the router is an LLM, the same query can route differently on two runs, meaning your RAGAS run is not reproducible. A panelist asking "would I get the same numbers if I re-ran this?" deserves "yes."
3. **You already have the gazetteer.** The faculty roster is in your database. Detecting "does this query name a faculty member?" is a lookup against a known, closed, small list — not an open-ended NLU problem. This is the classic case where retrieval beats classification.

**Recommended: deterministic router, LLM fallback only if measured to be needed.** `[ID]`

1. Normalise the query.
2. Match against the **faculty name gazetteer** built from the DB (surnames, full names, common titles, with a fuzzy threshold).
3. Match against an **availability-intent lexicon** (`available`, `free`, `in`, `around`, `consultation`, `office hours`, `pwede ba`, …).
4. `needs_availability = (faculty matched) AND (availability intent OR bare-name query)`.
5. Retrieval runs unconditionally either way.

**Then measure it.** Hand-label 100 representative queries, compute router accuracy, and report it. If it is above ~90 % you have a defensible, deterministic, sub-millisecond router and a number to quote. If it is not, *then* add the LLM fallback for the ambiguous band — and you will have the evidence justifying the extra latency. **That evidence-first sequence is itself a good defense answer**, and it is better than either prior recommendation.

#### F-23 — The router must be identical across both arms · BLOCKER · `[ID]`, consequence of F-01

Stated in Section 2.5 but repeated here because this is where it gets violated in practice. If routing differs between Standard and Enhanced, retrieval differs, and Context Precision/Recall differences become artifacts of routing rather than of architecture. **One router, one retrieval, one prompt skeleton; the fusion step is the only branch.**

#### F-24 — Router failure modes need a defined behaviour · MAJOR · `[RD]`

| Failure | Required decision |
|---|---|
| Faculty name not in roster | Return "I don't have information about that faculty member" — **do not fuzzy-match to the nearest name.** Matching "Prof. Santoso" to "Prof. Santos" discloses one person's status in response to a query about another. |
| Two faculty share a surname | **Ask a clarifying question. Do not guess.** Guessing is a privacy incident. |
| Faculty in roster but not a consented participant | See F-32 — this is an ethics decision, not a UX decision |
| Query names a faculty member but has no availability intent (*"Who teaches CS 301?"*) | `[RD]` Almost certainly should **not** trigger the RF. Decide and document. |

---

## 6. Status masking and privacy

### 6.1 What exactly must be protected

> §3.5.3: *"At no point will the system store, transmit, or display **the exact physical location of any faculty member** to the end user."* `[TR]`

That is the thesis's stated boundary. **It is narrower than the boundary you actually need**, for reasons in F-27, F-28, and F-29.

### 6.2 What may reach the LLM

> §3.5.3 step 3: *"Only the sanitized, generalized status string is transmitted as context to the Large Language Model."* `[TR]`

Permitted into the prompt: the user's query, retrieved document chunks, and **one** of the three status strings. Not permitted: raw predictions, probability vectors, room identifiers, schedule rows, guard log contents, other faculty members' statuses.

### 6.3 What may reach the frontend

The status string, plus whatever the LLM generated. `[TR]` by extension of §3.5.3. Not the probability vector, not the guard log state, not the feature vector. **Note the API-shape trap:** it is very easy to return a debug object alongside the answer during development and forget to strip it. `[ID]` **The response DTO must be defined as an allowlist**, and there should be a test asserting the response contains no other keys.

### 6.4 Where current decisions are inconsistent with the thesis

#### F-25 — The thesis's own "no PII" claim is false as written, and the previous report repeated it · BLOCKER · `[RD]`

> §3.10: *"…no **personally identifiable information of faculty members** will be stored, transmitted, or displayed by the system."*

The system cannot function without storing:

- **Faculty names** — required to resolve "Is Prof. Santos available?" and required by §3.5.1's *"linked faculty information"* metadata.
- **Faculty schedules keyed to individuals** — the RF's primary feature source (§3.5.2).
- **Per-individual attendance-derived behavioural features** — explicitly *"individual tendencies toward punctuality"* (§3.5.2).
- **Guard presence logs keyed to named individuals** — a real-time record of a specific person's physical presence on campus.

Under RA 10173, "personal information" is any information from which the identity of an individual is apparent or can reasonably be ascertained. **A named person's real-time presence status is squarely personal information.** The guard log table in particular is the single most sensitive dataset in this project — more sensitive than anything the masking protocol touches, because it is unmasked, timestamped, person-linked location data.

**This is the most likely question to sink the defense**, because it is a one-sentence contradiction between §3.10 and the architecture in §3.5, and any panel member with data-privacy awareness will find it.

The previous report restated this as NFR-01 (*"no PII stored, transmitted, or displayed"*) without challenge. It did note separately that full RA 10173 compliance should not be claimed — good — but it did not identify that the thesis's factual claim about its own data model is wrong.

**The honest, defensible reframing** (and the system should be built to match it):

> The system processes personal information about faculty members under a legitimate institutional purpose. It applies data minimisation: identity is pseudonymised in the ML feature store; only a generalized availability status is disclosed to end users; exact physical location is never derived, stored, or disclosed; guard presence logs are accessible only to authenticated security personnel and researchers, and are retained only for the evaluation period.

That claim is **true**, is **stronger** rhetorically than an absolute denial, and is **defensible**. The absolute claim is neither.

`[RD]` **§3.10 needs rewording. This is a thesis-text change, not a code change, and it is the highest-priority item in this audit.**

#### F-26 — Under Interpretation A the masking protocol is nearly vacuous, and it is claimed as a contribution · BLOCKER · `[RD]`

§2.1.7 lists as part of the study's gap: *"a notable absence of literature demonstrating how to safely implement these probabilistic location systems without violating faculty privacy"*, addressed *"mediated by a privacy-preserving status masking protocol."* Masking is therefore a **claimed contribution**, not an incidental utility.

But under Interpretation A — which Section 3 concludes is correct — the hash map maps `"available"` to `"Available for Consultation"`. **That is a string constant, and calling it a privacy protocol will not survive cross-examination.** The previous report acknowledged the tension and then described masking as serving "a defensible purpose"; it did not treat this as a defense-critical problem. It is one.

**Required reframing — and this is a genuine, buildable, defensible contribution:** redefine the Status Masking Protocol from a *translation table* into an **egress control boundary**. Concretely, it is the single chokepoint through which the faculty-availability data path must pass, and it enforces:

1. **Allowlist projection.** The only value permitted to cross from the prediction subsystem into the fusion stage is one member of a closed three-value enum. Not a struct, not an object with extra fields — one enum value. Anything else is a hard error, not a fallback.
2. **Deterministic override precedence.** Guard-confirmed departure short-circuits the model entirely `[TR]`.
3. **Purge of intermediates.** The prediction object, probability vector, and feature vector do not survive past the boundary in the request context `[TR]`.
4. **Egress filtering on the generated response** — see F-27. This is the piece that does not exist yet and is what makes the protocol non-trivial.
5. **Corpus-side exclusion of location-bearing faculty records** — see F-28.

Reframed this way, masking is a **security-architecture pattern with an enforceable invariant** ("no faculty-location-bearing value can reach the client, from any path"), which is a real contribution and is testable. You can write tests that *prove* the invariant. That is defensible; a hash map is not.

`[RD]` Michael and Christian must approve this reframing, and §3.5.3 should be expanded to describe the boundary, not just the lookup.

#### F-27 — Masking filters the LLM's input but nothing filters its output · BLOCKER · `[ID]`

The protocol as specified sanitises what goes *into* the prompt. **Nothing constrains what comes out.**

Llama 3.1 8B, given `Context: The faculty member is Currently in a Lecture` and asked *"Where can I find Prof. Santos?"*, may generate: *"She's likely teaching in one of the CCS lecture rooms — try the second floor."* The model has just synthesised a physical location from its own priors. **The privacy boundary is breached at the generation step, and the masking protocol has no visibility into it.**

Worse, this failure is **invisible to your own metrics** unless you look for it — RAGAS Faithfulness would actually flag it as unfaithful (the claim is not in the context), which is useful, but Faithfulness is computed offline over a curated test set, not on live traffic.

**Required:** `[ID]`

- A **system prompt constraint** that explicitly forbids inferring, guessing, or stating any physical location, room, floor, or building for a faculty member, and forbids elaborating beyond the provided status string.
- An **output-side check** on responses to faculty-availability queries: scan the generated text for room/location patterns before returning it. On a hit, fall back to a templated safe response. This is the enforcement half of F-26's reframing.
- A **test suite of adversarial prompts** (*"where exactly is she", "which floor", "guess"*) asserting no location leaks. **This test suite is itself defense evidence** — it is how you demonstrate the protocol works, and it substitutes for the security audit the thesis never planned.

Neither prior document mentions output-side filtering at all.

#### F-28 — The RAG corpus contains faculty office locations, bypassing the entire protocol · BLOCKER · `[RD]`

§3.5.4, on what is ingested into the vector store:

> *"Institutional documents — including university memoranda, academic calendars, department announcements, and **faculty directory information** — will be ingested into the pipeline…"*

And §3.5.1: each geospatial point carries *"the department name, building function, and **linked faculty information**."*

A faculty directory contains office assignments. So: user asks *"Where is Prof. Santos's office?"* → the router sees no availability intent → retrieval returns the directory chunk → the chunk says *"Prof. Santos, Room 304, CCS Building"* → the LLM faithfully reports it. **The masking protocol was never invoked. The room number was disclosed. Every step behaved exactly as designed.**

**You must take an explicit position, and it must be in the thesis:** `[RD]`

The defensible position is:

> **Static office assignment is public directory information; real-time whereabouts is not.** The system discloses where a faculty member's office *is* — the same information printed on the office door and in the published directory — but never asserts where the faculty member *is now*. The masking protocol governs the real-time inference path; the directory governs static institutional facts.

This distinction is real, is genuinely defensible, and is how every university directory in the world already works. **But it must be stated, because §3.5.3's absolute phrasing — *"at no point will the system store, transmit, or display the exact physical location of any faculty member"* — literally forbids it**, and a panelist holding that sentence next to a screenshot of your system printing "Room 304" has a clean hit.

**Enforcement consequences if you take that position:** `[ID]`
- Never combine a static office location and a live status in the same response. *"Prof. Santos's office is Room 304, and she is currently in a lecture"* is two individually-permitted facts whose combination is a whereabouts inference. **Suppress office location in responses to availability queries.**
- Curate the ingested directory data — strip anything beyond office assignment (no personal contact details, no home department schedules with room-by-room detail).

**Alternative position:** exclude faculty-linked location data from the corpus entirely. Safer, but it degrades the navigation capability that is half the system's purpose, and §3.5.1 explicitly calls for linked faculty information. **Not recommended, but it is your call.**

#### F-29 — A public, unauthenticated chatbot enables an aggregation attack that masking does not stop · MAJOR · `[RD]`

The previous report recommended public/anonymous access (D5) on the grounds that the thesis does not mention student authentication. That is correct about the thesis and incomplete about the consequences.

Status masking protects the **granularity of a single answer**. It does nothing about **volume**. Anyone — including someone off-campus with no affiliation — can poll *"Is Prof. Santos available?"* every ten minutes and reconstruct a high-resolution daily presence timeline for a named individual. Repeated over weeks, that yields a behavioural profile substantially more invasive than the single room disclosure the protocol was built to prevent.

**This is the strongest privacy criticism available against the system, and the thesis has no answer to it.** Neither prior document mentions it.

`[RD]` **Decide among:**

| Option | Trade-off |
|---|---|
| **(a) Rate-limit availability queries** per IP/session | Cheap, partial, easy to defend as a documented mitigation. **Minimum acceptable.** |
| **(b) Keep map and general Q&A public; require campus authentication only for availability queries** | Strongest privacy posture; adds an auth flow the thesis does not describe; arguably *improves* on the thesis rather than deviating from it |
| **(c) Public, unrestricted** | Matches the thesis literally; indefensible if the question is asked |
| **(d) No historical or predictive availability queries** — present-moment only, never *"when will she be free"* or *"was she in yesterday"* | **Do this regardless of a/b/c.** Costs nothing and closes the worst variant. |

**Recommend (a) + (d) minimum; (b) if you want the strongest possible answer.** Whichever you pick, **name the aggregation risk in the thesis and state your mitigation.** Acknowledging a limitation you have mitigated is a strong defense posture; being shown one you never considered is not.

#### F-30 — Guard logs are the system's crown jewels and no access-control design exists · MAJOR · `[ID]`

The `guard_presence_logs` table is unmasked, timestamped, person-linked presence data. If it leaks, every privacy claim in the thesis collapses regardless of how well the masking protocol works.

Required: `[ID]`
- **Supabase Row-Level Security enabled on every table**, with deny-by-default. Note that Supabase tables are exposed via PostgREST by default — **a table without RLS is readable by anyone with the anon key, which is in your frontend bundle.** This is the single most common Supabase security failure and neither prior document mentions RLS in the implementation plan.
- **The `service_role` key must exist only on the Node server.** Never in React, never in an env var prefixed for client exposure, never in the repository.
- Guard accounts authenticated `[ID]`; **`logged_by` recorded on every row** for accountability.
- **Append-only.** Corrections are new rows, never updates or deletes. This preserves the audit trail and it is also what makes the log defensible as evaluation evidence.
- **Retention policy and a deletion date.** `[RD]` The thesis has none. RA 10173 expects proportionate retention. "Deleted 30 days after the evaluation period ends" is a good, simple, defensible answer — and it is a question you may well be asked.

#### F-31 — Faculty identity resolution is a privacy surface, not just a UX problem · MAJOR · `[ID]`

Covered mechanically in F-24. The privacy dimension: fuzzy name matching can disclose **person A's status in response to a query about person B**, and can confirm **whether a given name exists in the roster** — itself a small disclosure. Exact-or-clarify, never guess.

#### F-32 — Faculty in the system who never consented · MAJOR · `[RD]`

§3.10 obtains written informed consent from **the 15 validators only**. But §3.4.1(b) collects schedules *"from department heads across the participating colleges"* and attendance logs from HR — potentially covering **every faculty member in those departments**, none of whom consented, and all of whom are data subjects whose availability the deployed system would then disclose to anyone who asks.

Departmental or institutional permission is not the same as individual consent, and the thesis relies on the former while its ethics section describes the latter.

`[RD]` **Recommend: restrict the deployed system's answerable faculty roster to faculty who have given written consent.** This is a small config constraint (a `consent_status` column gating the gazetteer), it costs nothing, and it converts a serious ethics exposure into a documented safeguard. §3.3's own sampling criterion — *"the faculty member's schedule data is included in the system's training dataset"* — already implies a bounded roster; make it explicit and consent-gated.

For any non-consented faculty whose data appears in *training* only: the pseudonymisation in F-19 plus institutional authorisation is the argument, and it should be written down.

#### F-33 — Cross-reference and terminology errors in the thesis text · MINOR

Not architecture, but a panel notices these:

- **§3.10 cites "Section 3.5.4" for the status masking protocol. It is §3.5.3.**
- §3.5.4 process flow step (3) reads *"or faculty-related queries"* — a dropped "F".
- §1.3: *"A Additionally"*.
- §3.8.2: *"Classifcation"*.
- §3.5.2 refers to the classifier's output classes in one vocabulary and §3.9 evaluates a different one (F-09).
- "anonymized" should be "pseudonymized" throughout (F-19).
---

## 7. Security Dashboard

**Basis in the thesis: two clauses and one function call** (F-11). Everything below is `[ID]` or `[RD]` unless marked. Be honest about this during the defense — over-claiming specification for a module the thesis barely mentions is worse than saying "the thesis specifies the capability; we designed the interface."

### 7.1 Minimum required functionality

| # | Capability | Class |
|---|---|---|
| 1 | Authenticated guard logs in | `[ID]` — required for `logged_by` accountability |
| 2 | Search/select a faculty member from the consented roster | `[ID]` |
| 3 | Record an **arrival** or a **departure** event with automatic timestamp | `[ID]`, derived from the tri-state model (F-07) |
| 4 | See today's log entries and current derived state per faculty | `[ID]` — without this, guards cannot tell whether they already logged someone |
| 5 | Correct a mistake by appending a corrective entry | `[ID]` — never edit or delete (F-30) |
| 6 | Backend resolves current presence state per the tri-state rules | `[TR]` for the override itself (§3.5.3); tri-state resolution `[ID]` |

**Explicitly out of scope for V1:** push notifications, bulk import, shift handover, photo capture, gate-level tracking. All `[RD]` and none are thesis-supported.

### 7.2 Authentication

`[ID]` **Supabase Auth, email + password, guard accounts provisioned manually by the researchers.** No self-registration — the guard population is small, known, and fixed for the evaluation period. Self-registration on this dashboard would be an open door to the most sensitive table in the system.

The previous report's D4 recommendation (Supabase Auth) is **sound and should remain**. Its stated alternative of a "simple shared PIN" should be **explicitly ruled out**: a shared credential destroys `logged_by` accountability, which is the only thing making the presence log defensible as research evidence.

### 7.3 Data model

Replaces the previous report's boolean design (F-07). Full DDL in Section E.

- **Append-only event log**, one row per guard action: `faculty_id`, `event_type ∈ {arrival, departure}`, `occurred_at`, `logged_by`, `created_at`, `note`.
- **Derived current state** computed at query time: latest event for that faculty **within the validity window**, else `unknown`.
- Do **not** store a mutable `is_on_campus` flag. A denormalised flag will drift from the event log, and when it does, your override behaves inconsistently and your evaluation data becomes unreconstructable.

### 7.4 Permissions

| Role | guard_presence_events | faculty | documents / embeddings | eval tables | chat |
|---|---|---|---|---|---|
| **anon (public)** | none | none directly | none directly | none | via API only |
| **guard** | insert; select own-day rows | select (id, name, dept) of consented roster | none | none | — |
| **researcher/admin** | select all | full | full | full | — |
| **Node service role** | full | full | full | full | — |

`[ID]` throughout. Enforced by **RLS policies, not by application logic alone** — the anon key is public, so application-layer checks are not a boundary.

### 7.5 Security weaknesses to design against

| # | Weakness | Mitigation | Class |
|---|---|---|---|
| W1 | **RLS not enabled → PostgREST exposes tables to the anon key**, which ships in the frontend bundle | Deny-by-default RLS on every table; verify by querying with the anon key and confirming zero rows | `[ID]` **highest-severity item in this section** |
| W2 | `service_role` key leaking into the frontend or the repo | Server-only env; secret scanning; never in any `VITE_`/`NEXT_PUBLIC_` variable | `[ID]` |
| W3 | IDOR — a guard posting logs for arbitrary `faculty_id` | Constrain to the consented roster; log `logged_by`; review anomalies | `[ID]` |
| W4 | Guard dashboard code and table names shipped in the public bundle | Lazy-load or separate app (F-12) | `[OI]` |
| W5 | No rate limiting on the public chat endpoint → aggregation attack (F-29) and Groq quota exhaustion | Per-IP rate limit | `[ID]` |
| W6 | Groq API key exposed if the frontend ever calls Groq directly | **All LLM calls server-side, always.** No exceptions | `[ID]` |
| W7 | Flask ML service reachable from the internet | Bind to localhost or private network; never expose `/predict` publicly | `[ID]` |
| W8 | Prompt injection via ingested documents — a malicious or careless document chunk containing instructions | Delimit retrieved context clearly in the prompt; instruct the model to treat it as data; the output filter (F-27) is the backstop | `[ID]` — worth mentioning in the defense, it shows maturity |
| W9 | Presence data retained indefinitely | Retention policy + deletion date (F-30) | `[RD]` |

---

## 8. RAG pipeline

### 8.1 Document ingestion

`[TR]` §3.5.4 and §3.4.1(c): collect → machine-readable text → segment into chunks → embed → store in pgvector.

`[ID]` Ingestion should be an **offline Python batch script**, not an admin UI. The previous report listed an admin upload page as a SHOULD-HAVE (S4) and correctly noted a script suffices. **The audit is firmer: do not build the UI for V1.** It is unmentioned in the thesis, it adds an authenticated file-upload attack surface, and it competes for time with the evaluation harness, which is thesis-critical. Re-ingestion is `python ingest.py`.

`[ID]` **Record provenance for every document**: source, title, official date, who provided it, whether it is real or placeholder (F-38). Without this you cannot answer "where did this answer come from?" — and grounding claims require it.

### 8.2 Chunking

**Entirely unspecified in the thesis** — no size, no overlap, no strategy. `[RD]`

#### F-34 — all-MiniLM-L6-v2 silently truncates at 256 word-pieces · MAJOR · `[ID]`

**This is the highest-value technical detail in this section and neither prior document mentions it.**

`all-MiniLM-L6-v2` has a maximum sequence length of **256 word-pieces**. Text beyond that is **silently discarded** during encoding — no error, no warning. If you chunk at a typical 512 or 1000 tokens, roughly half of every chunk is never represented in its own embedding. Retrieval then fails for content in the tail of chunks, and it fails *invisibly*.

The symptom is *"our Context Recall came out lower than expected"* in Chapter 4, with no obvious cause. It is a very common bug and a very bad one to discover during a defense.

**Recommend:** `[ID]` chunk to roughly **180–220 word-pieces with ~15 % overlap**, measured with the model's own tokenizer rather than by character count or a rough word estimate. Verify empirically that no chunk exceeds the limit before ingestion completes.

`[ID]` **Structure-aware splitting** for institutional documents — split on headings and paragraph boundaries first, then pack to the token budget. Memoranda and calendars have strong structure; blind fixed-window splitting across a table of dates destroys it.

### 8.3 Embeddings

`[TR]` all-MiniLM-L6-v2, 384 dimensions (§3.7).

`[ID]` **Normalise vectors and use cosine distance consistently.** The thesis specifies cosine similarity (§3.5.4) — so the pgvector column must be queried with the cosine operator, and if you normalise at write time you must normalise at query time. Mixing L2 and cosine is another silent-degradation bug.

`[ID]` **The same code path must produce document and query embeddings** (F-14, point 2).

#### F-35 — English-only embeddings on a Philippine campus · MAJOR · `[RD]`

`all-MiniLM-L6-v2` is English-only. Real queries at ISU Echague will include Filipino, Ilocano, and Taglish (*"nasaan si Prof. Santos?"*, *"available ba siya?"*). Retrieval quality on those queries will be materially worse, and the thesis does not mention language scope at all.

`[RD]` **Either** add an explicit delimitation — *"the system accepts English-language queries"* — to §1.3, **or** consider a multilingual embedding model, which would be a deviation from §3.7 requiring justification. **Recommend the delimitation**; it is honest, costs nothing, and the model is thesis-specified. But *decide*, because a panelist asking a Tagalog question during a live demo is a very plausible event.

### 8.4 pgvector and retrieval

#### F-36 — Do not add an ANN index at this corpus size · MAJOR · `[ID]`

The previous `thesis_analysis.md` flagged index choice (IVFFlat vs HNSW) as an open question; `implementation_decisions.md` dropped it entirely.

**The right answer for this project is: no ANN index.** Your corpus is university memoranda, calendars, handbooks, and a directory for one campus — realistically a few hundred to a few thousand chunks. At that scale exact search is sub-millisecond, and **IVFFlat with too few rows per list actively degrades recall.** An approximate index would cost you Context Recall — a headline metric — in exchange for latency you do not need.

**This is also a good defense answer:** *"we use exact nearest-neighbour search because at our corpus size approximate indexing would trade retrieval recall for latency we don't need, and Context Recall is one of our primary metrics."* That demonstrates you understood the trade-off rather than cargo-culting an index.

`[RD]` **Top-K is unspecified in the thesis.** K directly drives Context Precision (higher K → more irrelevant chunks → lower precision) and Context Recall (higher K → better coverage → higher recall). **K is therefore a knob that moves two of your four headline metrics in opposite directions.** Fix K before the evaluation, use the identical K in both arms, and state the value in Chapter 3. **Do not tune K after seeing RAGAS results** — that is fitting to your own benchmark. K = 4 or 5 is a reasonable, conventional starting point.

`[OI]` A similarity floor (discard chunks below a threshold) improves Context Precision and is defensible. Set it before evaluating, not after.

### 8.5 Grounding

`[TR]` §2.3 def. 3 and §3.5.4 make hallucination reduction the central claim. Concretely: `[ID]`
- The system prompt must instruct the model to answer **only** from the provided context and to say it does not know otherwise.
- Retrieved context must be **clearly delimited** from instructions (W8).
- Temperature **0** — required for reproducibility of your evaluation runs, and it reduces hallucination. Neither prior document mentions temperature. `[ID]`

`[OI]` Citing source documents in the response is not thesis-required but is strong demo material and directly supports the grounding claim.

### 8.6 Context Fusion

`[TR]` §3.5.4: three sources merged into one structured prompt — user query, retrieved chunks, masked status.

`[ID]` **The prompt must be one template with a single conditional block:**

```
[system instructions — identical in both arms]
[retrieved context — identical in both arms]
[availability block — ENHANCED ARM ONLY]
[user query — identical]
```

The availability block is the **only** textual difference between arms (F-01). Anything else confounds the comparison.

`[ID]` The availability block should state the status **as an estimate**, name the faculty member, and carry an explicit instruction not to infer location (F-27). The thesis's illustrative one-liner — `Context: The faculty member is ${safeStatus}.` — does not even identify *which* faculty member, and would produce incoherent answers when a query names someone. Treat it as illustrative, not as the template.

`[RD]` **Version the prompt template and record the version with every evaluation run.** If you change the prompt mid-evaluation, earlier results are not comparable. This is a reproducibility requirement.

### 8.7 LLM integration

`[TR]` Llama 3.1 8B via Groq (§3.7), with a stated three-part justification you should be ready to repeat.

`[ID]` / `[RD]` **Risks the thesis does not address:**

- **Model availability.** Groq's hosted model catalogue changes over time and specific Llama 3.1 endpoints have been retired in the past. **Verify the exact model ID is currently served before committing, and pin it.** Record the exact ID and the date in your methods. If it is retired mid-study, you must disclose the substitution — a silent swap makes every prior number non-comparable.
- **Free-tier rate limits** are a live-demo risk. Have a fallback plan and a graceful error state `[ID]`.
- **Temperature 0 and a fixed seed if available**, for reproducibility `[ID]`.
- **No fallback LLM is specified.** `[RD]` Decide whether you have one. If you do and you use it, you must report it.

### 8.8 Geospatial data in the retrieval path

#### F-37 - Whether campus location data enters the RAG corpus is an unresolved architecture fork · MAJOR · `[RD]`

The previous report labelled *"geospatial data for the matched building is included in the context"* a `THESIS REQUIREMENT`. It is not stated anywhere, and the label hides a genuine three-way design fork that changes what you build:

| Option | Description | Consequence |
|---|---|---|
| **(a) Relational only** | POIs live in a table; the frontend reads them for Leaflet; they never enter the LLM prompt | The chatbot **cannot answer navigation questions**, which is one of the three query categories the thesis names in §3.5.4. Fails the requirement. |
| **(b) Embedded into the corpus** | A natural-language description per POI is chunked and embedded alongside institutional documents | Navigation queries are answered by the same retrieval path as everything else. **Uniform pipeline, uniform RAGAS treatment.** |
| **(c) Relationally fetched and injected** | The router detects a place name, looks it up, and injects the row into the prompt | Adds a second, parallel context path that RAGAS does not see as retrieval, **confounding Context Precision/Recall** for a whole query category |

**The thesis leans toward (b).** §2.2 Phase 2 states that *"the Retrieval-Augmented Generation (RAG) pipeline processes the unstructured institutional **and geospatial** data."* That sentence puts geospatial data inside the RAG pipeline, not beside it.

**Recommend a dual representation** `[ID]`: coordinates stay relational for Leaflet (they are structured data and do not belong in a vector store), while a generated natural-language "place card" per POI - name, department, building function, neighbours, what happens there - is embedded into the corpus so navigation queries retrieve it like any other chunk. This is why the schema in Section E carries both `poi` and `poi_document`.

This choice matters for evaluation as much as for architecture: under (b) your navigation queries flow through the same retriever your RAGAS metrics measure. Under (c) they do not, and a whole category of your test set would be scored against a context path the metrics were never designed to see.

---

## 9. Data architecture

### 9.1 Demo / synthetic data

The previous report's D6 (build with placeholders, replace later) is **the right call** — waiting for real institutional data before writing any code would stall the project for weeks. But its enforcement mechanism, *"segregate in a `seed/` or `dev-data/` directory,"* is **too weak** (F-38).

#### F-38 — Directory-level separation cannot prevent synthetic data entering an evaluation · MAJOR · `[ID]`

A folder convention is not a guarantee. Once synthetic rows are in the database they are indistinguishable from real ones at query time, and the failure mode is catastrophic and silent: **a Chapter 4 result computed partly on invented data.** That is research misconduct even when accidental, and it would be very hard to detect after the fact.

**Required instead — enforce at the data layer:** `[ID]`

1. **Every table holding research-relevant data carries a `data_origin` column** with values `synthetic | real`, `NOT NULL`, no default.
2. **The evaluation harness refuses to run** if any row it touches has `data_origin = 'synthetic'`. Hard failure, not a warning.
3. **Synthetic records are visibly marked in the UI** during development — e.g. every placeholder faculty name is prefixed `[DEMO]`, every placeholder coordinate is obviously offset. **If a screenshot of synthetic data ever ends up in the thesis, it must be self-evidently synthetic.**
4. **Separate Supabase projects for dev and research**, if budget allows `[OI]` — the strongest form of separation, and it makes "could synthetic data have contaminated your results?" a one-word answer.

This turns an honour-system convention into an enforced invariant, and it is directly defensible: *"the harness cannot run on synthetic data; it raises."*

### 9.2 Future real ISU data and replacement strategy

`[ID]` Design every ingestion path so real data replaces synthetic **by re-running the same loader against a different source**, not by editing rows. Loaders read from files/exports; no data is ever hand-typed into the production database.

Replacement order matters, because it maps to the four thesis data streams (§3.4.1):

| Stream | Replaceable independently? | Blocks what |
|---|---|---|
| Geospatial coordinates | Yes | Map demo realism; navigation queries |
| Institutional documents | Yes | **All RAGAS evaluation** — this is the critical path |
| Faculty schedules | Yes | RF training; faculty resolution |
| Attendance history | Yes, but see F-18 | **RF training entirely** — highest risk |
| Guard logs | Generated live during evaluation | Override behaviour |

`[RD]` **Sequencing recommendation:** chase **attendance data first**, because F-18 means it can invalidate the ML formulation, and you want to know that in week 2 rather than week 10. Institutional documents second, because RAGAS is your primary evaluation and needs a real corpus.

### 9.3 Separation of development and research data

| Concern | Mechanism | Class |
|---|---|---|
| Synthetic never reaches results | `data_origin` + harness hard-fail (F-38) | `[ID]` |
| Dev traffic never counted as evaluation | `eval_run_id` present on evaluation queries; live chat logs are a separate table | `[ID]` |
| Prompts/K/model pinned per run | Config snapshot stored with each `eval_run` | `[ID]` |
| Faculty validation kept separate from RAGAS | Different tables, different sources (human vs automated) | `[TR]` by §3.8's two-track design |

---

## 10. Homepage and public-facing UI

**Neither prior document addresses this at all**, despite the working directory being named `thesis-website`. This section is new.

### 10.1 First, a scoping question nobody has answered

`[RD]` **Is the deliverable one thing or two?**

- **(A) A project/thesis website** — a public page describing the research, with the working system linked or embedded.
- **(B) The application itself** — map, chatbot, guard dashboard, with no marketing surface.

**The thesis requires (B).** §3.5 describes three frontend surfaces; a homepage is mentioned nowhere in the document. A public-facing informational homepage is `[OI]` — legitimate and often expected for a capstone, but it is **not** a thesis requirement, and every hour spent on it is an hour not spent on the evaluation harness.

**Recommend:** build (B) first and completely. Add a thin landing surface later only if the panel or the department expects one.

### 10.2 Does a planned homepage accurately represent the thesis?

There is no homepage design to audit yet, so this section is preventative. The governing fact is: **the thesis is a proposal. Chapters 4 and 5 do not exist. No result has been measured.** Any public page must be written from that position.

### 10.3 Wording that would accidentally imply validated results

This is the real risk, and it is easy to trip into. **Do not ship any of these:**

| ❌ Unsafe | Why | ✅ Safe |
|---|---|---|
| "94 % accurate faculty availability prediction" | Fabricated result. No model exists. | "Estimates faculty availability using a Random Forest classifier" |
| "Outperforms standard RAG" | The comparison has not been run. This is the study's *hypothesis*. | "Designed to be evaluated against a standard RAG baseline using RAGAS" |
| "Validated by 15 faculty members" | Validation has not happened. | "Will be validated by 15 faculty members across at least five departments" |
| "Real-time faculty tracking" | Contradicts the entire privacy posture — and "tracking" is precisely the word the thesis avoids | "Generalized availability status" |
| "Fully compliant with RA 10173" | Compliance is a legal determination, not a design claim | "Designed in accordance with RA 10173 principles" |
| "Knows where every professor is" | Marketing phrasing that describes a system you deliberately did not build | "Tells you whether a faculty member is likely available" |
| "AI-powered · 99.9 % uptime · trusted by ISU" | Institutional endorsement not granted; uptime not measured | Omit entirely |

**Tense is the tell.** The thesis is written in future tense throughout — *"will be developed"*, *"will be evaluated"*. **Any public page should match that tense for anything not yet measured.** Present tense on an unmeasured claim reads as a result.

`[RD]` **Hard rule the implementing agent must follow: no numeric performance figure appears anywhere in the UI, the README, the homepage, or a demo script until it has been computed from a real run.** Not as a placeholder, not as a mockup value, not as "lorem ipsum" statistics. Placeholder numbers have a way of surviving into screenshots.

### 10.4 What belongs where

| Public homepage `[OI]` | The application `[TR]` | Neither — internal only |
|---|---|---|
| Project title, authors, degree, institution | Interactive campus map (Leaflet) | Guard dashboard (authenticated, unlisted) |
| Problem statement and objectives (future tense) | Chatbot interface | RAGAS scores (until measured, then thesis only) |
| Architecture diagram | Availability status display | Probability vectors |
| Technology stack | Map–chat coordination `[OI]` | Model version / run IDs |
| Link into the app | Graceful error states `[ID]` | Evaluation harness |
| Statement that evaluation is ongoing | Freshness timestamp `[OI]` | Faculty validation checklist (authenticated) |
| Privacy/status-masking explanation — **good material, shows the ethical design** | "Estimate" qualifier `[OI]` | Any synthetic data (or clearly marked `[DEMO]`) |

`[OI]` A plain-language explanation of the status masking protocol on the public page is genuinely worth including — it demonstrates the ethical reasoning that is a claimed contribution (§2.1.7), and it pre-empts the "are you tracking professors?" reaction from students.

---

## 11. Research integrity — what must NOT be fabricated

The distinction that governs everything below: **the system must be built and must work** (development deliverable); **its outputs must be measured against real data and real people** (research deliverable). Code may be complete before data exists. Results may not.

| # | Must not be fabricated | Development stand-in permitted? | Hard rule |
|---|---|---|---|
| R1 | **Faculty names, departments, roster** | Yes — `[DEMO]`-prefixed, `data_origin='synthetic'` | Real roster from department heads, consent-gated (F-32) |
| R2 | **Faculty schedules** | Yes, marked | Real schedules from department heads / registrar (§3.4.1b) |
| R3 | **Attendance history** | Yes, marked — **but see F-18: synthetic attendance will make the RF look better than it will be**, because invented data has cleaner patterns than reality | Real, pseudonymised records only for any reported metric |
| R4 | **GPS coordinates** | Yes, obviously-offset placeholders | Real on-site GPS survey (§3.4.1a) |
| R5 | **Institutional documents** | Yes — clearly fictional text, never plausible-looking fake memoranda | Real memoranda/calendars/handbooks (§3.4.1c) |
| R6 | **RF accuracy, precision, recall, F1, confusion matrix, feature importances** | **No. Never. Not even as a placeholder in a chart.** | Computed from a real trained model on real held-out data |
| R7 | **RAGAS scores (all four, both arms)** | **No. Never.** | Computed by RAGAS from real runs against researcher-composed ground truth |
| R8 | **Response time comparisons** | **No.** | Measured, interleaved, median + p95 (F-02) |
| R9 | **Faculty validation results** | **No.** | From the 15 consented validators' actual checklists |
| R10 | **Guard presence logs** | Yes, for development | Real guard entries during the evaluation period |
| R11 | **Rule-based baseline accuracy** (F-20) | **No.** | Measured on the same test set |
| R12 | **Research conclusions** | **No.** | Chapters 4 and 5 are written by Michael and Christian, from measured data, after the runs |

**Additional prohibitions for the implementing agent:**

- **Do not write a chart component pre-populated with example values.** A radar plot seeded with plausible RAGAS numbers is one screenshot away from being evidence.
- **Do not commit a trained model artifact produced from synthetic data** without `synthetic` in its filename and its metadata.
- **Do not write Chapter 4 or 5 text, an abstract with results, or a conclusions section.** Not even a draft. Not even "to be filled in."
- **Do not invent citations or add references not in the thesis's reference list.**
- **Do not claim RA 10173 compliance** anywhere in code comments, README, or UI (F-25).
- **If a metric is needed for a layout, render an empty state** — "Not yet evaluated" — never a number.

---

## 12. Thesis-defense risk register

Ordered by likelihood × damage. Each row is a question you should be able to answer in under a minute.

| # | Likely question | Risk | Prepared answer / required action |
|---|---|---|---|
| **1** | *"§3.10 says you store no PII, but you store faculty names and a live presence log. Which is it?"* | **Critical** | Reword §3.10 to data-minimisation language **before submission** (F-25). There is no way to answer this well if the text still says what it says. |
| **2** | *"§3.5.3 says the model outputs a room; §3.5.2 says it outputs a status. What did you build?"* | **Critical** | Lead with §1.3 Scope; state the reconciliation explicitly; explain that the stated training data cannot produce room labels (F-10, §3.3). Acknowledge the inconsistency rather than hoping it goes unnoticed. |
| **3** | *"If the model already outputs 'Available for Consultation', what does masking mask?"* | **Critical** | The egress-boundary reframing (F-26) plus the adversarial test suite (F-27). Without this you have no answer. |
| **4** | *"Show me where Context Precision improved."* | **Critical** | Resolve F-04 before running anything. Be ready to explain *why* two retriever metrics are flat/near-flat and what the status-as-context framing does. |
| **5** | *"Your feature importance doesn't tell me ML beats a schedule lookup. Did you compare?"* | **High** | Build and report the rule-based baseline (F-20). This converts the worst question into your best slide. |
| **6** | *"Anyone can poll your public chatbot to reconstruct a professor's daily movements."* | **High** | Rate limiting + present-moment-only + named as a limitation with a stated mitigation (F-29). |
| **7** | *"Your system just told me Prof. Santos is in Room 304."* (from a retrieved directory chunk) | **High** | The static-directory vs real-time-whereabouts position, stated in the thesis and enforced in code (F-28). |
| **8** | *"What was the granularity of your attendance data?"* | **High** | Answer F-18 before writing training code. If it is daily-only, the formulation must change and you need to have changed it deliberately. |
| **9** | *"Enhanced RAG is slower. Why is that acceptable?"* | **High** | Component-level latency showing the RF path's cost, framed as the price of a capability the baseline cannot provide at all (F-02). |
| **10** | *"How did you split train/test?"* | **Medium-High** | Time-based or grouped split, stated explicitly (F-21). "80/20 random" invites the leakage question. |
| **11** | *"Which model judged your RAGAS metrics?"* | **Medium-High** | A model other than the generator, disclosed, temperature 0, identical across arms (F-05). |
| **12** | *"You anonymised attendance but model individual punctuality. How?"* | **Medium-High** | Pseudonymisation, with the terminology corrected in Chapter 3 (F-19). |
| **13** | *"Did the 15 validators consent? Did the other faculty in your training data?"* | **Medium-High** | Consent-gated roster; institutional authorisation + pseudonymisation for training-only data (F-32). |
| **14** | *"Your guard never logged anyone. Did the Random Forest ever actually run?"* | **Medium-High** | Tri-state model (F-07) + override-rate reported alongside accuracy. Under the previous report's boolean design the honest answer would have been "no." |
| **15** | *"Why is the availability status not a probability, when your objective says probability estimates?"* | **Medium** | Reword Objective 4, or add calibration (F-22). Decide now. |
| **16** | *"Your Context Recall is low. Is that retrieval or chunking?"* | **Medium** | Token-aware chunking under 256 word-pieces, verified (F-34); exact search, no ANN index (F-36). |
| **17** | *"How do you know your test set wasn't chosen to favour your system?"* | **Medium** | Pre-register the query mix in writing before any run (F-04). |
| **18** | *"Is this the same Llama model you started with?"* | **Medium** | Pinned model ID recorded with date; any substitution disclosed (§8.7). |
| **19** | *"What happens if two professors share a surname?"* | **Low-Medium** | Clarifying question, never a guess (F-24, F-31). |
| **20** | *"Can it answer in Filipino?"* | **Low-Medium** | Either an explicit English-only delimitation or a model change — decided, not discovered live (F-35). |
| **21** | *"§3.10 cites §3.5.4 for status masking, which is §3.5.3."* | **Low** | Fix the cross-references (F-33). Cheap to fix, mildly embarrassing to leave. |
---

# A. Decisions that are sound and should remain

| # | Decision | Source | Why it stands |
|---|---|---|---|
| A1 | **RF predicts the three availability statuses directly** (previous D1 = A) | prev. report | Correct conclusion. Strengthen the argument with §1.3 Scope and the data-feasibility point (F-10); drop the Gini-list argument, which F-09 undermines. |
| A2 | **Probability vector stays internal; users see one categorical status** (prev. D8 = B) | prev. report | Correct, and §3.9's exhaustive list of categorical metrics makes it airtight (§4.1). |
| A3 | **Embeddings hosted in the Python/Flask service** (prev. D3 = A) | prev. report | Correct conclusion, better reasons available (F-14) — chiefly that query and document vectors must come from one code path. |
| A4 | **Supabase Auth for guard accounts** (prev. D4 = A) | prev. report | Correct. Explicitly rule out the shared-PIN alternative (§7.2). |
| A5 | **Build with clearly-labelled placeholder data; replace before evaluation** (prev. D6 = A) | prev. report | Right call; enforcement mechanism must be strengthened (F-38). |
| A6 | **Do not build: student login, faculty portal, native app, push notifications, analytics dashboard, multi-language, offline mode** | prev. report | Correct scope discipline. Keep it. |
| A7 | **Status masking implemented as Node middleware** | §3.5.3 `[TR]` | Thesis-specified, and sound under Interpretation A (F-13). |
| A8 | **pgvector inside Supabase rather than an external vector DB** | §3.7 `[TR]` | Thesis-specified with an explicit rationale. Good defense answer. |
| A9 | **The full mandated stack** — React 18, Leaflet 1.9, Node 20/Express 4, Supabase, Python 3.11/sklearn 1.4, Flask, Llama 3.1 8B via Groq, all-MiniLM-L6-v2 | §3.7 `[TR]` | Do not substitute without recording the deviation. |
| A10 | **Ingestion as a batch script, not an admin UI** | prev. S4 | Correct; the audit makes it firmer (§8.1). |
| A11 | **Do not display a confidence indicator** (prev. D8) | prev. report | Correct. The audit upgrades this from "thesis-faithful" to "do not build" (§4.3). |
| A12 | **Do not claim RA 10173 compliance / E2E encryption / GDPR** | prev. report §6 | Correct and important. Extend it to the thesis text itself (F-25). |

# B. Decisions that should be CHANGED

| # | Change from → to | Finding | Severity |
|---|---|---|---|
| B1 | Guard log `BOOLEAN is_on_campus`, no timestamps → **append-only tri-state event log with a validity window**; `unknown` proceeds to the RF | F-07 | **BLOCKER** |
| B2 | MUST-HAVE list M1–M9 → **add: Standard RAG baseline arm, rule-based schedule baseline, response-time instrumentation, evaluation-run persistence** | F-01, F-20, F-02, F-03 | **BLOCKER** |
| B3 | Masking = hash map + purge → **masking = egress boundary**: allowlist projection, override precedence, purge, **output-side filtering**, corpus-side exclusion | F-26, F-27, F-28 | **BLOCKER** |
| B4 | "No PII stored" as NFR-01 → **data-minimisation framing**; §3.10 reworded | F-25 | **BLOCKER** |
| B5 | Query routing "LLM-based / hybrid" (prev. D2 = C) → **deterministic gazetteer + intent router, measured; LLM fallback only if the measurement justifies it** | §5.3 | **MAJOR** |
| B6 | Public unrestricted chatbot (prev. D5 = B) → **public, but rate-limited and present-moment-only**; optional auth gate on availability queries | F-29 | **MAJOR** |
| B7 | "Label mismatch is a simple renaming" → **explicitly reconcile three vocabularies; the evaluated set is binding** | F-09 | **MAJOR** |
| B8 | Synthetic data separated by directory → **`data_origin` column + harness hard-fail + visible `[DEMO]` marking** | F-38 | **MAJOR** |
| B9 | 80/20 random split → **time-based (or grouped) split, stated explicitly** | F-21 | **MAJOR** |
| B10 | Chunking unspecified → **token-aware, ≤ 256 word-pieces, verified with the model's tokenizer** | F-34 | **MAJOR** |
| B11 | pgvector index unaddressed → **exact search, no ANN index, stated as a deliberate choice** | F-36 | **MAJOR** |
| B12 | Confidence indicator as SHOULD-HAVE (S3) → **removed entirely** | §4.3 | **MINOR** |
| B13 | Flask exposes `/predict` + `/embed` → **add `/embed/batch`, `/healthz`, `/model/info`** | F-22 | **MINOR** |
| B14 | ~⅓ of `THESIS REQUIREMENT` labels → **re-tag as `[ID]` / `[RD]`; require a quotable sentence for `[TR]`** | F-06 | **MAJOR** |

# C. Decisions Michael and Christian must explicitly approve

**These are research decisions. The implementing agent must not choose any of them.** Nothing in the RF, evaluation, or privacy tracks should start until C1–C7 are signed off.

| # | Decision | Options | Audit recommendation | Blocks |
|---|---|---|---|---|
| **C1** | **RF target and class vocabulary** — confirm three status classes; confirm the evaluated vocabulary is binding and the Gini list is illustrative | (a) 3 status classes (b) location classes | **(a)**, with the reconciliation paragraph written into Ch. 3 (F-09, §3.4) | ML track |
| **C2** | **§3.10 privacy claim rewording** | (a) data-minimisation framing (b) leave as-is | **(a). Highest priority item in this audit.** (F-25) | Nothing technical — but the defense |
| **C3** | **RAGAS treatment of the masked status** — is it a `contexts` item in the Enhanced arm? | (a) yes (b) no | **(a)**, else two of four metrics cannot move (F-04) | Evaluation harness, logging schema |
| **C4** | **Attendance data granularity** — obtain a real sample and confirm | intra-day punches vs daily sign-in | Must be answered before any training code; if daily-only, the ML formulation changes (F-18) | **Entire ML track** |
| **C5** | **Guard override scope in the evaluation** | (a) report override-rate (b) exclude override-served queries from RF accuracy (c) descope guard logging | **(b)** (F-07) | Guard model, eval harness |
| **C6** | **Static office location vs real-time whereabouts** — the F-28 position | (a) directory info permitted, never combined with live status (b) exclude faculty location from the corpus | **(a)**, stated in Ch. 3 and enforced in code | Corpus curation, prompt design |
| **C7** | **Public access model for availability queries** | (a) rate-limited public (b) auth-gated availability (c) unrestricted | **(a) + present-moment-only minimum**; (b) is the strongest answer (F-29) | Auth, API design |
| **C8** | **Objective 4 wording: "probability estimates"** | (a) reword to status/classification (b) add calibration analysis | **(a)** unless validation volume supports (b) (F-22) | Thesis text |
| **C9** | **RAGAS judge model + embedding model** | any, disclosed | Not the generator; temperature 0; identical across arms (F-05) | Evaluation harness |
| **C10** | **Curated test-set composition** (query mix across the three categories) and size | researcher-defined | **Pre-register in writing before any run** (F-04) | Evaluation |
| **C11** | **Consent-gated faculty roster** | (a) consented faculty only (b) all faculty in participating departments | **(a)** (F-32) | Roster, router |
| **C12** | **Rule-based baseline** — build and report it? | (a) yes (b) no | **(a)** — turns the worst defense question into the best slide (F-20) | Extra small build |
| **C13** | **Guard-log validity window** | same-day / N hours | Same-calendar-day default (F-07) | Guard model |
| **C14** | **Faculty validation capture** | (a) in-system (b) paper/form | **(a)** for evidentiary strength; (b) is thesis-sufficient (F-08) | One table + one screen |
| **C15** | **"Partially correct" in the confusion matrix** | define or drop | Decide **before** validators start (F-08) | Analysis plan |
| **C16** | **Language scope** | (a) English-only delimitation (b) multilingual model | **(a)** (F-35) | Thesis text |
| **C17** | **Global RF with pseudonymous ID vs per-faculty models** | (a) global + aggregate features (b) per-faculty | **(a)** — per-faculty will underfit at this data volume (F-19) | ML design |
| **C18** | **Homepage scope** | (a) app only (b) app + public landing page | **(a) first**, (b) later if expected (§10.1) | Frontend scope |
| **C19** | **Top-K and similarity floor** | researcher-fixed | Fix before evaluating; never tune after seeing RAGAS (F-36) | Retrieval |
| **C20** | **Presence-log retention and deletion date** | researcher-defined | e.g. deleted 30 days post-evaluation (F-30) | Data policy |

# D. Recommended final architecture

Three tiers as the thesis specifies (§3.5), with the corrections above folded in.

```
┌──────────────────────────────────────────────────────────────────┐
│ TIER 1 — React 18 SPA                                            │
│   /            map + chatbot (public, rate-limited)              │
│   /guard       presence logging      (auth: guard)               │
│   /validate    validation checklist  (auth: faculty)  [C14]      │
│   Leaflet 1.9 · no Supabase service key · no Groq key            │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS, JSON
┌───────────────────────────▼──────────────────────────────────────┐
│ TIER 2 — Node 20 + Express 4                                     │
│                                                                  │
│   Query Router  ── deterministic gazetteer + intent  [B5]        │
│        │           IDENTICAL IN BOTH ARMS  [F-01]                │
│        ├──────────────────────────────┐                          │
│        │ needs_availability?          │ always                   │
│        ▼                              ▼                          │
│   Presence Resolver             Retrieval                        │
│   tri-state + window [B1]       embed → pgvector → top-K         │
│        │                              │                          │
│   confirmed_off ──► "Unavailable"     │                          │
│   on_campus / unknown ──► RF          │                          │
│        ▼                              │                          │
│   ╔═══════════════════════════╗       │                          │
│   ║ STATUS MASKING BOUNDARY   ║       │                          │
│   ║  · allowlist → 1 of 3     ║       │                          │
│   ║  · override precedence    ║       │                          │
│   ║  · purge intermediates    ║       │                          │
│   ╚═══════════╤═══════════════╝       │                          │
│               └──────────┬────────────┘                          │
│                          ▼                                       │
│              CONTEXT FUSION  — one template, one                 │
│              conditional block = the ONLY arm difference         │
│                          │                                       │
│                          ▼                                       │
│                    Groq · Llama 3.1 8B · temp 0                  │
│                          │                                       │
│               ╔══════════▼═══════════╗                           │
│               ║ RESPONSE EGRESS      ║  [F-27] output-side       │
│               ║ location-leak filter ║  location filtering       │
│               ╚══════════╤═══════════╝                           │
│                          │                                       │
│              response DTO allowlist ── status + text only        │
│              telemetry ──► eval tables (F-02, F-03)              │
└───────────────────────────┬──────────────────────────────────────┘
                            │ internal HTTP (localhost/private)
┌───────────────────────────▼──────────────────────────────────────┐
│ TIER 2b — Python 3.11 + Flask   (NOT internet-reachable)         │
│   /predict  RF (sklearn 1.4) → 3-class + predict_proba           │
│   /embed · /embed/batch   all-MiniLM-L6-v2, 384-d                │
│   /model/info · /healthz                                         │
│   Offline: ingest.py · train.py · evaluate_ragas.py              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│ TIER 3 — Supabase / PostgreSQL + pgvector                        │
│   RLS deny-by-default on every table                             │
│   data_origin on every research-relevant table  [B8]             │
│   exact NN search, no ANN index  [B11]                           │
└──────────────────────────────────────────────────────────────────┘
```

**Four invariants the implementing agent must not break:**

1. **One pipeline, one mode flag.** Router and retrieval identical across arms; fusion is the only branch.
2. **Nothing crosses the masking boundary except one of three enum values.**
3. **No LLM output reaches the client without passing the egress filter on availability queries.**
4. **The evaluation harness refuses to run on `data_origin = 'synthetic'`.**

# E. Recommended database schema

Specification, not DDL. All tables: RLS deny-by-default; `id uuid` PK; `created_at timestamptz`.

### Core domain

| Table | Key fields | Notes |
|---|---|---|
| **faculty** | `full_name`, `honorific`, `department_id`, `is_consented bool`, `is_active bool`, `data_origin` | `is_consented` gates the router gazetteer (C11). Names live here and **only** here. |
| **faculty_alias** | `faculty_id`, `alias` | Surnames, common spellings. Backs exact-match resolution (F-31). |
| **department** | `name`, `college`, `building_id` | |
| **faculty_schedule** | `faculty_id`, `day_of_week`, `start_time`, `end_time`, `semester`, `course_code`, `room_label`, `data_origin` | `room_label` is **training/relational only — never enters a prompt** (F-27, F-28) |
| **attendance_record** | `faculty_pseudonym_id`, `event_time`, `event_type`, `source`, `data_origin` | Pseudonymised (F-19). **No names.** |
| **faculty_pseudonym_map** | `faculty_id`, `pseudonym_id` | Held separately; never exposed to the model or the API |
| **institutional_event** | `date`, `event_type`, `affects_campus bool` | The binary flags of §3.5.2(c) |

### Geospatial

| Table | Key fields | Notes |
|---|---|---|
| **poi** | `name`, `poi_type`, `lat`, `lng`, `building_function`, `department_id`, `description`, `data_origin` | §3.5.1 metadata |
| **poi_document** | `poi_id`, `generated_text` | The place-card text embedded into the corpus (F-37) — keeps coordinates relational while making places retrievable |

### RAG

| Table | Key fields | Notes |
|---|---|---|
| **document** | `title`, `doc_type`, `source_url_or_origin`, `official_date`, `provided_by`, `ingested_at`, `data_origin` | Provenance is mandatory (§8.1) |
| **document_chunk** | `document_id`, `chunk_index`, `content`, `token_count`, `embedding vector(384)`, `embedding_model`, `embedding_version` | `token_count` **enforced ≤ 256** (F-34). Exact cosine search, no ANN index (F-36). |

### Presence (replaces the previous boolean design)

| Table | Key fields | Notes |
|---|---|---|
| **guard_presence_event** | `faculty_id`, `event_type ∈ {arrival, departure}`, `occurred_at`, `logged_by`, `note`, `data_origin` | **Append-only.** No updates, no deletes. Current state derived at query time within the validity window (B1). |
| **guard_user** | `auth_user_id`, `display_name`, `is_active` | |

### Evaluation and research (entirely missing from the previous report)

| Table | Key fields | Notes |
|---|---|---|
| **eval_run** | `run_label`, `started_at`, `mode`, `groq_model_id`, `prompt_template_version`, `top_k`, `rf_model_version`, `embedding_model`, `judge_model`, `notes` | The reproducibility record. One row per run. |
| **eval_query** | `run_id`, `query_text`, `category`, `ground_truth_answer` | The pre-registered curated set (C10) |
| **eval_result** | `run_id`, `eval_query_id`, `mode`, `retrieved_contexts jsonb`, `fused_prompt`, `answer`, `masked_status`, `rf_proba jsonb`, `t_route`, `t_guard`, `t_rf`, `t_embed`, `t_retrieve`, `t_llm`, `t_total` | F-02, F-03. **Retrieved contexts verbatim** or RAGAS cannot run. |
| **ragas_score** | `eval_result_id`, `context_precision`, `context_recall`, `faithfulness`, `answer_relevancy` | Written only by the harness, from real runs (R7) |
| **faculty_validation** | `faculty_id`, `queried_at`, `system_status`, `actual_status`, `correctness`, `notes` | §3.8.2 (C14). System status recorded automatically. |
| **rf_model_version** | `version`, `trained_at`, `training_row_count`, `class_order`, `feature_list`, `split_strategy`, `metrics jsonb`, `data_origin` | R6 — metrics written only from real training runs |
| **chat_log** | `session_hash`, `query`, `route_decision`, `answer`, `latencies`, `created_at` | Live traffic, **separate from eval** (§9.3). Short retention. |

### Data-integrity rules

1. `data_origin ∈ {synthetic, real}`, `NOT NULL`, **no default**.
2. The evaluation harness **raises** if any touched row is `synthetic` (F-38).
3. `guard_presence_event` is append-only, enforced by policy.
4. `document_chunk.token_count ≤ 256`, enforced at ingest (F-34).
5. `attendance_record` has no foreign key to `faculty` — only to the pseudonym map (F-19).

# F. Recommended API / service architecture

### Node public

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/chat` | public, rate-limited | **Hard-wired to `enhanced`.** No `mode` parameter (F-16). Returns `{ answer, status?, status_as_of?, sources? }` — allowlist DTO. |
| `GET` | `/api/map/pois` | public | Coordinates + metadata for Leaflet |
| `GET` | `/api/faculty/search` | public, rate-limited | Consented roster only; exact/alias match; **never fuzzy-resolves across people** (F-31) |

### Node authenticated

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/guard/events` | guard | Append arrival/departure |
| `GET` | `/api/guard/today` | guard | Today's entries + derived state |
| `POST` | `/api/validation/entries` | faculty | Validation checklist (C14) |
| `POST` | `/api/eval/run` | researcher | Drives the same core pipeline with explicit `mode`; writes `eval_run`/`eval_result` |
| `GET` | `/api/eval/runs/:id` | researcher | Export for RAGAS |

### Flask internal — **not internet-reachable**

| Method | Path | Notes |
|---|---|---|
| `POST` | `/predict` | Returns class + `predict_proba` + `model_version`. **Never returns a location.** |
| `POST` | `/embed` | Single text → 384-d |
| `POST` | `/embed/batch` | Ingestion |
| `GET` | `/model/info` | Version, class order, feature list, sklearn version |
| `GET` | `/healthz` | Demo stability |

### Offline Python

`ingest.py` · `train_rf.py` · `baseline_rule.py` (C12) · `run_eval.py` · `score_ragas.py`

### Boundary rules

1. Groq is called **only** from Node. The key never leaves the server.
2. Flask is **never** exposed publicly.
3. The frontend never holds the Supabase `service_role` key.
4. `/api/chat` cannot select the standard arm.
5. Every response body is an explicit allowlist — no debug passthrough (§6.3).

# G. Recommended development sequence

Ordered so that **the things that can invalidate the project happen first**, and so parallel work is possible.

### Phase 0 — Unblock (days, no code)
1. **C4: get a real sample of attendance data and confirm granularity.** Highest-risk unknown in the project (F-18).
2. **C1, C2, C3** approved in writing.
3. Confirm the Groq model ID is currently served; pin it.
4. Request the four data streams from department heads, registrar, admin offices, and security.

### Phase 1 — Foundation (parallel-safe)
5. Supabase project; schema from Section E; **RLS deny-by-default from day one**, not retrofitted.
6. `data_origin` discipline and the harness hard-fail (F-38) — build the guard rail before the data.
7. Placeholder data, `[DEMO]`-marked.
8. React shell + Leaflet map + POI endpoint. Visible progress, zero research risk.

### Phase 2 — RAG core (this is the thesis's critical path)
9. Flask service: `/embed`, `/embed/batch`, `/healthz`.
10. `ingest.py` with **token-aware chunking, verified ≤ 256** (F-34).
11. Retrieval: exact cosine, fixed K (C19).
12. Prompt template, versioned, with the single conditional block.
13. **Both arms working** — standard and enhanced, one code path (F-01).
14. Telemetry + `eval_result` persistence (F-02, F-03).
15. Chatbot UI end-to-end on institutional queries only.

> At this point you have a demonstrable system and a runnable RAGAS harness **before** any ML exists. If the ML track hits trouble at C4, the thesis still has a spine.

### Phase 3 — Availability path
16. Guard event model + dashboard + auth + RLS (Section 7).
17. Deterministic router; **hand-label 100 queries and measure it** (§5.3).
18. Masking boundary with allowlist projection and purge.
19. **Egress filter + adversarial test suite** (F-27). Do not defer this; it is defense evidence.
20. Faculty resolution with clarify-never-guess (F-31).

### Phase 4 — ML (gated on C4)
21. Label construction from real attendance; document the sampling scheme (F-21).
22. **Rule-based baseline first** (C12) — it is cheap and it is your comparison floor.
23. Train RF; **time-based split**; cross-validation; per-class metrics with support.
24. `/predict`; wire into the availability path; model versioning.
25. Feature importance — reported as a diagnostic, **not** as the ML-necessity argument (F-20).

### Phase 5 — Evaluation (real data only)
26. Replace all placeholder data; flip `data_origin` to `real`; verify the harness now runs.
27. **Pre-register the curated test set** (C10).
28. RAGAS, both arms, interleaved, same session (F-04, F-05).
29. Response time, median + p95 (F-02).
30. Deploy; orient the 15 validators; run functional validation (§3.8.2).

### Phase 6 — Analysis
31. Confusion matrix, per-category precision/recall/F1.
32. RF vs rule-based comparison.
33. Charts from **measured** data only.
34. **Michael and Christian write Chapters 4 and 5.** Not the agent (R12).

# H. Final checklist before implementation begins

### Must be true before **any** code is written
- [ ] **C1** RF target and class vocabulary approved in writing
- [ ] **C2** §3.10 privacy wording resolved
- [ ] **C3** RAGAS treatment of masked status decided
- [ ] **C4** Attendance data granularity confirmed from a real sample
- [ ] Groq model ID verified as currently served, and pinned
- [ ] This audit read by both researchers; Section C decisions recorded in a dated file in the repo

### Must be true before the **availability path** is built
- [ ] **C5** Guard override evaluation scope decided
- [ ] **C6** Static-office vs real-time-whereabouts position written into Ch. 3
- [ ] **C7** Public access model decided
- [ ] **C11** Consent-gated roster confirmed
- [ ] **C13** Validity window set

### Must be true before the **evaluation harness** is built
- [ ] **C9** Judge model and embedding model chosen and disclosed
- [ ] **C10** Curated test set pre-registered, with the query mix written down
- [ ] **C19** Top-K and similarity floor fixed
- [ ] **C12** Rule-based baseline confirmed in scope
- [ ] **C15** "Partially correct" defined or dropped

### Must be true before **any result is reported**
- [ ] Every `data_origin` is `real`; the harness runs without raising
- [ ] Both arms ran interleaved in the same session with identical config
- [ ] Model version, prompt version, K, and judge recorded on the run
- [ ] Train/test split strategy documented (F-21)
- [ ] No number anywhere in code, UI, or README that was not measured (Section 11)

### Engineering invariants the implementing agent must never violate
- [ ] One pipeline, one mode flag — router and retrieval identical across arms
- [ ] Only a three-value enum crosses the masking boundary
- [ ] Every availability response passes the egress filter
- [ ] The harness hard-fails on synthetic data
- [ ] RLS deny-by-default on every table; `service_role` server-only; Groq key server-only; Flask never public
- [ ] Every chunk ≤ 256 word-pieces, verified with the model's tokenizer
- [ ] Document and query embeddings produced by the same code path
- [ ] No fabricated faculty, schedules, attendance, coordinates, documents, accuracy, RAGAS scores, validation results, or conclusions

---

## Appendix — Open ambiguities left deliberately unresolved

Per instruction, these are **not** silently resolved. Each needs a researcher decision (Section C) or an explicit acknowledgement in Chapter 3.

| # | Ambiguity | Interpretation 1 | Interpretation 2 | Audit position |
|---|---|---|---|---|
| **AMB-1** | RF output: status or location? | §1.3, §3.5.2, §1.1, §3.5.4 → **status** | §3.5.3 step 1 + code → **location** | Status. Strongly, on five grounds — but the conflict must be acknowledged, not hidden (§3.4) |
| **AMB-2** | Class vocabulary | `{Available, Late, Absent}` (Gini) | `{Available for Consultation, Currently in a Lecture, Unavailable}` (output + evaluation) | The evaluated set is binding; the Gini list is illustrative (F-09) |
| **AMB-3** | "Probability estimates" | Categorical classification described as probabilistic | Numeric probabilities surfaced and evaluated | §3.9's metrics are exclusively categorical → categorical. But Obj. 4's wording needs fixing (F-22) |
| **AMB-4** | Is the masked status part of "retrieved context" for RAGAS? | Yes — Context Fusion merges three sources | No — only pgvector chunks count | Must be decided (C3). Without "yes", two metrics cannot move (F-04) |
| **AMB-5** | Does geospatial data enter the LLM prompt, or only the map? | §2.2 Phase 2 says the RAG pipeline processes *"institutional and geospatial data"* → into the corpus | §3.5.1 describes only map rendering + metadata | Dual representation: coordinates relational for Leaflet, generated place-card text embedded for retrieval (F-37) |
| **AMB-6** | "Real-time" | Live sensing | Inference evaluated at query time over static and batch features | The latter. Only the current timestamp is genuinely live. Say so rather than letting a panelist say it |
| **AMB-7** | Absolute privacy claim vs directory data | §3.5.3 forbids displaying any exact faculty location | §3.5.4 ingests faculty directory information | Static office ≠ live whereabouts — defensible, but must be stated (C6, F-28) |
| **AMB-8** | Whose data is in the system | 15 consented validators | All faculty in participating departments | Consent-gate the answerable roster (C11, F-32) |
| **AMB-9** | Guard log semantics | Boolean presence | Event stream with staleness | Tri-state event log; the boolean reading breaks the study (F-07) |
| **AMB-10** | "Anonymized" attendance | True anonymisation | Pseudonymisation | Pseudonymisation — anonymisation would destroy the required per-individual signal (F-19) |
