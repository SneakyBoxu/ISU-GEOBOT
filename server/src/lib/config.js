import 'dotenv/config';

/**
 * DEMO_MODE runs the whole application with no external services: no Supabase,
 * no Groq, no Python. See src/demo/index.js for exactly what is real and what
 * is stubbed. It exists so the app can be built and shown before credentials
 * and institutional data are available.
 */
export const DEMO_MODE = String(process.env.DEMO_MODE ?? 'false').toLowerCase() === 'true';

function required(name) {
  const v = process.env[name];
  // In demo mode nothing external is contacted, so external credentials are
  // not required. Outside demo mode they are, and failing at boot is correct.
  if (!v && DEMO_MODE) return '';
  if (!v) throw new Error(`Missing required env var ${name}. See server/.env.example`);
  return v;
}

export const config = {
  demoMode: DEMO_MODE,
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),

  supabase: {
    url: required('SUPABASE_URL'),
    // Audit W2. This key bypasses RLS. It exists ONLY here, on the server.
    // It must never appear in a VITE_* variable, the web bundle, or the repo.
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
    schema: process.env.DB_SCHEMA ?? 'geobot',
  },

  // Audit W7. Loopback. The ML service must not be internet-reachable.
  ml: {
    baseUrl: process.env.ML_BASE_URL ?? 'http://127.0.0.1:5001',
    timeoutMs: Number(process.env.ML_TIMEOUT_MS ?? 8000),
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY ?? '',
    // Thesis §3.7 names Llama 3.1 8B. Pinned, and recorded on every eval_run.
    // If Groq retires this id the substitution must be DISCLOSED, not silent —
    // every prior number becomes non-comparable (audit §8.7).
    model: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
    // Temperature 0 is not a style choice: it is required for the evaluation
    // runs to be reproducible, and it reduces hallucination (audit §8.5).
    temperature: 0,
    maxTokens: Number(process.env.GROQ_MAX_TOKENS ?? 700),
    timeoutMs: Number(process.env.GROQ_TIMEOUT_MS ?? 30000),
  },

  retrieval: {
    // Audit C19 / F-36. K moves Context Precision and Context Recall in
    // OPPOSITE directions. Fix it before evaluating, use the same value in
    // both arms, and never tune it after seeing RAGAS output — that is
    // fitting to your own benchmark.
    topK: Number(process.env.RETRIEVAL_TOP_K ?? 5),
    similarityFloor: Number(process.env.RETRIEVAL_SIMILARITY_FLOOR ?? 0.25),
  },

  presence: {
    // Audit C13. Same-calendar-day. A departure log governs until end of day;
    // anything longer is not defensible as "real-time".
    timezone: process.env.CAMPUS_TIMEZONE ?? 'Asia/Manila',
  },

  rateLimit: {
    // Audit F-29. Status masking protects the granularity of a single answer.
    // It does nothing about VOLUME: unlimited polling of "is X available?"
    // reconstructs a presence timeline. Rate limiting is the mitigation.
    windowMs: Number(process.env.RATE_WINDOW_MS ?? 60_000),
    chatMax: Number(process.env.RATE_CHAT_MAX ?? 15),
    demoMax: Number(process.env.RATE_DEMO_MAX ?? 10),
    generalMax: Number(process.env.RATE_GENERAL_MAX ?? 120),
  },

  sessionSalt: process.env.SESSION_SALT ?? 'change-me-in-production',
};

// v1.1.0 — register and length guidance changed, conversation history added.
// BUMPED DELIBERATELY. eval_run.prompt_template_version records this, and any
// evaluation run made under v1.0.0 is not comparable with one made under
// v1.1.0. Changing the prompt without changing this number is how a thesis
// ends up reporting two different systems as one.
export const PROMPT_TEMPLATE_VERSION = 'v1.1.0';
export const ROUTER_VERSION = 'gazetteer-v1.0.0';
