import pino from 'pino';

/**
 * Deliberately separate from clients.js.
 *
 * The status masking boundary imports the logger, and nothing else. Keeping
 * the logger free of Supabase/Groq configuration means the masking test suite
 * — which is the project's evidence that the privacy boundary works
 * (audit F-27) — runs with zero environment setup. A security test that needs
 * production credentials to execute is a security test that stops being run.
 */
export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Audit §6.3: a raw prediction or probability vector must never reach the
  // logs, even accidentally, even in development.
  redact: {
    paths: [
      'rawPrediction',
      'probabilities',
      '*.rf_proba',
      'req.headers.authorization',
    ],
    censor: '[purged]',
  },
});
