import { createClient } from '@supabase/supabase-js';
import { config, DEMO_MODE } from './config.js';
import { log } from './logger.js';
import { demoDb, demoGenerate, demoMl } from '../demo/index.js';

export { log };

/**
 * Service-role client. Bypasses RLS by design (audit F-30) — the server is the
 * trusted tier. Every public read still goes through an Express route so the
 * table shape is never published to the browser.
 */
export const db = DEMO_MODE
  ? demoDb
  : createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: config.supabase.schema },
    });

/** Verifies end-user JWTs for /guard and /validate. Never used for data reads. */
export const authClient = DEMO_MODE || !config.supabase.anonKey
  ? null
  : createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

async function mlFetch(path, body, timeoutMs = config.ml.timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.ml.baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.message ?? `ML ${path} failed (${res.status})`);
      err.status = res.status;
      err.mlError = json.error;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The ONLY embedding path (audit F-14).
 *
 * Document vectors (ingest.py), query vectors (here) and evaluation vectors
 * (score_ragas.py) all come from the same Flask process. If Node ever grows
 * its own embedder, query and document vectors diverge and retrieval degrades
 * invisibly — the single worst silent bug available in this architecture.
 */
export const ml = DEMO_MODE ? demoMl : {
  embed: (text) => mlFetch('/embed', { text }),
  predict: (context) => mlFetch('/predict', { context }),
  modelInfo: () => mlFetch('/model/info'),
  health: () => mlFetch('/healthz'),
};

/**
 * Groq. Called ONLY from here (audit W6) — the API key never leaves the server.
 * Non-streaming on purpose: "Response Time" is a reported thesis metric and
 * streaming makes it ambiguous between first-token and completion (audit F-17).
 */
export async function generate(messages) {
  if (DEMO_MODE) return demoGenerate(messages);
  if (!config.groq.apiKey) {
    const err = new Error('GROQ_API_KEY is not configured');
    err.status = 503;
    throw err;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.groq.timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.groq.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.groq.model,
        messages,
        temperature: config.groq.temperature,
        max_tokens: config.groq.maxTokens,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const err = new Error(`Groq request failed (${res.status})`);
      err.status = res.status === 429 ? 429 : 502;
      err.detail = detail.slice(0, 500);
      throw err;
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() ?? '';
  } finally {
    clearTimeout(timer);
  }
}
