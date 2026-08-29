import https from 'node:https';
import { createClient } from '@supabase/supabase-js';
import { config, DEMO_MODE } from './configuration.js';
import { log } from './logger.js';
import { demoDb, demoGenerate, demoMl } from '../mock-services/index.js';

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
    let res;
    try {
      res = await fetch(`${config.ml.baseUrl}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (networkErr) {
      const err = new Error(`ML microservice is offline or unreachable (${config.ml.baseUrl}).`);
      err.status = 503;
      err.cause = networkErr;
      throw err;
    }

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
 * Native HTTPS helper forcing IPv4.
 *
 * Crucial on Windows systems where IPv6 routes can be flaky and cause intermittent
 * ECONNRESET / wsarecv socket drops.
 */
function httpsPostJson(urlStr, headers, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyStr = JSON.stringify(payload);
    const req = https.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      family: 4, // Force IPv4 to eliminate IPv6 network socket drops
      timeout: timeoutMs,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(bodyStr);
    req.end();
  });
}

/**
 * Groq. Called ONLY from here (audit W6) — the API key never leaves the server.
 * Non-streaming on purpose: "Response Time" is a reported thesis metric and
 * streaming makes it ambiguous between first-token and completion (audit F-17).
 */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = [0, 1000, 2000];

export async function generate(messages) {
  if (DEMO_MODE) return demoGenerate(messages);
  if (!config.groq.apiKey) {
    const err = new Error('GROQ_API_KEY is not configured');
    err.status = 503;
    throw err;
  }

  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS[attempt]));
      log.warn({ attempt, model: config.groq.model }, 'Groq request retry');
    }

    try {
      const res = await httpsPostJson(
        'https://api.groq.com/openai/v1/chat/completions',
        { Authorization: `Bearer ${config.groq.apiKey}` },
        {
          model: config.groq.model,
          messages,
          temperature: config.groq.temperature,
          max_tokens: config.groq.maxTokens,
          stream: false,
        },
        config.groq.timeoutMs,
      );

      if (res.status < 200 || res.status >= 300) {
        const err = new Error(`Groq request failed (${res.status})`);
        err.status = res.status === 429 ? 429 : 502;
        err.detail = res.body.slice(0, 500);
        err.retryAfterMs = Number(res.headers?.['retry-after']) * 1000 || null;
        throw err;
      }

      const json = JSON.parse(res.body);
      const raw = json.choices?.[0]?.message?.content ?? '';
      const afterThink = raw.split(/<\/think>/i);
      return (afterThink.length > 1 ? afterThink[afterThink.length - 1] : raw).trim();
    } catch (err) {
      if (err.status && err.status !== 502) {
        // 4xx errors should not be retried
        throw err;
      }
      lastErr = err;
    }
  }
  throw lastErr;
}
