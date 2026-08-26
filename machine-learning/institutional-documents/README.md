# Institutional documents — the RAG corpus

Put university documents here as `.txt` or `.md`, then run:

```
python machine-learning/document_knowledge_importer.py --path machine-learning/institutional-documents --origin real
```

Right now the corpus holds **only auto-generated place-cards** — one short
paragraph per campus location. That is why the assistant can answer "where is
the library" and nothing else. Ask it about enrolment, the calendar or the
handbook and it correctly says it does not know, because nobody has told it.

This folder is the fix, and it needs no consent from anyone: these are
published institutional documents, not personal data.

## The filename decides the document type

`infer_doc_type()` reads the filename. Include one of these words:

| word in filename | becomes | good for |
|---|---|---|
| `memo` | `memorandum` | office memoranda, advisories |
| `calendar` | `academic_calendar` | the real ISU academic calendar |
| `handbook` | `handbook` | student handbook, faculty manual |
| `announcement` | `announcement` | registrar and dean announcements |
| `directory` | `faculty_directory` | **read the warning below** |
| anything else | `other` | still ingested, just untyped |

So `student-handbook-2026.md` and `academic-calendar-2026-2027.txt` are typed
correctly; `doc1.txt` is not.

## Two things that will bite

**Format.** `.txt` and `.md` only — PDF and DOCX are skipped silently. Export
or copy the text out first. Keep the headings: splitting is structure-aware and
a document with headings chunks far better than a wall of text.

**Faculty directories.** The importer prints a warning for a reason. Strip
contact details before ingesting, and keep office assignment separate from
anything about availability — combining "where their office is" with "whether
they are there" in one answer reconstructs exactly the tracking the masking
protocol exists to prevent.

## Highest value first

1. **The real academic calendar.** It also replaces the placeholder holidays
   and exam periods currently in `institutional_event`, which were guessed.
2. Student handbook — enrolment, registration, grading, campus rules.
3. Registrar procedures — the most-asked questions after "where is X".
4. Recent memoranda and announcements.

## Checking it worked

```
python machine-learning/document_knowledge_importer.py --path machine-learning/institutional-documents --origin real
```

The run prints documents and chunks ingested. Then ask the assistant something
only those documents could answer. If it still says it does not know, the
retrieval floor may be filtering weak matches — `RETRIEVAL_SIMILARITY_FLOOR`
in `backend/.env` is `0.25`.

Nothing in this folder is committed except this README.
