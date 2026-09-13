# Demo run sheet

One page. Follow it in order; each step sets up the next.

---

## Before the panel walks in

```
start.bat
```

Three windows open. Wait for all three, in this order — the ML service is
slowest because it loads a 135 MB model.

Then, in a fourth terminal:

```
npm run preflight --prefix backend
```

You want nine green `[ ok ]` lines. **If `ML service unreachable` appears, stop
and fix it before demoing** — chat cannot work without port 5001, and it is the
single most common failure.

Open `http://localhost:5173` and leave it on the landing page.

**Do not run the evaluation harness or the RAGAS scorer during the demo.** They
draw on the same Groq quota as the assistant, and the symptom is a 429 that
looks exactly like a broken chatbot.

---

## The run, in order

### 1 · The map — SO3, the deployed system

Click **Open the assistant**. The map loads with 34 published locations.

- Click any pin. The place card opens with a photo banner, name, category,
  description, coordinates.
- Say: *"Every marker is a database row. The map and the assistant read the same
  records, so a location added in the admin dashboard appears in both."*

### 2 · A campus question — SO3, retrieval working

Open the chat dock. Type:

```
Where is the College of Computing?
```

Say: *"That answer came from a place card — a generated description of the
building, embedded and retrieved by cosine similarity. The model wrote the
sentence; the database supplied the facts."*

### 3 · An institutional question — the document corpus

```
When does the second semester start?
```

Say: *"The academic calendar is in the retrieval corpus, 34 passages. This one
used to fail — the chunk holding the date didn't say which semester it belonged
to, because the heading had fallen into a different chunk. The model refused
rather than guess, which is correct behaviour on bad input. We fixed the
chunking, not the model."*

### 4 · An availability question — SO1, the classifier

**You must be signed in for this.** Availability is not answered anonymously.

```
Is SIM-33 available for consultation right now?
```

Say: *"SIM-33 is one of 37 simulated lecturers. The Random Forest ran here — about
32 milliseconds — and returned one of three coarse states. Notice what the answer
does not contain: no room, no building, no floor."*

### 5 · The refusal — the privacy claim, and the best moment in the demo

```
Where is SIM-22?
```

It answers: *"I'm sorry, but I don't have that information."*

Say: *"That question asks for a person's physical location, so the router sent it
down the navigation path and the classifier never ran. The recorded classification
time is 0.0 milliseconds — the estimate was not computed and withheld, it was
never computed. And the wording is identical to the refusal for a building we
don't know about, so using the privacy rule doesn't advertise that it was used."*

### 6 · The admin dashboard — SO3, the write surface

Sign in as admin. Show all three tabs:

- **Campus Locations** — edit a pin, show the photo upload, do not save
- **Faculty Validation** — the capture form
- **Schedule Import** — the two-step preview/apply

Say: *"Three tabs, one sign-in. Every endpoint behind them is role-checked on the
server — the tabs decide what is drawn, the server decides what is allowed."*

---

## If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| Chat returns an error | ML service down | Restart port 5001. Always check this first. |
| Chat returns 429 | Groq quota | Something else is using the API. Wait 60s. |
| Map loads, no pins | Backend down | Restart port 4000. |
| Availability says "sign in" | Not signed in | Correct behaviour — sign in and repeat. |
| Edited a `.py` file | Python cached the old code | Restart the ML service. |

**Recovery line if the system dies mid-demo:** *"The three services are
independent — that's the architecture. Let me restart the ML service; the map and
the document search keep working without it."* Then restart it. That is a true
statement about the design, not an excuse.

---

## Questions to expect

**"Your data is fake."** — It is, and the paper says so on every table. Real
attendance records were ruled out on privacy grounds, which is a §1.3
delimitation. The claim is that the pipeline recovers the behaviour injected into
the generated cohort — not that it predicts real lecturers.

**"Is the Enhanced architecture better?"** — Not faster. It is 169 ms slower, and
we report that. It is better in capability: the standard architecture answered
**0 of 6** availability questions, the enhanced answered **5** and correctly
refused the sixth.

**"Why didn't you report RAGAS scores?"** — Judge throughput. 8,000 tokens per
minute against ~2,000 tokens per grading is about four evaluations a minute, and
a full four-metric sweep over both arms did not fit the study period. A quota
limit, not a design one.

**"Only 24 observations?"** — Yes, and we do not claim an accuracy figure from
them. We found that our own capture form pre-filled the observed status with the
system's estimate, so 84 earlier records recorded agreement by default. We
rebuilt the form and excluded the contaminated records rather than counting them.
