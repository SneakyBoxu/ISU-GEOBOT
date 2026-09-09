import React, { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle, CalendarDays, CheckCircle2, FileSpreadsheet, FileText, Loader2,
  Upload,
} from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';

/**
 * Upload a registrar workbook — a teaching timetable or an academic calendar.
 *
 * The kind is detected from the file's CONTENT, so there is one upload box
 * rather than two the operator has to choose between.
 *
 * TWO STEPS, DELIBERATELY. A mis-parse is silent: a merged cell read wrongly
 * turns a three-hour class into thirty minutes, and a lecturer whose name fails
 * to match simply vanishes and looks free all week. So the operator sees what
 * was found before anything is written, and Apply is refused unless the file
 * still matches the parse that was reviewed.
 */

const WORKBOOK_TYPES = ['.xlsx'];
const DOCUMENT_TYPES = ['.md', '.txt', '.pdf', '.docx'];
const ACCEPTED = [...WORKBOOK_TYPES, ...DOCUMENT_TYPES];

const isWorkbook = (name = '') =>
  WORKBOOK_TYPES.some((ext) => name.toLowerCase().endsWith(ext));

const SEMESTERS = [
  { id: 'first', label: 'First semester' },
  { id: 'second', label: 'Second semester' },
  { id: 'midyear', label: 'Midyear' },
];

export default function AdminScheduleUploadPanel({ session }) {
  const [file, setFile] = useState(null);
  const [b64, setB64] = useState('');
  const [semesterColumn, setSemesterColumn] = useState('first');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState(null);
  const inputRef = useRef(null);

  const reset = useCallback(() => {
    setPreview(null); setError(null); setApplied(null);
  }, []);

  const onPick = useCallback(async (event) => {
    const picked = event.target.files?.[0];
    reset();
    setFile(picked ?? null);
    setB64('');
    if (!picked) return;
    if (!ACCEPTED.some((ext) => picked.name.toLowerCase().endsWith(ext))) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED.join(', ')}`);
      return;
    }
    const bytes = new Uint8Array(await picked.arrayBuffer());
    let binary = '';
    const CHUNK = 0x8000;                 // btoa chokes on very large spreads
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    setB64(btoa(binary));
  }, [reset]);

  const runPreview = useCallback(async (column = semesterColumn) => {
    if (!b64) return;
    setBusy('preview'); setError(null); setApplied(null);
    try {
      // A workbook goes to the schedule/calendar parser; anything else is a
      // document for the retrieval corpus. The endpoint is chosen here so the
      // operator sees one upload box rather than three.
      setPreview(isWorkbook(file?.name)
        ? await api.schedulePreview(session.access_token, {
            filename: file?.name, contentB64: b64, semesterColumn: column,
          })
        : await api.documentPreview(session.access_token, {
            filename: file?.name, contentB64: b64,
          }));
    } catch (err) {
      setError(err?.message || 'Preview failed.');
      setPreview(null);
    } finally {
      setBusy('');
    }
  }, [b64, file, session, semesterColumn]);

  const pickSemester = useCallback((column) => {
    setSemesterColumn(column);
    if (preview?.kind === 'calendar') runPreview(column);
  }, [preview, runPreview]);

  const runApply = useCallback(async () => {
    if (!preview?.checksum) return;
    setBusy('apply'); setError(null);
    try {
      const result = preview.kind === 'document'
        ? await api.documentApply(session.access_token, {
            filename: file?.name, contentB64: b64,
            title: preview.title, docType: preview.doc_type,
            checksum: preview.checksum,
          })
        : await api.scheduleApply(session.access_token, {
            filename: file?.name, contentB64: b64,
            semester: preview.semester, semesterColumn,
            checksum: preview.checksum,
          });
      setApplied(result);
      setPreview(null);
    } catch (err) {
      setError(err?.message || 'Apply failed.');
    } finally {
      setBusy('');
    }
  }, [preview, b64, file, semesterColumn, session]);

  const stat = (label, value, tone = 'text-slate-200') => (
    <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  );

  const isCalendar = preview?.kind === 'calendar';
  const isDocument = preview?.kind === 'document';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
          Import institutional data
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          A <strong className="text-slate-300">teaching timetable</strong> or an{' '}
          <strong className="text-slate-300">academic calendar</strong> as .xlsx, or a{' '}
          <strong className="text-slate-300">document</strong> for the assistant's
          knowledge base as .pdf, .docx, .md or .txt. What the file is gets detected from
          its contents. Nothing is written until you review it and confirm.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input ref={inputRef} type="file" accept={ACCEPTED.join(',')}
                 onChange={onPick} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15
                             bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
            <Upload className="h-4 w-4" /> Choose file
          </button>
          {file && <span className="text-sm text-slate-400">{file.name}</span>}
          <button type="button" onClick={() => runPreview()} disabled={!b64 || busy === 'preview'}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2
                             text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/30
                             hover:bg-emerald-500/25 disabled:opacity-40">
            {busy === 'preview'
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</>
              : 'Preview'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm leading-relaxed text-red-200">{error}</p>
        </div>
      )}

      {applied && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="text-sm text-emerald-100">
            <p className="font-semibold">
              {applied.kind === 'calendar' ? 'Academic calendar applied.'
                : applied.kind === 'document' ? 'Document added to the knowledge base.'
                : 'Schedule applied.'}
            </p>
            <p className="mt-1 text-emerald-200/80">
              {applied.kind === 'document'
                ? `"${applied.title}" stored as ${applied.doc_type} in
                   ${applied.chunks_written} chunks. The corpus now holds
                   ${applied.corpus.documents} documents and ${applied.corpus.chunks} chunks.`
                : applied.kind === 'calendar'
                ? `Academic window ${applied.window.start} to ${applied.window.end};
                   ${applied.exam_days_written} examination days written,
                   ${applied.rows_removed} previous rows replaced.`
                : `${applied.blocks_written} blocks now stored for ${applied.semester};
                   ${applied.blocks_removed} replaced,
                   ${applied.faculty_inserted} new lecturer(s) added.`}
            </p>
          </div>
        </div>
      )}

      {preview && (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {isCalendar
                ? <><CalendarDays className="h-4 w-4 text-emerald-400" /> Academic calendar</>
                : isDocument
                  ? <><FileText className="h-4 w-4 text-emerald-400" /> Knowledge-base document</>
                  : <><FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Teaching timetable</>}
              <span className="font-normal normal-case text-slate-500">— nothing written yet</span>
            </h4>

            {isCalendar && (
              <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
                {SEMESTERS.filter((s) => preview.columns?.includes(s.id)).map((s) => (
                  <button key={s.id} type="button" onClick={() => pickSemester(s.id)}
                          disabled={busy === 'preview'}
                          className={`rounded px-3 py-1 text-xs font-medium transition ${
                            semesterColumn === s.id
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'text-slate-400 hover:text-slate-200'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isDocument ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stat('Chunks', preview.chunks)}
                {stat('Characters', preview.characters.toLocaleString())}
                {stat('Largest chunk', `${preview.max_tokens} tok`,
                  preview.max_tokens > preview.ceiling ? 'text-red-300' : 'text-slate-200')}
                {stat('Ceiling', `${preview.ceiling} tok`, 'text-slate-400')}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                <span className="text-slate-500">Stored as</span>{' '}
                <span className="text-slate-200">{preview.title}</span>{' '}
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                  {preview.doc_type}
                </span>
              </div>

              {preview.replaces?.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                    Replaces an existing document
                  </p>
                  {preview.replaces.map((r, i) => (
                    <p key={i} className="mt-1 text-sm text-amber-100/90">
                      {r.title} ({r.doc_type}), ingested{' '}
                      {r.ingested_at ? r.ingested_at.slice(0, 10) : 'unknown'}
                      {r.same_bytes && ' — identical file, re-ingesting changes nothing'}
                    </p>
                  ))}
                </div>
              )}

              {preview.preview?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    First {preview.preview.length} chunks as they will be embedded
                  </p>
                  {preview.preview.map((c) => (
                    <div key={c.index}
                         className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="mb-1 text-[11px] text-slate-500">
                        chunk {c.index} · {c.tokens} tokens
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">{c.text}…</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : isCalendar ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stat('Window start', preview.window.start ?? '—')}
                {stat('Window end', preview.window.end ?? '—')}
                {stat('Exam days', preview.exam_days)}
                {stat('Rows recognised', preview.entries_recognised, 'text-slate-400')}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {stat('Exam days added', `+${preview.diff.added.length}`,
                  preview.diff.added.length ? 'text-emerald-300' : 'text-slate-400')}
                {stat('Removed', `−${preview.diff.removed.length}`,
                  preview.diff.removed.length ? 'text-amber-300' : 'text-slate-400')}
                {stat('Unchanged', preview.diff.unchanged, 'text-slate-400')}
              </div>

              {preview.stored_window?.start && (
                <p className="text-xs text-slate-500">
                  Currently stored: {preview.stored_window.start} to {preview.stored_window.end}
                  {preview.stored_window.start === preview.window.start
                    && preview.stored_window.end === preview.window.end
                    && ' — identical to this workbook.'}
                </p>
              )}

              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Examination</th>
                      <th className="px-3 py-2 font-medium">From</th>
                      <th className="px-3 py-2 font-medium">To</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {preview.exams.map((e, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="px-3 py-1.5">{e.particular}</td>
                        <td className="px-3 py-1.5">{e.start}</td>
                        <td className="px-3 py-1.5">{e.end}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stat('Lecturers', preview.parsed.lecturers)}
                {stat('Blocks', preview.parsed.blocks)}
                {stat('Echague', preview.parsed.echague)}
                {stat('Santiago', preview.parsed.santiago)}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {stat('Added', `+${preview.diff.added}`,
                  preview.diff.added ? 'text-emerald-300' : 'text-slate-400')}
                {stat('Removed', `−${preview.diff.removed}`,
                  preview.diff.removed ? 'text-amber-300' : 'text-slate-400')}
                {stat('Unchanged', preview.diff.unchanged, 'text-slate-400')}
              </div>

              {preview.new_lecturers?.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                    New lecturers that will be created
                  </p>
                  <p className="mt-1 text-sm text-amber-100/90">
                    {preview.new_lecturers.join(' · ')}
                  </p>
                </div>
              )}

              {preview.sample?.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Lecturer</th>
                        <th className="px-3 py-2 font-medium">Day</th>
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium">Course</th>
                        <th className="px-3 py-2 font-medium">Room</th>
                        <th className="px-3 py-2 font-medium">Campus</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {preview.sample.map((row, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="px-3 py-1.5">{row.faculty}</td>
                          <td className="px-3 py-1.5">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][row.day_of_week]}
                          </td>
                          <td className="px-3 py-1.5">{row.start}–{row.end}</td>
                          <td className="px-3 py-1.5">{row.course}</td>
                          <td className="px-3 py-1.5">{row.room}</td>
                          <td className="px-3 py-1.5">{row.campus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="border-t border-white/5 px-3 py-2 text-[11px] text-slate-500">
                    First {preview.sample.length} of {preview.parsed.blocks} blocks.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-3 border-t border-white/10 pt-4">
            <button type="button" onClick={runApply} disabled={busy === 'apply'}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2
                               text-sm font-semibold text-slate-900 hover:bg-emerald-400
                               disabled:opacity-40">
              {busy === 'apply'
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing…</>
                : isCalendar
                  ? 'Replace the academic calendar'
                  : isDocument
                    ? 'Add to the knowledge base'
                    : `Replace the ${preview.semester} schedule`}
            </button>
            <button type="button" onClick={reset}
                    className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300
                               hover:bg-white/5">
              Cancel
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            {isDocument
              ? `The document is chunked with the same rule the batch importer uses and
                 embedded with the same model retrieval uses. A document with the same
                 title is replaced rather than duplicated. The file itself is not stored —
                 only the text, and a checksum of the bytes it came from.`
              : isCalendar
              ? `Applying replaces the academic window markers and every examination day.
                 National holidays are left untouched — they are not this document's to
                 declare. The class schedule is unaffected.`
              : `Applying replaces every real block for ${preview.semester}. Lecturers are
                 matched by name and reused, so their records and history are preserved.
                 The synthetic cohort, attendance and documents are untouched.`}
          </p>
        </div>
      )}
    </div>
  );
}
