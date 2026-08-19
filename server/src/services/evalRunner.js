/**
 * Technical AI Evaluation harness (thesis §3.8.1, §1.2 Objective 2).
 *
 *   node src/services/evalRunner.js --label "run-01" --judge llama-3.3-70b-versatile
 *
 * Runs every registered eval_query through BOTH arms and persists everything
 * RAGAS needs plus component-level latency.
 *
 * FOUR THINGS THIS FILE GETS RIGHT THAT THE THESIS DOES NOT SPECIFY:
 *
 * 1. INTERLEAVED EXECUTION (audit F-02). Groq latency varies by minute and by
 *    queue depth and is the dominant term in Response Time. Running all
 *    standard queries then all enhanced queries measures Groq's load, not your
 *    architecture. Each query is run through both arms back to back.
 *
 * 2. VERBATIM CONTEXTS (audit F-03). RAGAS is defined over the exact retrieved
 *    strings. Not persisting them means the metric cannot be computed and the
 *    run cannot be reproduced.
 *
 * 3. SYNTHETIC HARD-FAIL (audit F-38). Refuses to run if any research table
 *    holds placeholder rows. A folder convention cannot stop synthetic data
 *    reaching a reported result; a harness that will not start can.
 *
 * 4. JUDGE != GENERATOR (audit F-05). Using Llama 3.1 8B to grade its own
 *    output is self-evaluation, and 8B-class models are weak at the claim
 *    decomposition Faithfulness depends on. The DB enforces the constraint;
 *    this script surfaces it early with a readable error.
 *
 * SCORING IS A SEPARATE STEP. This harness produces eval_result rows;
 * ml/score_ragas.py reads them and writes ragas_score. Keeping generation and
 * judging apart means a judge change does not require re-running the pipeline.
 */

import { pathToFileURL } from 'node:url';

import { db, log } from '../lib/clients.js';
import { config, PROMPT_TEMPLATE_VERSION, ROUTER_VERSION } from '../lib/config.js';
import { runPipeline } from './ragService.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

/** Audit F-38. The gate. */
export async function assertResearchReady() {
  if (config.demoMode) {
    throw new Error(
      'REFUSING TO RUN: the server is in DEMO_MODE.\n'
      + 'Demo mode uses placeholder data, a schedule lookup in place of the '
      + 'Random Forest, and templated text in place of the language model. '
      + 'Nothing measured here would be a research result. Set DEMO_MODE=false '
      + 'and connect Supabase, the ML service and Groq first.',
    );
  }
  const { data, error } = await db.rpc('corpus_is_research_ready');
  if (error) throw error;
  const offenders = (data ?? []).filter((r) => !r.ready);
  if (offenders.length) {
    const detail = offenders.map((r) => `${r.entity}=${r.synthetic_rows}`).join(', ');
    throw new Error(
      `REFUSING TO RUN: synthetic rows present (${detail}).\n` +
      'Replace placeholder data with real ISU data and set data_origin=\'real\' ' +
      'before producing any reportable result. Audit F-38 / R1-R12.',
    );
  }
}

export async function createRun({ label, judgeModel, notes }) {
  if (!judgeModel) throw new Error('--judge is required (audit F-05)');
  if (judgeModel === config.groq.model) {
    throw new Error(
      `The judge model must differ from the generator (${config.groq.model}). ` +
      'Using one model to grade its own output is self-evaluation and a ' +
      'panelist who knows RAGAS will ask about it. Audit F-05.',
    );
  }

  const { data: modelRow } = await db
    .from('rf_model_version')
    .select('id, version, label_source')
    .order('trained_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (modelRow?.label_source === 'schedule_derived') {
    log.warn(
      'The active RF model was trained with schedule-derived labels. Its ' +
      'accuracy is not evidence that ML beats rule-based lookup (audit F-18/F-20).',
    );
  }

  const { data, error } = await db
    .from('eval_run')
    .insert({
      run_label: label,
      groq_model_id: config.groq.model,
      llm_temperature: 0,
      prompt_template_version: PROMPT_TEMPLATE_VERSION,
      top_k: config.retrieval.topK,
      similarity_floor: config.retrieval.similarityFloor,
      rf_model_version_id: modelRow?.id ?? null,
      judge_model: judgeModel,
      status_as_context: true,        // audit C3
      router_version: ROUTER_VERSION,
      notes: notes ?? null,
      data_origin: 'real',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function runOne(runId, query, mode) {
  const result = await runPipeline({
    query: query.query_text,
    mode,
    includeSynthetic: false,          // real corpus only
  });

  const { error } = await db.from('eval_result').insert({
    run_id: runId,
    eval_query_id: query.id,
    mode,
    // Audit F-03 / C3. For the enhanced arm this array includes the masked
    // status block as a distinct item — without it, Context Precision and
    // Context Recall cannot move and Faithfulness may favour the baseline.
    retrieved_contexts: result.contextsForRagas,
    fused_prompt: result.fusedPrompt,
    answer: result.answer,
    masked_status: result.masked?.statusCode ?? null,
    override_applied: result.overrideApplied,
    // Audit §4.2: internal-only, persisted here for research, never in a DTO.
    rf_proba: result.internalProbabilities,
    router_decision: {
      category: result.route.category,
      needsAvailability: result.route.needsAvailability,
      routerVersion: result.route.routerVersion,
    },
    t_route_ms: Math.round(result.timings.route),
    t_guard_ms: Math.round(result.timings.guard),
    t_rf_ms: Math.round(result.timings.rf),
    t_embed_ms: Math.round(result.timings.embed),
    t_retrieve_ms: Math.round(result.timings.retrieve),
    t_llm_ms: Math.round(result.timings.llm),
    t_total_ms: Math.round(result.timings.total),
    egress_filter_hit: result.egressFilterHit,
    data_origin: 'real',
  });
  if (error) throw error;
  return result;
}

export async function executeRun(runId) {
  const { data: queries, error } = await db
    .from('eval_query')
    .select('*')
    .order('registered_at');
  if (error) throw error;
  if (!queries?.length) {
    throw new Error(
      'No registered eval_query rows. Audit C10: the curated test set and its ' +
      'category mix must be pre-registered IN WRITING before the first run. ' +
      'Choosing the mix after seeing results is p-hacking.',
    );
  }

  const latency = { standard: [], enhanced: [] };
  for (const [i, q] of queries.entries()) {
    process.stdout.write(`[${i + 1}/${queries.length}] ${q.query_text.slice(0, 58)}\n`);
    // Interleaved — audit F-02.
    for (const mode of ['standard', 'enhanced']) {
      const r = await runOne(runId, q, mode);
      latency[mode].push(r.timings.total);
      process.stdout.write(`    ${mode.padEnd(8)} ${Math.round(r.timings.total)}ms\n`);
    }
  }

  await db.from('eval_run').update({ finished_at: new Date().toISOString() })
    .eq('id', runId);

  const stat = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return {
      median: Math.round(s[Math.floor(s.length / 2)]),
      p95: Math.round(s[Math.floor(s.length * 0.95)] ?? s.at(-1)),
    };
  };

  console.log('\nResponse Time (thesis §1.2 Objective 2)');
  for (const mode of ['standard', 'enhanced']) {
    const { median, p95 } = stat(latency[mode]);
    console.log(`  ${mode.padEnd(9)} median ${median}ms  p95 ${p95}ms`);
  }
  console.log(
    '\nEnhanced is expected to be SLOWER — it adds a guard query and an HTTP\n' +
    'hop to the classifier. Report the component-level breakdown so the delta\n' +
    'is attributable rather than a bare regression (audit F-02).\n' +
    `\nNext: python ml/score_ragas.py --run ${runId}\n`,
  );

  return { runId, latency };
}

// pathToFileURL rather than string surgery: on Windows a drive-letter path
// produces file:///C:/... (three slashes), which naive concatenation misses,
// so the harness would exit silently instead of running.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv);
  try {
    await assertResearchReady();
    const run = await createRun({
      label: args.label ?? `run-${new Date().toISOString().slice(0, 16)}`,
      judgeModel: args.judge,
      notes: args.notes,
    });
    console.log(`eval_run ${run.id} (${run.run_label})\n`);
    await executeRun(run.id);
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }
}
