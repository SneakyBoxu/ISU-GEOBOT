import { useEffect, useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { Alert, Button, Input } from '../ui-primitives/index.js';

/**
 * Faculty self-service privacy controls.
 *
 * The thesis obtains written informed consent once, before the evaluation
 * period (§3.10). RA 10173 also gives a data subject an ongoing right to
 * object. A signature in a folder does not satisfy that; a control the person
 * can operate themselves does.
 *
 * The pause is enforced BEFORE the classifier runs — the estimate is never
 * computed, not computed and then withheld — and the assistant's refusal is
 * worded identically to "I don't have information about that person", so
 * exercising the right does not advertise that it was exercised.
 */
export default function PrivacyControls({ token }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    try { setData(await api.myFaculty(token)); } catch { setData(null); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function toggle(visible) {
    setBusy(true); setMsg(null);
    try {
      const res = await api.setMyVisibility(token, {
        visible, reason: visible ? undefined : (reason.trim() || undefined),
      });
      setMsg(res.message); setReason(''); setAsking(false);
      await load();
    } catch (err) { setMsg(err.message); }
    finally { setBusy(false); }
  }

  if (!data) return null;
  const visible = data.faculty.availabilityVisible;

  return (
    <section className="mt-10 border border-line bg-surface p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={1.75} aria-hidden />
        <h2 className="font-serif text-h3 text-fg">Your privacy controls</h2>
      </div>

      <div className={`mt-5 border-l-2 pl-4 ${visible ? 'border-accent' : 'border-line-strong'}`}>
        <p className="flex items-center gap-2 text-body font-medium text-fg">
          {visible
            ? <Eye className="h-4 w-4 text-accent" aria-hidden />
            : <EyeOff className="h-4 w-4 text-fg-muted" aria-hidden />}
          {visible ? 'Your availability status is visible' : 'Availability disclosure is paused'}
        </p>
        <p className="mt-2 max-w-measure text-meta leading-relaxed text-fg-muted">
          {visible
            ? 'Signed-in campus users can ask whether you are available. They see one of three generalized statuses and never a location.'
            : 'The system declines questions about your availability and does not compute an estimate for you at all. Your participation in the study is unaffected.'}
        </p>
        {!visible && data.faculty.pausedAt && (
          <p className="mt-2 font-mono text-data text-fg-subtle">
            paused {new Date(data.faculty.pausedAt).toLocaleString()}
            {data.faculty.pauseReason ? ` · ${data.faculty.pauseReason}` : ''}
          </p>
        )}
      </div>

      <div className="mt-5">
        {visible ? (
          asking ? (
            <div className="max-w-md space-y-3">
              <Input
                value={reason} onChange={(e) => setReason(e.target.value)} maxLength={280}
                placeholder="Reason (optional, visible only to you and the researchers)"
                aria-label="Reason for pausing"
              />
              <div className="flex gap-2">
                <Button variant="destructive" icon={EyeOff} loading={busy}
                        onClick={() => toggle(false)}>
                  Pause disclosure
                </Button>
                <Button variant="text" onClick={() => { setAsking(false); setReason(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" icon={EyeOff} onClick={() => setAsking(true)}>
              Pause availability disclosure
            </Button>
          )
        ) : (
          <Button variant="primary" icon={Eye} loading={busy} onClick={() => toggle(true)}>
            Resume availability disclosure
          </Button>
        )}
      </div>

      {msg && <Alert tone="success" className="mt-4">{msg}</Alert>}

      <div className="mt-7 border-t border-line pt-5">
        <h3 className="eyebrow">What the system holds about you</h3>
        <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {[
            ['Schedule blocks', `${data.dataHeld.scheduleBlocks} entries`],
            ['Identity in the model', data.dataHeld.identityInModel],
            ['Location data', data.dataHeld.locationStored],
            ['Consent recorded', data.faculty.consentDate ?? 'not recorded'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3 border-b border-line py-1.5">
              <dt className="w-36 shrink-0 text-label text-fg-subtle">{k}</dt>
              <dd className="text-label text-fg">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {data.history?.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-label text-fg-subtle transition-colors duration-state hover:text-fg-muted">
            Change history ({data.history.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {data.history.map((h, i) => (
              <li key={i} className="font-mono text-data text-fg-subtle">
                {new Date(h.changed_at).toLocaleString()} — {h.visible ? 'resumed' : 'paused'}
                {h.reason ? ` (${h.reason})` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
