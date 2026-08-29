/**
 * Campus location management and faculty self-service.
 *
 * PERMISSION MODEL (implementation decision — the thesis describes no
 * authenticated end users at all).
 *
 *   anonymous   map, navigation and institutional questions.
 *               NO faculty availability.
 *   student     + faculty availability queries, rate-limited per account
 *   faculty     + control over their OWN availability disclosure
 *   validator   + the functional-validation checklist (thesis §3.8.2)
 *   guard       presence logging only
 *   admin       campus location management
 *   researcher  everything, plus evaluation
 *
 * Two decisions here are worth defending explicitly:
 *
 * 1. AVAILABILITY REQUIRES AN ACCOUNT. Audit F-29 identified the strongest
 *    privacy criticism available against this system: status masking protects
 *    the granularity of a single answer but does nothing about VOLUME, so an
 *    anonymous endpoint can be polled to reconstruct a named person's daily
 *    presence timeline. Requiring a campus account makes that attributable and
 *    rate-limitable per person rather than per IP. The map and institutional
 *    Q&A stay open, so the navigation half of the thesis is unaffected.
 *
 * 2. STUDENTS CANNOT EDIT THE CAMPUS MAP. Not because they are untrusted, but
 *    because geospatial data is institutional record-keeping: §3.4.1(a)
 *    specifies GPS survey verified against physical landmarks. Crowd-sourced
 *    coordinates would make the survey methodology unreportable.
 */

import { Router } from 'express';
import { z } from 'zod';

import { db, log } from '../utilities/service-clients.js';
import { requireAuth, requireRole } from '../middleware/authentication.js';
import { createPoi, deletePoi, reindexPoi, republishPoi, unpublishPoi, updatePoi } from '../services/campus-places-service.js';
import { clearRosterCache } from '../services/intent-query-router.js';

export const admin = Router();

const poiSchema = z.object({
  name: z.string().min(2).max(160),
  poiType: z.enum(['college', 'administrative', 'laboratory', 'library',
                   'facility', 'landmark', 'sports', 'other']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  buildingFunction: z.string().max(200).optional().nullable(),
  departmentId: z.string().max(64).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  // A NAME from the frontend allowlist, not markup and not a URL. The
  // pattern is the same one the database CHECK enforces.
  icon: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).optional().nullable(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  surveyMethod: z.enum(['gps_survey', 'satellite_imagery', 'floor_plan', 'estimated', 'unknown']).optional(),
  // No default. A location entered before the GPS survey is placeholder data
  // and has to say so (audit F-38).
  dataOrigin: z.enum(['synthetic', 'real']),
  note: z.string().max(280).optional(),
});

// ---------------------------------------------------------------------------
// Campus locations
// ---------------------------------------------------------------------------

admin.get('/pois', requireAuth, requireRole('admin', 'researcher'),
  async (_req, res, next) => {
    try {
      const { data, error } = await db
        .from('poi')
        .select('*, department:department_id (name)')
        .order('name');
      if (error) throw error;
      res.json({ pois: data ?? [] });
    } catch (err) { next(err); }
  });

admin.get('/departments', requireAuth, requireRole('admin', 'researcher'),
  async (_req, res, next) => {
    try {
      const { data, error } = await db
        .from('department').select('id, name, short_code, college').order('name');
      if (error) throw error;
      res.json({ departments: data ?? [] });
    } catch (err) { next(err); }
  });

/**
 * Add a new building.
 *
 * The place-card is generated and embedded in the same operation, so the new
 * location is answerable by the chatbot immediately — not after someone
 * remembers to re-run the ingestion script. That coupling is the whole point:
 * a map pin the assistant has never heard of is worse than no pin at all.
 */
admin.post('/pois', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      const input = poiSchema.parse(req.body);
      const { poi, index } = await createPoi(input, req.user.id);
      log.info({ poiId: poi.id, by: req.user.id }, 'campus location created');
      res.status(201).json({
        poi,
        indexed: index?.chunks ?? 0,
        placeCard: index?.text ?? null,
        message: `"${poi.name}" is now on the map and answerable by the assistant.`,
      });
    } catch (err) { next(err); }
  });

admin.patch('/pois/:id', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      const patch = poiSchema.partial().parse(req.body);
      const { poi, index } = await updatePoi(req.params.id, patch, req.user.id);
      res.json({
        poi,
        reindexed: Boolean(index),
        indexed: index?.chunks ?? 0,
      });
    } catch (err) { next(err); }
  });

/**
 * Unpublish rather than delete.
 *
 * A hard delete removes a row an earlier evaluation run may have retrieved
 * against, which would make that run unreproducible. Unpublishing drops the
 * location from the map and the corpus while the record survives.
 */
admin.post('/pois/:id/unpublish', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      await unpublishPoi(req.params.id, req.user.id, req.body?.note);
      res.json({ unpublished: true });
    } catch (err) { next(err); }
  });

admin.post('/pois/:id/republish', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      const result = await republishPoi(req.params.id, req.user.id, req.body?.note);
      res.json(result);
    } catch (err) { next(err); }
  });

admin.delete('/pois/:id', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      const result = await deletePoi(req.params.id, req.user.id, req.body?.note);
      res.json(result);
    } catch (err) { next(err); }
  });

admin.post('/pois/:id/reindex', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      const index = await reindexPoi(req.params.id);
      res.json({ indexed: index.chunks, placeCard: index.text });
    } catch (err) { next(err); }
  });

admin.get('/pois/:id/audit', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      const { data, error } = await db
        .from('poi_audit')
        .select('id, action, changed_by, changed_at, note')
        .eq('poi_id', req.params.id)
        .order('changed_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json({ audit: data ?? [] });
    } catch (err) { next(err); }
  });

// ---------------------------------------------------------------------------
// Faculty self-service
// ---------------------------------------------------------------------------

/**
 * A faculty member's own record and controls.
 *
 * This exists because a signature on a consent form is a one-time act, while
 * RA 10173 gives a data subject an ongoing right to object. Making that right
 * exercisable in one click — by the person themselves, without asking the
 * researchers — is the difference between claiming to respect it and
 * implementing it.
 */
admin.get('/me/faculty', requireAuth, requireRole('faculty', 'validator'),
  async (req, res, next) => {
    try {
      if (!req.user.facultyId) {
        return res.status(404).json({ error: 'no faculty record linked to this account' });
      }
      const { data: faculty, error } = await db
        .from('faculty')
        .select('id, full_name, honorific, is_consented, consent_date, availability_visible, availability_paused_at, availability_pause_reason, department:department_id (name)')
        .eq('id', req.user.facultyId)
        .maybeSingle();
      if (error) throw error;

      const { data: history } = await db
        .from('faculty_visibility_event')
        .select('visible, reason, changed_at')
        .eq('faculty_id', req.user.facultyId)
        .order('changed_at', { ascending: false })
        .limit(20);

      // What the system holds about them, stated plainly. A data subject has a
      // right to know, and showing it is cheaper than answering the question
      // one email at a time.
      const { data: schedule } = await db
        .from('faculty_schedule')
        .select('day_of_week, start_time, end_time, block_kind, semester')
        .eq('faculty_id', req.user.facultyId);

      res.json({
        faculty: {
          id: faculty?.id,
          name: faculty?.full_name,
          department: faculty?.department?.name ?? null,
          isConsented: faculty?.is_consented,
          consentDate: faculty?.consent_date,
          availabilityVisible: faculty?.availability_visible,
          pausedAt: faculty?.availability_paused_at,
          pauseReason: faculty?.availability_pause_reason,
        },
        dataHeld: {
          scheduleBlocks: schedule?.length ?? 0,
          // Named so it cannot be mistaken for anything else: the classifier
          // receives a surrogate key, never a name (audit F-19).
          identityInModel: 'pseudonymous surrogate key only',
          locationStored: 'never — the system holds no faculty location data',
        },
        history: history ?? [],
      });
    } catch (err) { next(err); }
  });

const visibilitySchema = z.object({
  visible: z.boolean(),
  reason: z.string().max(280).optional(),
});

admin.post('/me/faculty/visibility', requireAuth, requireRole('faculty', 'validator'),
  async (req, res, next) => {
    try {
      if (!req.user.facultyId) {
        return res.status(404).json({ error: 'no faculty record linked to this account' });
      }
      const { visible, reason } = visibilitySchema.parse(req.body);

      await db.from('faculty').update({
        availability_visible: visible,
        availability_paused_at: visible ? null : new Date().toISOString(),
        availability_pause_reason: visible ? null : (reason ?? null),
      }).eq('id', req.user.facultyId);

      await db.from('faculty_visibility_event').insert({
        faculty_id: req.user.facultyId,
        visible,
        reason: reason ?? null,
        changed_by: req.user.id,
      });

      // The router caches the roster. A paused faculty member has to disappear
      // from the gazetteer immediately, not after the TTL — otherwise the
      // system keeps answering about someone who just asked it to stop.
      clearRosterCache();

      log.info({ facultyId: req.user.facultyId, visible }, 'faculty visibility changed');
      res.json({
        availabilityVisible: visible,
        message: visible
          ? 'Your availability status is visible again.'
          : 'Availability disclosure paused. The system will decline questions '
            + 'about your availability and will not compute an estimate for you.',
      });
    } catch (err) { next(err); }
  });
