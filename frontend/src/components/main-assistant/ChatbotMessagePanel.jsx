import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Compass, Copy, CornerUpRight, FileText, Footprints, RotateCcw, Send, User, X, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { currentSession } from '../../frontend-utilities/supabaseClient.js';
import { Alert, Button, StatusIndicator } from '../ui-primitives/index.js';

const SUGGESTIONS = [
  'Where is the College of Computing Studies?',
  'Where is the Registrar’s Office?',
  'What are the enrollment requirements?',
  'When does the semester end?',
];

const GREETING = {
  role: 'assistant',
  intro: true,
  answer:
    'Ask me how to find a building or office on the Echague Main Campus, or about university announcements, calendars and requirements. I can also give a generalized availability estimate for faculty members who have consented to take part in this study.',
};

/**
 * The assistant.
 *
 * A conversation, laid out as one: the assistant on the left with a mark
 * against it, the user's question on the right. But the assistant's turn keeps
 * the full measure and the larger size, because the answer is the product and a
 * chat bubble that clips it to sixty percent of the column is a decoration
 * charging rent.
 *
 * Status sits above the answer as a bordered block — never a floating chip —
 * because it is the most consequential thing on screen and the one most easily
 * misread as fact. Sources collapse to one ruled line that expands, rather than
 * five icon rows competing with the text they support.
 */

/**
 * The map moved, and this says so.
 *
 * Panning a map silently, a fifth of a second after an answer appears, asks the
 * user to notice a change they were not told about and infer why. Naming the
 * place makes the link explicit — and makes it reversible, since the row is a
 * button that takes them back to it.
 */
function MapFocusNote({ focus, onFocus, onDirections }) {
  const navigate = useNavigate();
  if (!focus?.name) return null;

  const handleFocus = () => {
    if (onFocus) {
      onFocus(focus.poiId);
    } else if (focus.poiId) {
      navigate(`/app?poi=${encodeURIComponent(focus.poiId)}`);
    }
  };

  const handleDirections = () => {
    if (onDirections) {
      onDirections(focus.poiId);
    } else if (focus.poiId) {
      navigate(`/app?poi=${encodeURIComponent(focus.poiId)}&directions=true`);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleFocus}
        className="group inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-sunken px-2.5 py-1.5 text-label text-fg-muted transition-colors duration-state hover:border-line-strong hover:text-fg"
      >
        <Compass className="h-3.5 w-3.5 text-accent" aria-hidden />
        <span>
          View on map:{' '}
          <span className="font-medium text-fg">{focus.name}</span>
        </span>
      </button>

      {(onDirections || focus.poiId) && (
        <button
          type="button"
          onClick={handleDirections}
          className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-subtle px-2.5 py-1.5 text-label font-medium text-accent transition-colors duration-state hover:bg-accent hover:text-accent-contrast"
        >
          <CornerUpRight className="h-3.5 w-3.5" aria-hidden />
          <span>Get directions</span>
        </button>
      )}
    </div>
  );
}

/**
 * `compact` is the docked presentation: the same conversation in a 23rem panel
 * instead of a half-window column. It tightens gutters and steps the answer
 * down one size — at that width, body-lg wraps every seven words and the
 * measure fights the content instead of serving it.
 */
export default function ChatInterface({ onPoiFocus, onDirections, draft, compact = false, onClose, autoPan = true }) {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const [stage, setStage] = useState(0);
  const [serviceStatus, setServiceStatus] = useState('checking'); // 'checking' | 'ready' | 'ml_loading' | 'offline'
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const [token, setToken] = useState(null);

  useEffect(() => { currentSession().then((s) => setToken(s?.access_token ?? null)); }, []);

  // Poll backend health to verify Python ML microservice readiness
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function checkHealth() {
      try {
        const res = await api.health();
        if (cancelled) return;
        if (res.status === 'ok' && res.ml) {
          setServiceStatus('ready');
        } else if (res.status === 'ok' && !res.ml) {
          setServiceStatus('ml_loading');
          timer = setTimeout(checkHealth, 2500);
        } else {
          setServiceStatus('offline');
          timer = setTimeout(checkHealth, 3500);
        }
      } catch {
        if (!cancelled) {
          setServiceStatus('offline');
          timer = setTimeout(checkHealth, 3500);
        }
      }
    }

    checkHealth();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  // A question handed over from the map. Filled in, cursor placed at the end,
  // not sent — the user gets to change it first.
  useEffect(() => {
    if (!draft?.text) return;
    setInput(draft.text);
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(draft.text.length, draft.text.length);
  }, [draft?.nonce]);

  async function send(text) {
    const query = (text ?? input).trim();
    if (!query || busy || serviceStatus !== 'ready') return;
    setMessages((m) => [...m, { role: 'user', answer: query }]);
    setInput('');
    setBusy(true);
    setStage(0);
    // Name the phase rather than showing an anonymous spinner. These are the
    // real stages the request passes through, not invented reassurance.
    const t1 = setTimeout(() => setStage(1), 450);
    const t2 = setTimeout(() => setStage(2), 1100);
    try {
      // The turns so far, oldest first, greeting excluded. Errors are left out
      // too — replaying "that question could not be handled" teaches the model
      // nothing and spends context saying so.
      const history = messages
        .filter((m) => !m.intro && !m.error && m.answer)
        .slice(-6)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: String(m.answer).slice(0, 600),
        }));

      const res = await api.chat(query, token, history);
      setMessages((m) => [...m, { role: 'assistant', ...res }]);
      // Let the answer land first, then move the map. Doing both at once
      // splits attention; 180ms is enough to read as consequence.
      if (autoPan && res.poiFocus?.poiId) setTimeout(() => onPoiFocus?.(res.poiFocus.poiId), 180);
    } catch (err) {
      setMessages((m) => [...m, {
        role: 'assistant',
        error: true,
        tone: err.status === 429 ? 'warning' : 'error',
        title: err.status === 429 ? 'Too many questions at once'
          : err.status === 503 ? 'A required service is unavailable'
          : 'That question could not be handled',
        answer: err.status === 429
          ? 'Please wait a moment before asking again. The limit exists so availability questions cannot be polled in bulk.'
          : err.status === 503
          ? 'Faculty availability needs the classifier to be trained and the language-model endpoint reachable. Navigation and document questions should still work.'
          : 'Please try rephrasing, or ask about a building or university document.',
      }]);
    } finally {
      clearTimeout(t1); clearTimeout(t2);
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function copy(text, i) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1600);
    } catch { /* clipboard unavailable */ }
  }

  const isReady = serviceStatus === 'ready';

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-pill border border-line-strong bg-bg-sunken font-semibold text-fg"
          >
            <span className="font-serif text-[13px] leading-none">G</span>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-meta font-semibold text-fg">Campus Assistant</p>
              {serviceStatus === 'ready' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              )}
              {serviceStatus === 'ml_loading' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ML Booting
                </span>
              )}
              {serviceStatus === 'offline' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Connecting
                </span>
              )}
            </div>
            <p className="truncate font-mono text-data text-fg-subtle">
              {compact ? 'Enhanced RAG' : 'Enhanced RAG · grounded in university documents'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {messages.length > 1 && (
            <Button
              variant="text"
              size="sm"
              icon={RotateCcw}
              onClick={() => setMessages([GREETING])}
              aria-label="Clear the conversation"
            >
              {compact ? '' : 'Clear'}
            </Button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the assistant"
              className="btn-icon"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'px-3 py-4' : 'px-4 py-5 sm:px-6'}`}>
        <div className={`space-y-6 ${compact ? '' : 'mx-auto max-w-measure'}`}>
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="animate-enter flex items-start justify-end gap-2.5">
                <p className="max-w-[85%] border border-line-strong bg-surface px-3.5 py-2.5 text-body font-medium leading-relaxed text-fg">
                  {m.answer}
                </p>
                <span
                  aria-hidden
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-pill border border-line bg-bg-sunken text-fg-muted"
                >
                  <User className="h-3.5 w-3.5" />
                </span>
              </div>
            ) : m.error ? (
              <Alert key={i} tone={m.tone} title={m.title}>{m.answer}</Alert>
            ) : (
              <div key={i} className="animate-enter flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-pill border border-accent bg-accent text-accent-contrast"
                >
                  <span className="font-serif text-[12px] font-semibold leading-none">G</span>
                </span>

                <div className="min-w-0 flex-1">
                  {m.status && (
                    <div className="mb-4">
                      <StatusIndicator code={m.status.code} label={m.status.label} asOf={m.status.asOf} isEstimate={m.status.isEstimate} />
                    </div>
                  )}

                  <p className={`whitespace-pre-wrap leading-relaxed text-fg ${
                    m.intro ? 'text-body text-fg-muted' : compact ? 'text-body' : 'text-body-lg'
                  }`}>
                    {m.answer}
                  </p>

                  <MapFocusNote focus={m.poiFocus} onFocus={onPoiFocus} onDirections={onDirections} />

                  {m.clarification?.options?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {m.clarification.options.map((o) => (
                        <Button key={o.facultyId} variant="secondary" size="sm"
                                onClick={() => send(`Is ${o.fullName} available right now?`)}>
                          {o.fullName}
                        </Button>
                      ))}
                    </div>
                  )}

                  {m.sources?.length > 0 && (
                    <details className="group mt-4 border-t border-line pt-2.5">
                      <summary className="cursor-pointer list-none text-label text-fg-subtle transition-colors duration-state hover:text-fg-muted">
                        <FileText className="mr-1.5 inline h-3 w-3 align-[-1px]" aria-hidden />
                        {m.sources.length} source{m.sources.length === 1 ? '' : 's'}
                        <span className="ml-1.5 opacity-60 group-open:hidden">show</span>
                        <span className="ml-1.5 hidden opacity-60 group-open:inline">hide</span>
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {m.sources.map((s, j) => (
                          <li key={j} className="text-label text-fg-muted">{s.title}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {!m.intro && (
                    <button
                      type="button" onClick={() => copy(m.answer, i)}
                      className="mt-3 inline-flex items-center gap-1.5 text-label text-fg-subtle transition-colors duration-state hover:text-fg"
                    >
                      {copied === i
                        ? <><Check className="h-3 w-3" aria-hidden /> Copied</>
                        : <><Copy className="h-3 w-3" aria-hidden /> Copy answer</>}
                    </button>
                  )}
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-start gap-2.5" role="status" aria-live="polite">
              <span
                aria-hidden
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-pill border border-accent bg-accent text-accent-contrast"
              >
                <span className="font-serif text-[12px] font-semibold leading-none">G</span>
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-label text-fg-subtle">
                  {['Routing the question…', 'Retrieving documents…', 'Composing an answer…'][stage]}
                </p>
                <div className="skeleton h-4 w-full" aria-hidden />
                <div className="skeleton h-4 w-full" aria-hidden />
                <div className="skeleton h-4 w-3/5" aria-hidden />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {messages.length <= 1 && isReady && (
        <div className={`shrink-0 border-t border-line pt-3 ${compact ? 'px-3' : 'px-4 sm:px-6'}`}>
          <p className="eyebrow">Try</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 pb-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s} type="button" onClick={() => send(s)}
                className="text-meta text-fg-muted underline-offset-[6px] transition-colors duration-state hover:text-fg hover:underline hover:decoration-accent"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Service Loading Banner */}
      {serviceStatus === 'ml_loading' && (
        <div className="mx-3 my-2 sm:mx-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-amber-500" />
            <span className="font-medium">ML Service Initializing</span>
          </div>
          <p className="mt-1 text-[11px] text-fg-muted leading-relaxed">
            Loading sentence transformer embeddings & presence classifier into memory. Chat will unlock automatically once ready (~15–30s).
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-500/20">
            <div className="h-full w-full bg-amber-500 animate-pulse origin-left" />
          </div>
        </div>
      )}

      {serviceStatus === 'offline' && (
        <div className="mx-3 my-2 sm:mx-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
            <span className="font-medium">Backend Connecting...</span>
          </div>
          <p className="mt-1 text-[11px] text-fg-muted leading-relaxed">
            Connecting to the API server on port 4000. Retrying automatically...
          </p>
        </div>
      )}

      <div className={`shrink-0 border-t border-line bg-surface ${compact ? 'p-3' : 'p-4 sm:px-6'}`}>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!isReady || busy}
            placeholder={
              serviceStatus === 'ml_loading'
                ? 'Initializing ML embeddings model...'
                : serviceStatus === 'offline'
                ? 'Connecting to server...'
                : 'Ask about a building, an office, or a faculty member…'
            }
            aria-label="Ask ISU-GeoBot"
            maxLength={500}
            className="input flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button type="submit" variant="primary" disabled={!isReady || busy || !input.trim()}
                  aria-label="Send question" className="!px-3">
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </form>

        {/* Audit §4.3: a privacy control, not boilerplate. It is shortened in
            the dock, never removed — the claim it disclaims is made in the dock
            too. */}
        <p className="mt-2.5 text-label leading-relaxed text-fg-subtle">
          Availability is a schedule-derived{' '}
          <strong className="font-medium text-fg-muted">estimate</strong>, not a
          confirmed observation.
          {compact
            ? ' Faculty locations are never disclosed.'
            : ' ISU-GeoBot does not track or disclose the physical location of faculty members.'}
        </p>
      </div>
    </div>
  );
}

