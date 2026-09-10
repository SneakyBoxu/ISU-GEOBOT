import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { log, ml } from './utilities/service-clients.js';
import { config } from './utilities/configuration.js';
import { api } from './routes/index.js';

const app = express();

app.set('trust proxy', 1);           // rate limiting behind a proxy (F-29)
app.use(helmet());
app.use(compression());
app.use(cors({ origin: config.corsOrigins, credentials: false }));
// 64kb is deliberately tight: every other endpoint takes a query or a small
// object, and a small ceiling is the cheapest defence against a body-size
// denial of service. The schedule importer is the one exception -- a
// departmental workbook is ~550kb of xlsx, which is ~730kb once base64'd --
// so it gets its own parser mounted ahead of the global one rather than
// loosening the limit for the whole API.
app.use('/api/admin/schedule', express.json({ limit: '20mb' }));
app.use('/api/admin/document', express.json({ limit: '36mb' }));
// A downscaled location photograph is a few hundred kilobytes; 8mb is
// headroom, and the storage bucket enforces the same ceiling again.
app.use('/api/admin/pois', express.json({ limit: '8mb' }));
app.use(express.json({ limit: '64kb' }));
app.use(pinoHttp({ logger: log, autoLogging: { ignore: (r) => r.url === '/api/health' } }));

app.use('/api', api);

app.use((_req, res) => res.status(404).json({ error: 'not found' }));

const server = app.listen(config.port, async () => {
  log.info(`ISU-GeoBot API on :${config.port} (${config.env})`);

  if (config.demoMode) {
    log.warn(
      'DEMO_MODE is ON. Availability comes from a deterministic schedule '
      + 'lookup (no Random Forest), answers are templated (no Groq), '
      + 'embeddings are lexical (not all-MiniLM-L6-v2), and all data is '
      + 'placeholder. The evaluation harness will refuse to run.',
    );
    return;
  }

  // Startup diagnostics. Both of these are EXPECTED to be unhealthy early in
  // the project, and saying so plainly is better than a silent degraded mode.
  try {
    const health = await ml.health();
    log.info({ embedder: health.embedder }, 'ML service reachable');
    if (!health.rf_ready) {
      log.warn(
        'No trained Random Forest. Availability queries will return 503 until ' +
        'train_availability_model.py has run against real data. This is the correct state ' +
        'before training — a placeholder model must never be shipped (audit R6).',
      );
    }
  } catch {
    log.warn(`ML service unreachable at ${config.ml.baseUrl}. Start machine-learning/ai_api_service.py.`);
  }

  if (!config.groq.apiKey) log.warn('GROQ_API_KEY unset — generation will fail.');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
