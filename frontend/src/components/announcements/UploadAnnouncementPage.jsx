import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  AlertCircle, CalendarClock, Camera, CheckCircle2, ChevronDown, Crop,
  FileText, History, Loader2, LogOut, RefreshCw, RotateCcw, Save,
  Trash2, Upload, UserCheck, Users, X,
} from 'lucide-react';
import { currentSession, signOut } from '../../frontend-utilities/supabaseClient.js';
import { api } from '../../frontend-utilities/backendApiClient.js';
import PortalLogin from '../shared-components/UserRoleLoginModal.jsx';
import TopNavigationBar from '../shared-components/TopNavigationBar.jsx';
import DemoModeNotificationBanner from '../shared-components/DemoModeNotificationBanner.jsx';

const SCOPE_TYPES = [
  { value: 'campus', label: 'Entire campus' },
  { value: 'department', label: 'Department' },
  { value: 'named_faculty', label: 'Named faculty' },
  { value: 'all_faculty', label: 'All faculty' },
];

const REASON_CODES = [
  { value: 'institutional_event', label: 'Institutional event' },
  { value: 'official_business', label: 'Official business' },
  { value: 'official_meeting', label: 'Official meeting' },
  { value: 'training', label: 'Official training' },
  { value: 'approved_leave', label: 'Approved leave' },
  { value: 'institutional_closure', label: 'Institutional closure' },
  { value: 'schedule_suspension', label: 'Schedule suspension' },
  { value: 'emergency', label: 'Emergency announcement' },
  { value: 'other_official_announcement', label: 'Other official announcement' },
];

const SAFE_REASON_BY_CODE = {
  institutional_event: 'Unavailable due to an institutional event.',
  official_business: 'Unavailable due to official university duties.',
  official_meeting: 'Unavailable due to an official meeting.',
  training: 'Unavailable due to an official training activity.',
  approved_leave: 'Unavailable due to approved leave.',
  institutional_closure: 'Unavailable due to an institutional closure.',
  schedule_suspension: 'Availability is affected by an official schedule suspension.',
  emergency: 'Availability is affected by an emergency announcement.',
  other_official_announcement: 'Availability is affected by an official announcement.',
};

const inputCls =
  'w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-body text-fg placeholder-fg-muted ' +
  'transition-colors focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20';
const selectCls =
  'w-full appearance-none rounded-xl border border-line bg-bg px-3.5 py-2.5 pr-9 text-body text-fg ' +
  'transition-colors focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20';
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 30;
const PDF_TYPE = 'application/pdf';
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataURLToBlob(dataURL) {
  const [header, data] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function sourceKind(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === PDF_TYPE || name.endsWith('.pdf')) return 'pdf';
  if (file.type === DOCX_TYPE || name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.doc')) return 'doc';
  return null;
}

async function extractPdfText(file, onProgress = () => {}) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url,
  ).toString();
  const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  if (pdfDocument.numPages > MAX_PDF_PAGES) {
    throw new Error(`PDFs are limited to ${MAX_PDF_PAGES} pages.`);
  }
  const pages = [];
  let worker;
  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      let line = '';
      let previousY = null;
      const lines = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform?.[5] ?? previousY;
        if (previousY !== null && Math.abs(y - previousY) > 2 && line.trim()) {
          lines.push(line.trim());
          line = '';
        }
        line += `${item.str} `;
        previousY = y;
      }
      if (line.trim()) lines.push(line.trim());
      let pageText = lines.join('\n').trim();
      if (!pageText) {
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        if (!worker) {
          const { createWorker } = await import('tesseract.js');
          worker = await createWorker('eng');
        }
        const result = await worker.recognize(canvas);
        pageText = result.data.text.trim();
      }
      pages.push(pageText);
      onProgress(Math.round(pageNumber / pdfDocument.numPages * 100));
    }
  } finally {
    await worker?.terminate();
  }
  return pages.join('\n\n').trim();
}

async function extractDocxText(file) {
  const mammoth = await import('mammoth/mammoth.browser');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value.trim();
}

function cleanText(value, maxLength = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanList(value) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(/[,;\n]/);
  return values.map((item) => cleanText(item, 160)).filter(Boolean);
}

function campusLocalValue(value, dateOnly = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  return dateOnly ? day : `${day}T${part('hour')}:${part('minute')}`;
}

function blankEvent(index = 0) {
  return {
    clientId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    id: '',
    documentType: 'official announcement',
    startDatetime: '',
    endDatetime: '',
    allDay: false,
    scopeType: 'campus',
    campus: '',
    departmentCode: '',
    reasonCode: 'other_official_announcement',
    safeReason: SAFE_REASON_BY_CODE.other_official_announcement,
    mandatory: false,
    namedFacultyNames: [],
    namedFacultyInput: '',
    facultySelections: [],
    resolvedFaculty: [],
    warnings: [],
  };
}

function normalizeResolvedFaculty(value) {
  if (!Array.isArray(value)) return [];
  return value.map((faculty) => {
    if (typeof faculty === 'string') return { name: cleanText(faculty, 160), facultyId: '', matched: true };
    return {
      name: cleanText(faculty.name ?? faculty.fullName ?? faculty.full_name, 160),
      facultyId: cleanText(faculty.facultyId ?? faculty.faculty_id ?? faculty.id, 100),
      matched: faculty.matched !== false && faculty.resolved !== false,
    };
  }).filter((faculty) => faculty.name);
}

function facultyFromResolution(resolution) {
  const matched = normalizeResolvedFaculty(resolution?.faculty);
  const unresolved = cleanList(resolution?.unresolvedFacultyNames).map((name) => ({
    name, facultyId: '', matched: false,
  }));
  const ambiguous = (Array.isArray(resolution?.ambiguousFacultyNames)
    ? resolution.ambiguousFacultyNames : []).map((item) => ({
    name: cleanText(item?.name, 160), facultyId: '', matched: false,
  })).filter((faculty) => faculty.name);
  return [...matched, ...unresolved, ...ambiguous];
}

function normalizeExtractedEvent(event, index) {
  const normalized = blankEvent(index);
  const allDay = event.allDay === true || event.all_day === true;
  const namedFacultyNames = cleanList(
    event.namedFacultyNames ?? event.named_faculty_names ?? event.facultyNames ?? event.faculty_names,
  );
  return {
    ...normalized,
    id: cleanText(event.id, 100),
    documentType: cleanText(event.documentType ?? event.document_type, 80) || normalized.documentType,
    startDatetime: allDay
      ? campusLocalValue(event.startsAt ?? event.starts_at, true)
      : campusLocalValue(event.startsAt ?? event.starts_at),
    endDatetime: allDay
      ? campusLocalValue(event.endsAt ?? event.ends_at, true)
      : campusLocalValue(event.endsAt ?? event.ends_at),
    allDay,
    scopeType: cleanText(event.scopeType ?? event.scope_type, 40) || 'campus',
    campus: cleanText(event.campus ?? event.campusName ?? event.campus_name, 160),
    departmentCode: cleanText(event.departmentCode ?? event.department_code, 40),
    reasonCode: cleanText(event.reasonCode ?? event.reason_code, 80) || normalized.reasonCode,
    safeReason: SAFE_REASON_BY_CODE[event.reasonCode ?? event.reason_code]
      ?? SAFE_REASON_BY_CODE.other_official_announcement,
    mandatory: Boolean(event.mandatory ?? event.isMandatory ?? event.is_mandatory),
    namedFacultyNames,
    namedFacultyInput: namedFacultyNames.join(', '),
    facultySelections: [],
    resolvedFaculty: event.resolution
      ? facultyFromResolution(event.resolution)
      : normalizeResolvedFaculty(event.resolvedFaculty ?? event.resolved_faculty),
    warnings: cleanList(event.warnings ?? event.warning),
  };
}

function extractionEvents(response) {
  const candidates = response?.events
    ?? response?.drafts
    ?? response?.extractedEvents
    ?? response?.extraction?.events
    ?? response?.data?.events
    ?? response?.availabilityEvents
    ?? response?.availability_events
    ?? (response?.event ? [response.event] : []);
  return (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean).map(normalizeExtractedEvent);
}

function normalizePublishedEvent(event, index) {
  return {
    id: cleanText(event.id ?? event.eventId ?? event.event_id, 100) || `event-${index}`,
    startDatetime: cleanText(event.startDatetime ?? event.start_datetime ?? event.startsAt ?? event.starts_at, 64),
    endDatetime: cleanText(event.endDatetime ?? event.end_datetime ?? event.endsAt ?? event.ends_at, 64),
    scopeType: cleanText(event.scopeType ?? event.scope_type, 40),
    campus: cleanText(event.campus ?? event.campusName ?? event.campus_name, 160),
    departmentCode: cleanText(event.departmentCode ?? event.department_code, 40),
    reasonCode: cleanText(event.reasonCode ?? event.reason_code, 80),
    safeReason: cleanText(event.safeReason ?? event.safe_reason, 500),
    mandatory: Boolean(event.mandatory ?? event.isMandatory ?? event.is_mandatory),
    namedFacultyNames: cleanList(
      event.namedFacultyNames ?? event.named_faculty_names ?? event.facultyNames ?? event.faculty_names,
    ),
    publishedAt: cleanText(event.publishedAt ?? event.published_at ?? event.createdAt ?? event.created_at, 64),
  };
}

function publishedEvents(response) {
  const candidates = response?.events
    ?? response?.items
    ?? response?.publishedEvents
    ?? response?.availabilityEvents
    ?? response?.availability_events
    ?? response?.data
    ?? [];
  return (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean).map(normalizePublishedEvent);
}

function eventErrors(event) {
  const errors = [];
  if (!event.startDatetime) errors.push('Start date and time are required.');
  if (!event.endDatetime) errors.push('End date and time are required.');
  if (event.startDatetime && event.endDatetime && event.endDatetime <= event.startDatetime) {
    errors.push('End must be after start.');
  }
  if (!event.id) errors.push('This event is not part of the signed extraction preview.');
  if (event.scopeType === 'campus' && !event.campus) errors.push('Campus is required for campus scope.');
  if (event.scopeType === 'department' && !event.departmentCode) {
    errors.push('Department code is required for department scope.');
  }
  if (event.scopeType === 'named_faculty' && event.namedFacultyNames.length === 0) {
    errors.push('Enter at least one faculty name for named faculty scope.');
  }
  const hasUnresolved = event.resolvedFaculty.some((faculty) => !faculty.matched);
  if (event.scopeType === 'named_faculty' && (hasUnresolved || event.resolvedFaculty.length === 0)) {
    errors.push('Every named faculty member must match the official roster.');
  }
  if (!event.mandatory) errors.push('Only mandatory commitments can be published as availability overrides.');
  return errors;
}

function eventForPublish(event) {
  // This deployment's institutional calendar is Asia/Manila. The backend
  // rejects timezone-free timestamps so browser locale cannot shift events.
  const zoned = (value) => event.allDay || !value ? value : `${value}:00+08:00`;
  return {
    id: event.id,
    documentType: event.documentType,
    startsAt: zoned(event.startDatetime),
    endsAt: zoned(event.endDatetime),
    allDay: event.allDay,
    scopeType: event.scopeType,
    campus: event.campus.trim(),
    departmentCode: event.departmentCode.trim() || null,
    reasonCode: event.reasonCode,
    mandatory: event.mandatory,
    facultyNames: event.namedFacultyNames,
    facultySelections: event.facultySelections,
  };
}

function displayDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return cleanText(value, 64) || 'Not specified';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function Field({ label, required, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-label font-medium text-fg-muted">
      <span>{label}{required && <span className="ml-1 text-red-400">*</span>}</span>
      {children}
    </label>
  );
}

function SelectField({ value, onChange, children, ...props }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange} className={selectCls} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  );
}

function CropModal({ imageSrc, onDone, onCancel }) {
  const imgRef = useRef(null);
  const [crop, setCrop] = useState();

  /**
   * PERCENT, NOT PIXELS.
   *
   * `onLoad` can fire before the browser has applied the CSS size constraints,
   * so `event.currentTarget.width` is often still the NATURAL width — 1160 px
   * for a scanned A4 page — while the element will actually render at about
   * 400 px. A pixel crop built from that number is nearly three times the size
   * of the displayed image, so the selection overflows the scroll container
   * and only the part of the page that happens to be on screen can be reached.
   * That is why a full-page document came out cropped.
   *
   * A percentage crop is resolution-independent: 100% is the whole page
   * whatever size it is eventually laid out at.
   */
  const selectWholePage = useCallback(() => {
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  }, []);

  const handleImageLoad = useCallback(() => {
    selectWholePage();
  }, [selectWholePage]);

  const handleCrop = useCallback(() => {
    const image = imgRef.current;
    if (!image || !crop?.width || !crop?.height) return;

    // Normalise to displayed pixels first: the crop may be in either unit.
    const box = crop.unit === '%'
      ? {
        x: (crop.x / 100) * image.width,
        y: (crop.y / 100) * image.height,
        width: (crop.width / 100) * image.width,
        height: (crop.height / 100) * image.height,
      }
      : crop;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const sourceWidth = box.width * scaleX;
    const sourceHeight = box.height * scaleY;
    const outputScale = Math.min(1, 2400 / sourceWidth, 2400 / sourceHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
    canvas.height = Math.max(1, Math.round(sourceHeight * outputScale));
    canvas.getContext('2d').drawImage(
      image, box.x * scaleX, box.y * scaleY, sourceWidth, sourceHeight,
      0, 0, canvas.width, canvas.height,
    );
    onDone(canvas.toDataURL('image/jpeg', 0.92));
  }, [crop, onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-fg"><Crop className="h-4 w-4 text-accent" /><span className="font-semibold">Crop image</span></div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-fg-muted hover:bg-bg-sunken hover:text-fg" aria-label="Close crop dialog"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex h-[56vh] min-h-64 items-center justify-center overflow-hidden rounded-lg bg-bg-sunken p-3 sm:h-[58vh]">
          {/*
            The height cap goes on the WRAPPER, not the image. react-image-crop
            ships `.ReactCrop__child-wrapper > img { max-height: inherit }`,
            which at specificity (0,2,1) beats any single utility class on the
            img itself — so a max-height set there is silently discarded and the
            page renders at natural size. Capping the wrapper makes `inherit`
            resolve to the value we actually want.
          */}
          <ReactCrop
            crop={crop}
            onChange={(pixelCrop) => setCrop(pixelCrop)}
            className="max-h-[52vh]"
          >
            <img ref={imgRef} src={imageSrc} alt="Crop preview" onLoad={handleImageLoad} className="block w-auto object-contain" />
          </ReactCrop>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-label text-fg-muted hover:bg-bg-sunken">Cancel</button>
          <button type="button" onClick={selectWholePage} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-label text-fg-muted hover:bg-bg-sunken">Select whole page</button>
          <button type="button" onClick={handleCrop} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-label font-medium text-white hover:opacity-90"><Crop className="h-4 w-4" />Apply crop</button>
        </div>
      </div>
    </div>
  );
}

function CameraModal({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      })
      .catch((err) => setError(err.message || 'Camera unavailable'));
    return () => { streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg', 0.9));
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [onCapture]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-fg"><Camera className="h-4 w-4 text-accent" /><span className="font-semibold">Take photo</span></div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-fg-muted hover:bg-bg-sunken" aria-label="Close camera"><X className="h-4 w-4" /></button>
        </div>
        {error && <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-label text-red-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        <div className="overflow-hidden rounded-xl bg-black"><video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" /></div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-label text-fg-muted hover:bg-bg-sunken">Cancel</button>
          <button type="button" onClick={selectWholePage} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-label text-fg-muted hover:bg-bg-sunken">Select whole page</button>
          <button type="button" onClick={capture} disabled={!ready || !!error} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-label font-medium text-white disabled:opacity-50"><Camera className="h-4 w-4" />Capture</button>
        </div>
      </div>
    </div>
  );
}

function EventEditor({
  event, index, onChange, onRemove, onResolve, onFindCandidates, onSelectFaculty, onRemoveFaculty,
  resolving, removable,
}) {
  const errors = eventErrors(event);
  const set = (key, value) => onChange({ ...event, [key]: value });
  const [picker, setPicker] = useState(null);
  const openPicker = async (sourceName = '') => {
    const query = sourceName;
    setPicker({ sourceName, query, candidates: [], loading: true, error: null });
    try {
      const candidates = await onFindCandidates(query);
      setPicker((current) => current ? { ...current, candidates, loading: false } : null);
    } catch (err) {
      setPicker((current) => current ? {
        ...current, loading: false, error: err.message ?? 'Could not search the roster.',
      } : null);
    }
  };
  const searchPicker = async () => {
    if (!picker?.query.trim()) return;
    setPicker((current) => ({ ...current, loading: true, error: null }));
    try {
      const candidates = await onFindCandidates(picker.query);
      setPicker((current) => current ? { ...current, candidates, loading: false } : null);
    } catch (err) {
      setPicker((current) => current ? {
        ...current, loading: false, error: err.message ?? 'Could not search the roster.',
      } : null);
    }
  };

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-meta font-medium uppercase tracking-wider text-accent">Extracted event {index + 1}</p>
          <h3 className="mt-1 font-serif text-h4 text-fg">Review availability window</h3>
        </div>
        {removable && <button type="button" onClick={onRemove} className="rounded-lg p-2 text-fg-muted hover:bg-red-500/10 hover:text-red-400" aria-label={`Remove event ${index + 1}`}><Trash2 className="h-4 w-4" /></button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Document type" required><input type="text" value={event.documentType} onChange={(e) => set('documentType', e.target.value)} className={inputCls} required /></Field>
        <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-line bg-bg-sunken px-3.5 py-3 text-label text-fg">
          <input type="checkbox" checked={event.allDay} onChange={(e) => set('allDay', e.target.checked)} className="h-4 w-4 rounded border-line text-accent focus:ring-accent" />
          <span className="font-medium">All-day event</span>
        </label>
        <Field label={event.allDay ? 'Start date' : 'Start date and time'} required><input type={event.allDay ? 'date' : 'datetime-local'} value={event.startDatetime} onChange={(e) => set('startDatetime', e.target.value)} className={inputCls} required /></Field>
        <Field label={event.allDay ? 'End date (exclusive)' : 'End date and time'} required><input type={event.allDay ? 'date' : 'datetime-local'} value={event.endDatetime} onChange={(e) => set('endDatetime', e.target.value)} className={inputCls} required /></Field>
        <Field label="Scope type" required>
          <SelectField value={event.scopeType} onChange={(e) => set('scopeType', e.target.value)}>
            {!SCOPE_TYPES.some((scope) => scope.value === event.scopeType) && <option value={event.scopeType}>{event.scopeType}</option>}
            {SCOPE_TYPES.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
          </SelectField>
        </Field>
        <Field label="Campus" required={event.scopeType === 'campus'}><input type="text" value={event.campus} onChange={(e) => set('campus', e.target.value)} placeholder="e.g. echague" className={inputCls} required={event.scopeType === 'campus'} /></Field>
        <Field label="Department code" required={event.scopeType === 'department'}><input type="text" value={event.departmentCode} onChange={(e) => set('departmentCode', e.target.value.toUpperCase())} placeholder="e.g. CCSICT" className={inputCls} required={event.scopeType === 'department'} /></Field>
        <Field label="Reason code" required>
          <SelectField value={event.reasonCode} onChange={(e) => onChange({ ...event, reasonCode: e.target.value, safeReason: SAFE_REASON_BY_CODE[e.target.value] })}>
            {!REASON_CODES.some((reason) => reason.value === event.reasonCode) && <option value={event.reasonCode}>{event.reasonCode}</option>}
            {REASON_CODES.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
          </SelectField>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Privacy-safe reason"><textarea rows={2} value={event.safeReason} readOnly className={`${inputCls} resize-none opacity-80`} /></Field>
      </div>

      <div className="mt-4">
        <Field label="Names from document">
          <textarea
            rows={2}
            value={event.namedFacultyInput}
            onChange={(e) => {
              const raw = e.target.value;
              const list = cleanList(raw);
              onChange({
                ...event,
                namedFacultyInput: raw,
                namedFacultyNames: list,
              });
            }}
            placeholder="Comma-separated names from document"
            className={`${inputCls} resize-y`}
          />
        </Field>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-bg-sunken px-3.5 py-3 text-label text-fg">
        <input type="checkbox" checked={event.mandatory} onChange={(e) => set('mandatory', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line text-accent focus:ring-accent" />
        <span><span className="font-medium">Mandatory event</span><span className="mt-0.5 block text-meta text-fg-muted">Marks an authoritative availability override for the selected scope and time.</span></span>
      </label>

      {(event.resolvedFaculty.length > 0 || event.namedFacultyNames.length > 0) && (
        <div className="mt-4 rounded-xl border border-line bg-bg-sunken p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-label font-semibold text-fg"><UserCheck className="h-4 w-4 text-accent" />Faculty resolution preview</p>
            {(() => {
              const matchedCount = event.resolvedFaculty.filter((f) => f.matched).length;
              const unresolvedCount = event.resolvedFaculty.filter((f) => !f.matched).length;
              const hasUnresolved = unresolvedCount > 0;
              return (
                <span className={`rounded-full border px-2.5 py-1 text-meta font-medium ${
                  hasUnresolved
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-brand-500/30 bg-brand-500/10 text-brand-300'
                }`}>
                  {hasUnresolved
                    ? `${matchedCount} of ${matchedCount + unresolvedCount} matched`
                    : `${matchedCount} matched`}
                </span>
              );
            })()}
          </div>
          {event.resolvedFaculty.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {event.resolvedFaculty.map((faculty, facultyIndex) => faculty.matched ? (
                <span key={`${faculty.facultyId}-${faculty.name}-${facultyIndex}`} className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 py-1 pl-2.5 pr-1.5 text-meta text-brand-300">
                  <span>{faculty.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveFaculty(faculty.name, faculty.facultyId)}
                    className="rounded-full p-0.5 text-brand-400/80 hover:bg-brand-500/20 hover:text-brand-100"
                    aria-label={`Unlist ${faculty.name}`}
                    title="Unlist this person"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <span key={`${faculty.name}-${facultyIndex}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 py-1 pl-2.5 pr-1.5 text-meta text-amber-300">
                  <button
                    type="button"
                    onClick={() => openPicker(faculty.name)}
                    className="hover:underline text-left"
                  >
                    {faculty.name} - choose roster match
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveFaculty(faculty.name, '')}
                    className="rounded-full p-0.5 text-amber-400/80 hover:bg-amber-500/20 hover:text-amber-100"
                    aria-label={`Unlist ${faculty.name}`}
                    title="Unlist this person (e.g. student or invalid entry)"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : <p className="mt-2 text-meta text-amber-300">No current faculty matches. Review the names or re-extract.</p>}
          <div className="mt-3 flex flex-col items-start justify-between gap-2 border-t border-line pt-3 sm:flex-row sm:items-center">
            <p className="text-meta text-fg-muted">Choose an unresolved name to link it to the official roster, or unlist non-faculty.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openPicker('')} className="flex shrink-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-meta font-medium text-fg hover:bg-bg">
                <UserCheck className="h-3.5 w-3.5" />Add from roster
              </button>
              <button type="button" onClick={onResolve} disabled={resolving || event.namedFacultyNames.length === 0} className="flex shrink-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-meta font-medium text-fg hover:bg-bg disabled:opacity-50">
                {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {resolving ? 'Matching...' : 'Refresh matches'}
              </button>
            </div>
          </div>
          {picker && (
            <div className="mt-3 rounded-xl border border-line bg-bg p-3">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-label font-medium text-fg">{picker.sourceName ? `Match ${picker.sourceName}` : 'Add official faculty'}</p><p className="text-meta text-fg-muted">Select one official roster record.</p></div>
                <button type="button" onClick={() => setPicker(null)} className="rounded-md p-1 text-fg-muted hover:bg-bg-sunken" aria-label="Close roster picker"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex gap-2">
                <input type="search" value={picker.query} onChange={(e) => setPicker((current) => ({ ...current, query: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchPicker(); } }} placeholder="Search official roster" className={inputCls} />
                <button type="button" onClick={searchPicker} disabled={picker.loading || picker.query.trim().length < 2} className="rounded-xl border border-line px-3 text-label text-fg disabled:opacity-50">Search</button>
              </div>
              {picker.error && <p className="mt-2 text-meta text-red-400">{picker.error}</p>}
              {picker.loading ? <p className="mt-3 flex items-center gap-2 text-meta text-fg-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" />Searching roster...</p> : (
                <div className="mt-3 grid gap-2">
                  {picker.candidates.map((candidate) => (
                    <button type="button" key={candidate.id} onClick={async () => { await onSelectFaculty(picker.sourceName, candidate); setPicker(null); }} className="rounded-lg border border-line px-3 py-2 text-left hover:border-accent/40 hover:bg-accent/5">
                      <span className="block text-label font-medium text-fg">{candidate.name}</span>
                      {candidate.department && <span className="block text-meta text-fg-muted">{candidate.department}</span>}
                    </button>
                  ))}
                  {picker.query.trim().length >= 2 && picker.candidates.length === 0 && <p className="text-meta text-fg-muted">No official roster candidates found.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {event.warnings.length > 0 && (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-meta text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{event.warnings.map((warning, warningIndex) => <p key={`${warning}-${warningIndex}`}>{warning}</p>)}</div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-4 flex gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-meta text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{errors.join(' ')}</p>
        </div>
      )}
    </article>
  );
}

function PublishedEventCard({ event, withdrawing, onWithdraw }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-meta font-medium text-brand-300">Published</span>
            {event.mandatory && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-meta font-medium text-amber-300">Mandatory</span>}
            <span className="text-meta uppercase tracking-wider text-fg-subtle">{event.scopeType || 'Unspecified scope'}</span>
          </div>
          <h3 className="mt-3 font-serif text-h4 text-fg">{event.safeReason || 'Availability event'}</h3>
          <p className="mt-2 text-label text-fg-muted">{displayDateTime(event.startDatetime)} to {displayDateTime(event.endDatetime)}</p>
        </div>
        <button type="button" onClick={onWithdraw} disabled={withdrawing} className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/30 px-3.5 py-2 text-label font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50">
          {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}Withdraw
        </button>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-line pt-4 text-label sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-fg-subtle">Campus</dt><dd className="mt-0.5 text-fg">{event.campus || 'Not specified'}</dd></div>
        <div><dt className="text-fg-subtle">Department</dt><dd className="mt-0.5 text-fg">{event.departmentCode || 'All / not specified'}</dd></div>
        <div><dt className="text-fg-subtle">Reason code</dt><dd className="mt-0.5 text-fg">{event.reasonCode || 'Not specified'}</dd></div>
        {event.namedFacultyNames.length > 0 && <div className="sm:col-span-2"><dt className="text-fg-subtle">Named faculty</dt><dd className="mt-0.5 text-fg">{event.namedFacultyNames.join(', ')}</dd></div>}
        {event.publishedAt && <div><dt className="text-fg-subtle">Published</dt><dd className="mt-0.5 text-fg">{displayDateTime(event.publishedAt)}</dd></div>}
      </dl>
    </article>
  );
}

export default function UploadAnnouncementPage() {
  const [session, setSession] = useState(undefined);
  const [view, setView] = useState('ingest');
  const [imageDataURL, setImageDataURL] = useState(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceError, setSourceError] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrState, setOcrState] = useState('idle');
  const [ocrText, setOcrText] = useState('');
  const [extractState, setExtractState] = useState('idle');
  const [extractError, setExtractError] = useState(null);
  const [extractRetrySeconds, setExtractRetrySeconds] = useState(0);
  const [events, setEvents] = useState([]);
  const [resolvingEventId, setResolvingEventId] = useState(null);
  const [reviewToken, setReviewToken] = useState('');
  const [ocrChecksum, setOcrChecksum] = useState('');
  const [publishState, setPublishState] = useState('idle');
  const [publishError, setPublishError] = useState(null);
  const [published, setPublished] = useState([]);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedError, setPublishedError] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);

  useEffect(() => { currentSession().then((current) => setSession(current ?? null)); }, []);

  const loadPublished = useCallback(async () => {
    if (!session?.access_token) return;
    setPublishedLoading(true);
    setPublishedError(null);
    try {
      setPublished(publishedEvents(await api.availabilityEvents(session.access_token)));
    } catch (err) {
      setPublishedError(err.message ?? 'Could not load published events.');
    } finally {
      setPublishedLoading(false);
    }
  }, [session]);

  useEffect(() => { loadPublished(); }, [loadPublished]);

  useEffect(() => {
    if (extractRetrySeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setExtractRetrySeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [extractRetrySeconds > 0]);

  const clearExtraction = useCallback(() => {
    setExtractState('idle');
    setExtractError(null);
    setExtractRetrySeconds(0);
    setEvents([]);
    setReviewToken('');
    setOcrChecksum('');
    setPublishState('idle');
    setPublishError(null);
  }, []);

  const resetAll = useCallback(() => {
    setImageDataURL(null);
    setSourceFile(null);
    setSourceError(null);
    setCropSrc(null);
    setOcrState('idle');
    setOcrText('');
    clearExtraction();
  }, [clearExtraction]);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    resetAll();
    if (file.size > MAX_SOURCE_BYTES) {
      setSourceError('The source file must be 20 MB or smaller.');
      return;
    }
    const kind = sourceKind(file);
    if (!kind) {
      setSourceError('Use a JPG, PNG, WebP, PDF, or DOCX file.');
      return;
    }
    if (kind === 'doc') {
      setSourceError('Legacy .doc files are not supported. Save the file as .docx and upload it again.');
      return;
    }
    if (kind === 'image') {
      // The whole page, unmodified. Cropping is available afterwards for the
      // cases that need it (a photo with desk around it, several notices on
      // one sheet) but it is no longer required to get a document in.
      const dataURL = await readFileAsDataURL(file);
      setImageDataURL(dataURL);
      setSourceFile({ name: file.name, kind, size: file.size });
      setOcrState('idle');
      setOcrText('');
      clearExtraction();
      return;
    }

    setSourceFile({ name: file.name, kind, size: file.size });
    setOcrState('running');
    setOcrProgress(0);
    try {
      const text = kind === 'pdf'
        ? await extractPdfText(file, setOcrProgress)
        : await extractDocxText(file);
      if (kind === 'docx') setOcrProgress(100);
      if (!text) throw new Error(
        kind === 'pdf'
          ? 'No selectable text was found in this PDF. Export it with OCR or upload its pages as images.'
          : 'No readable text was found in this Word file.',
      );
      setOcrText(text);
      setOcrState('done');
    } catch (err) {
      console.error('Document text extraction failed:', err);
      setOcrState('error');
      setSourceError(err.message ?? 'Could not read this document.');
    }
  }, [resetAll, clearExtraction]);

  const handleCropDone = useCallback((croppedDataURL) => {
    setImageDataURL(croppedDataURL);
    setSourceFile({ name: 'Image source', kind: 'image', size: dataURLToBlob(croppedDataURL).size });
    setCropSrc(null);
    setOcrState('idle');
    setOcrText('');
    clearExtraction();
  }, [clearExtraction]);

  const runOCR = useCallback(async () => {
    if (!imageDataURL) return;
    setOcrState('running');
    setOcrProgress(0);
    setOcrText('');
    clearExtraction();
    let worker;
    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('eng', 1, {
        logger: (message) => {
          if (message.status === 'recognizing text') setOcrProgress(Math.round(message.progress * 100));
        },
      });
      const { data: { text } } = await worker.recognize(dataURLToBlob(imageDataURL));
      setOcrText(text.trim());
      setOcrState('done');
    } catch (err) {
      console.error('OCR failed:', err);
      setOcrState('error');
    } finally {
      await worker?.terminate();
    }
  }, [clearExtraction, imageDataURL]);

  const extractFields = useCallback(async () => {
    if (!ocrText.trim() || !session?.access_token) return;
    setExtractState('running');
    setExtractError(null);
    setExtractRetrySeconds(0);
    setPublishState('idle');
    try {
      const response = await api.availabilityEventExtract(session.access_token, ocrText);
      const extracted = extractionEvents(response);
      if (extracted.length === 0) throw new Error('No availability events were found. Review the OCR text and try again.');
      setEvents(extracted);
      setReviewToken(response.reviewToken ?? '');
      setOcrChecksum(response.ocrChecksum ?? '');
      setExtractState('done');
    } catch (err) {
      setExtractState('error');
      setExtractRetrySeconds(err.status === 429 ? Math.ceil(err.retryAfterSeconds ?? 10) : 0);
      setExtractError(err.message ?? 'Extraction failed. Try again after reviewing the OCR text.');
    }
  }, [ocrText, session]);

  const handlePublish = useCallback(async () => {
    if (!session?.access_token || events.length === 0) return;
    const invalid = events.some((event) => eventErrors(event).length > 0);
    if (invalid) {
      setPublishError('Resolve the validation messages on every event before publishing.');
      return;
    }
    setPublishState('publishing');
    setPublishError(null);
    try {
      await api.availabilityEventPublish(session.access_token, {
        reviewToken,
        ocrChecksum,
        events: events.map(eventForPublish),
      });
      setPublishState('done');
      await loadPublished();
    } catch (err) {
      setPublishState('error');
      setPublishError(err.message ?? 'Could not publish availability events.');
    }
  }, [events, loadPublished, ocrChecksum, reviewToken, session]);

  const resolveEvent = useCallback(async (event) => {
    if (!session?.access_token) return;
    setResolvingEventId(event.clientId);
    setPublishError(null);
    try {
      const response = await api.availabilityEventResolve(
        session.access_token,
        eventForPublish(event),
      );
      setEvents((current) => current.map((item) => item.clientId === event.clientId ? {
        ...item,
        resolvedFaculty: facultyFromResolution(response.resolution),
        warnings: cleanList(response.warnings),
      } : item));
    } catch (err) {
      setPublishError(err.message ?? 'Could not refresh faculty matches.');
    } finally {
      setResolvingEventId(null);
    }
  }, [session]);

  const findFacultyCandidates = useCallback(async (query) => {
    if (!session?.access_token || query.trim().length < 2) return [];
    const response = await api.availabilityEventFacultyCandidates(session.access_token, query);
    return Array.isArray(response.candidates) ? response.candidates : [];
  }, [session]);

  const selectFaculty = useCallback(async (event, sourceName, candidate) => {
    const targetSource = sourceName || candidate.name;
    const hasSource = event.namedFacultyNames.includes(targetSource);
    const next = {
      ...event,
      namedFacultyNames: hasSource ? event.namedFacultyNames : [...event.namedFacultyNames, targetSource],
      namedFacultyInput: hasSource
        ? event.namedFacultyInput
        : [...event.namedFacultyNames, targetSource].join(', '),
      facultySelections: [
        ...event.facultySelections.filter((selection) => selection.sourceName !== targetSource),
        { sourceName: targetSource, facultyId: candidate.id },
      ],
    };
    setEvents((current) => current.map((item) => item.clientId === event.clientId ? next : item));
    await resolveEvent(next);
  }, [resolveEvent]);

  const removeFaculty = useCallback(async (event, nameToRemove, facultyIdToRemove) => {
    const targetName = (nameToRemove ?? '').trim().toLowerCase();
    const remainingSelections = (event.facultySelections ?? []).filter(
      (s) => s.sourceName.toLowerCase() !== targetName && (!facultyIdToRemove || s.facultyId !== facultyIdToRemove),
    );

    let remainingNames = event.namedFacultyNames.filter((name) => {
      if (name.toLowerCase() === targetName) return false;
      if (facultyIdToRemove) {
        const sel = (event.facultySelections ?? []).find((s) => s.sourceName.toLowerCase() === name.toLowerCase());
        if (sel && sel.facultyId === facultyIdToRemove) return false;
      }
      return true;
    });

    if (remainingNames.length === event.namedFacultyNames.length && targetName) {
      const targetTokens = targetName.replace(/[^a-z0-9]/g, ' ').split(' ').filter((t) => t.length > 2);
      if (targetTokens.length >= 2) {
        remainingNames = event.namedFacultyNames.filter((name) => {
          const itemTokens = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter((t) => t.length > 2);
          const overlap = itemTokens.filter((t) => targetTokens.includes(t));
          return overlap.length < 2;
        });
      }
    }

    const next = {
      ...event,
      namedFacultyNames: remainingNames,
      namedFacultyInput: remainingNames.join(', '),
      facultySelections: remainingSelections,
      resolvedFaculty: event.resolvedFaculty.filter(
        (f) => f.name.toLowerCase() !== targetName && (!facultyIdToRemove || f.facultyId !== facultyIdToRemove),
      ),
    };

    setEvents((current) => current.map((item) => item.clientId === event.clientId ? next : item));
    await resolveEvent(next);
  }, [resolveEvent]);

  const withdrawEvent = useCallback(async (event) => {
    if (!window.confirm(`Withdraw this availability event?\n\n${event.safeReason || event.id}`)) return;
    setWithdrawingId(event.id);
    setPublishedError(null);
    try {
      await api.availabilityEventWithdraw(session.access_token, event.id);
      await loadPublished();
    } catch (err) {
      setPublishedError(err.message ?? 'Could not withdraw the event.');
    } finally {
      setWithdrawingId(null);
    }
  }, [loadPublished, session]);

  const handleSignOut = useCallback(async () => { await signOut(); setSession(null); }, []);

  if (session === undefined) return null;
  if (!session) {
    return (
      <PortalLogin
        role="admin"
        icon={CalendarClock}
        title="Availability Events"
        description="For administrators and researchers only. Sign in to extract, review, publish, or withdraw availability events."
        onSession={setSession}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopNavigationBar />
      <DemoModeNotificationBanner />
      {cropSrc && <CropModal imageSrc={cropSrc} onDone={handleCropDone} onCancel={() => setCropSrc(null)} />}
      {showCamera && <CameraModal onCapture={(dataURL) => { setShowCamera(false); setCropSrc(dataURL); }} onCancel={() => setShowCamera(false)} />}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15"><CalendarClock className="h-5 w-5 text-accent" strokeWidth={1.75} /></div>
            <div>
              <p className="text-meta font-medium uppercase tracking-wider text-fg-subtle">Administrator and researcher workspace</p>
              <h1 className="mt-1 font-serif text-h2 text-fg">Availability Events</h1>
              <p className="mt-1 max-w-2xl text-label text-fg-muted">Turn scanned notices into reviewed availability windows without exposing private source text.</p>
            </div>
          </div>
          <button type="button" onClick={handleSignOut} className="flex items-center gap-2 self-start rounded-lg border border-transparent px-3 py-2 text-label text-fg-muted hover:border-line hover:bg-bg-sunken"><LogOut className="h-3.5 w-3.5" />Sign out</button>
        </header>

        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Availability event views">
          <button type="button" role="tab" aria-selected={view === 'ingest'} onClick={() => setView('ingest')} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-label font-medium ${view === 'ingest' ? 'border-accent text-accent' : 'border-transparent text-fg-muted hover:text-fg'}`}><Upload className="h-4 w-4" />Ingest events</button>
          <button type="button" role="tab" aria-selected={view === 'published'} onClick={() => setView('published')} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-label font-medium ${view === 'published' ? 'border-accent text-accent' : 'border-transparent text-fg-muted hover:text-fg'}`}><History className="h-4 w-4" />Published events<span className="rounded-full bg-bg-sunken px-2 py-0.5 text-meta">{published.length}</span></button>
        </div>

        {view === 'published' ? (
          <section className="py-7" aria-labelledby="published-heading">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div><h2 id="published-heading" className="font-serif text-h3 text-fg">Published Events</h2><p className="mt-1 text-label text-fg-muted">Only reviewed, public-safe fields are shown here. Private OCR audit text is never displayed.</p></div>
              <button type="button" onClick={loadPublished} disabled={publishedLoading} className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-label text-fg-muted hover:bg-bg-sunken disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${publishedLoading ? 'animate-spin' : ''}`} />Refresh</button>
            </div>
            {publishedError && <div className="mb-5 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-label text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{publishedError}</div>}
            {publishedLoading ? (
              <div className="space-y-3" aria-label="Loading published events">{[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-line bg-surface" />)}</div>
            ) : published.length > 0 ? (
              <div className="space-y-4">{published.map((event) => <PublishedEventCard key={event.id} event={event} withdrawing={withdrawingId === event.id} onWithdraw={() => withdrawEvent(event)} />)}</div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-surface px-5 py-14 text-center"><History className="mx-auto h-7 w-7 text-fg-subtle" /><h3 className="mt-3 font-serif text-h4 text-fg">No published events</h3><p className="mt-1 text-label text-fg-muted">Published availability events will appear here.</p></div>
            )}
          </section>
        ) : (
          <section className="py-7" aria-label="Availability event ingestion">
            {publishState === 'done' && (
              <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4 sm:flex-row sm:items-center">
                <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" /><div><p className="font-medium text-brand-300">{events.length} event{events.length === 1 ? '' : 's'} published</p><p className="mt-0.5 text-label text-fg-muted">The reviewed fields are live. Raw OCR was not persisted.</p></div></div>
                <div className="flex gap-2"><button type="button" onClick={() => setView('published')} className="rounded-xl border border-line px-3.5 py-2 text-label text-fg hover:bg-bg-sunken">View published</button><button type="button" onClick={resetAll} className="rounded-xl border border-line px-3.5 py-2 text-label text-fg hover:bg-bg-sunken">Ingest another</button></div>
              </div>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
              <div className="flex flex-col gap-4 lg:sticky lg:top-20">
                <div className="rounded-2xl border border-line bg-surface p-5">
                  <p className="mb-3 text-label font-semibold text-fg">1. Load source document</p>
                  {imageDataURL ? (
                    <div className="relative"><img src={imageDataURL} alt="Selected availability notice" className="max-h-72 w-full rounded-xl border border-line object-contain" /><div className="absolute right-2 top-2 flex gap-1.5"><button type="button" onClick={() => setCropSrc(imageDataURL)} className="rounded-lg border border-line bg-surface/90 p-1.5 text-fg-muted backdrop-blur-sm hover:text-fg" aria-label="Crop this image" title="Crop this image"><Crop className="h-3.5 w-3.5" /></button><button type="button" onClick={resetAll} className="rounded-lg border border-line bg-surface/90 p-1.5 text-fg-muted backdrop-blur-sm hover:text-fg" aria-label="Remove source image"><X className="h-3.5 w-3.5" /></button></div></div>
                  ) : sourceFile ? (
                    <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-bg-sunken p-4">
                      <div className="flex min-w-0 gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><div className="min-w-0"><p className="truncate text-label font-medium text-fg">{sourceFile.name}</p><p className="mt-0.5 text-meta uppercase text-fg-muted">{sourceFile.kind} document</p></div></div>
                      <button type="button" onClick={resetAll} className="rounded-lg p-1.5 text-fg-muted hover:bg-bg hover:text-fg" aria-label="Remove source document"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="availability-file-input" className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-bg-sunken px-4 py-8 text-center hover:border-accent/50 hover:bg-accent/5"><Upload className="h-7 w-7 text-fg-subtle" /><p className="text-label font-medium text-fg">Upload image, PDF, or Word file</p><p className="text-meta text-fg-muted">JPG, PNG, WebP, PDF, DOCX up to 20 MB</p><input id="availability-file-input" type="file" accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={handleFileChange} /></label>
                      {sourceError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-meta text-red-300">{sourceError}</p>}
                      <button type="button" onClick={() => setShowCamera(true)} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-label text-fg-muted hover:border-accent/40 hover:text-fg"><Camera className="h-4 w-4" />Use camera</button>
                    </div>
                  )}
                </div>

                {(imageDataURL || sourceFile) && (
                  <div className="rounded-2xl border border-line bg-surface p-5">
                    <div className="mb-3 flex items-center justify-between"><p className="text-label font-semibold text-fg">2. Read source text</p>{ocrState === 'done' && <span className="flex items-center gap-1 text-meta text-brand-400"><CheckCircle2 className="h-3.5 w-3.5" />Done</span>}</div>
                    {ocrState === 'running' && <div className="mb-3"><div className="mb-1 flex justify-between text-meta text-fg-muted"><span>Recognizing text...</span><span>{ocrProgress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-bg-sunken"><div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${ocrProgress}%` }} /></div></div>}
                    {ocrState === 'done' && <textarea value={ocrText} onChange={(e) => { setOcrText(e.target.value); clearExtraction(); }} rows={7} className={`${inputCls} resize-y font-mono text-meta`} placeholder="Review the browser OCR result before extraction" />}
                    {ocrState === 'error' && <p className="mb-3 text-label text-red-400">{sourceError || 'Text reading failed. Try another source file.'}</p>}
                    {imageDataURL && <button type="button" onClick={runOCR} disabled={ocrState === 'running'} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-label font-medium text-white disabled:opacity-60">{ocrState === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{ocrState === 'running' ? 'Reading...' : ocrState === 'done' ? 'Re-read' : 'Read text in browser'}</button>}
                  </div>
                )}

                {ocrState === 'done' && ocrText.trim() && (
                  <div className="rounded-2xl border border-line bg-surface p-5">
                    <p className="text-label font-semibold text-fg">3. Extract availability events</p><p className="my-3 text-meta text-fg-muted">Identifies one or more event windows and resolves named faculty for review.</p>
                    {extractError && <div className="mb-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-meta text-amber-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{extractError}</div>}
                    <button type="button" onClick={extractFields} disabled={extractState === 'running' || extractRetrySeconds > 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-label font-medium text-white hover:opacity-90 disabled:opacity-60">{extractState === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}{extractState === 'running' ? 'Extracting...' : extractRetrySeconds > 0 ? `Retry in ${extractRetrySeconds}s` : extractState === 'done' ? 'Re-extract events' : 'Extract events'}</button>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-meta font-medium uppercase tracking-wider text-fg-subtle">4. Review and publish</p><h2 className="mt-1 font-serif text-h3 text-fg">Extraction preview</h2></div>{events.length > 0 && <span className="text-label text-fg-muted">{events.length} event{events.length === 1 ? '' : 's'}</span>}</div>
                {events.length > 0 ? (
                  <div className="space-y-4">
                    {events.map((event, index) => (
                      <EventEditor
                        key={event.clientId}
                        event={event}
                        index={index}
                        removable={events.length > 1}
                        resolving={resolvingEventId === event.clientId}
                        onResolve={() => resolveEvent(event)}
                        onFindCandidates={findFacultyCandidates}
                        onSelectFaculty={(sourceName, candidate) => selectFaculty(event, sourceName, candidate)}
                        onRemoveFaculty={(name, facultyId) => removeFaculty(event, name, facultyId)}
                        onChange={(next) => setEvents((current) => current.map((item) => item.clientId === event.clientId ? next : item))}
                        onRemove={() => setEvents((current) => current.filter((item) => item.clientId !== event.clientId))}
                      />
                    ))}
                    {publishError && <div className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-label text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{publishError}</div>}
                    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center"><button type="button" onClick={resetAll} className="flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-label text-fg-muted hover:bg-bg-sunken"><RotateCcw className="h-4 w-4" />Reset</button><button type="button" onClick={handlePublish} disabled={publishState === 'publishing' || publishState === 'done'} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-label font-medium text-white hover:opacity-90 disabled:opacity-50">{publishState === 'publishing' ? <><Loader2 className="h-4 w-4 animate-spin" />Publishing...</> : publishState === 'done' ? <><CheckCircle2 className="h-4 w-4" />Published</> : <><Save className="h-4 w-4" />Publish reviewed events</>}</button></div>
                    <p className="px-1 text-meta text-fg-muted">Only reviewed event objects and a source checksum are stored. Raw OCR is used for extraction only and is not sent again when publishing.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-line bg-surface px-5 py-16 text-center"><FileText className="mx-auto h-7 w-7 text-fg-subtle" /><h3 className="mt-3 font-serif text-h4 text-fg">No extraction preview yet</h3><p className="mx-auto mt-1 max-w-md text-label text-fg-muted">Load a notice, run browser OCR, then extract its availability events. Multiple events will appear as separate editable cards.</p></div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
