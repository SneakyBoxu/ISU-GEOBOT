/**
 * Rooms & Facilities API.
 *
 * Manages internal rooms, offices, and departments linked to campus buildings.
 * Powers room-level chatbot search ("Where is the research innovation room?").
 *
 * ENDPOINTS
 *   GET  /api/buildings/:buildingId/rooms   List all rooms for a building
 *   POST /api/rooms                         Create a room (admin/researcher)
 *   DELETE /api/rooms/:id                   Delete a room (admin/researcher)
 *   GET  /api/rooms/search?q=              Fuzzy text search (public)
 */

import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { z } from 'zod';

import { db, log } from '../utilities/service-clients.js';
import { requireAuth, requireRole } from '../middleware/authentication.js';
import { clearRosterCache } from '../services/intent-query-router.js';

export const rooms = Router();

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FACULTY_STORE_PATH = path.resolve(__dirname, '../data/faculty_profile_store.json');

function loadFacultyProfileStore() {
  try {
    if (fs.existsSync(FACULTY_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(FACULTY_STORE_PATH, 'utf-8'));
    }
  } catch (err) {
    log.warn({ err: err.message }, 'could not read faculty profile store');
  }
  return {};
}

function saveFacultyProfileStore(store) {
  try {
    const dir = path.dirname(FACULTY_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FACULTY_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    log.warn({ err: err.message }, 'could not write faculty profile store');
  }
}

// ---------------------------------------------------------------------------
// Validation schema for room creation
// ---------------------------------------------------------------------------

const roomSchema = z.object({
  buildingId:  z.string().trim().min(1).max(64),
  roomName:    z.string().min(1).max(200),
  roomCode:    z.string().max(50).optional().nullable(),
  floorLevel:  z.string().max(100).optional().nullable(),
  department:  z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  aliases:     z.array(z.string().max(200)).max(20).optional(),
  imageUrl:    z.string().trim().max(1000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET /api/buildings/:buildingId/rooms
// List all rooms belonging to a building (public read)
// ---------------------------------------------------------------------------

rooms.get('/buildings/:buildingId/rooms', async (req, res, next) => {
  try {
    const { buildingId } = z.object({ buildingId: z.string().trim().min(1).max(64) }).parse(req.params);

    const { data, error } = await db
      .from('campus_rooms')
      .select('id, room_name, room_code, floor_level, department, description, aliases, image_url, created_at')
      .eq('building_id', buildingId)
      .order('floor_level', { ascending: true })
      .order('room_name', { ascending: true });

    if (error) throw error;
    res.json({ rooms: data ?? [] });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/rooms
// Create a new room linked to a building (admin / researcher only)
// ---------------------------------------------------------------------------

rooms.post('/rooms', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      const input = roomSchema.parse(req.body);

      // Verify the referenced building exists
      const { data: building, error: buildingErr } = await db
        .from('poi')
        .select('id, name, department:department_id (name)')
        .eq('id', input.buildingId)
        .maybeSingle();
      if (buildingErr) throw buildingErr;
      if (!building) {
        return res.status(404).json({ error: 'building_not_found',
          message: 'The referenced building does not exist.' });
      }

      // Default department to building's linked department or building name if omitted
      const resolvedDepartment = (input.department && input.department.trim())
        ? input.department.trim()
        : (building.department?.name || building.name || null);

      const { data: room, error } = await db
        .from('campus_rooms')
        .insert({
          building_id:  input.buildingId,
          room_name:    input.roomName,
          room_code:    input.roomCode ?? null,
          floor_level:  input.floorLevel ?? null,
          department:   resolvedDepartment,
          description:  input.description ?? null,
          aliases:      input.aliases ?? [],
          image_url:    input.imageUrl ? input.imageUrl.trim() : null,
        })
        .select()
        .single();

      if (error) throw error;
      log.info({ roomId: room.id, buildingId: input.buildingId, by: req.user.id }, 'campus room created');
      res.status(201).json({ room });
    } catch (err) { next(err); }
  });

// ---------------------------------------------------------------------------
// DELETE /api/rooms/:id
// Remove a room (admin / researcher only)
// ---------------------------------------------------------------------------

rooms.delete('/rooms/:id', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      const { id } = z.object({ id: z.string().trim().min(1).max(64) }).parse(req.params);

      const { data: existing } = await db
        .from('campus_rooms').select('id, room_name').eq('id', id).maybeSingle();
      if (!existing) return res.status(404).json({ error: 'room_not_found' });

      const { error } = await db.from('campus_rooms').delete().eq('id', id);
      if (error) throw error;

      log.info({ roomId: id, by: req.user.id }, 'campus room deleted');
      res.json({ deleted: true, roomName: existing.room_name });
    } catch (err) { next(err); }
  });

// ---------------------------------------------------------------------------
// PATCH /api/rooms/:id
// Update an existing room (admin / researcher only)
// ---------------------------------------------------------------------------

const roomUpdateSchema = z.object({
  roomName:    z.string().min(1).max(200).optional(),
  roomCode:    z.string().max(50).optional().nullable(),
  floorLevel:  z.string().max(100).optional().nullable(),
  department:  z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  aliases:     z.array(z.string().max(200)).max(20).optional(),
  imageUrl:    z.string().trim().max(1000).optional().nullable(),
});

rooms.patch('/rooms/:id', requireAuth, requireRole('admin', 'researcher'),
  async (req, res, next) => {
    try {
      const { id } = z.object({ id: z.string().trim().min(1).max(64) }).parse(req.params);
      const input = roomUpdateSchema.parse(req.body);

      const { data: existing } = await db
        .from('campus_rooms')
        .select('id, building_id, room_name')
        .eq('id', id)
        .maybeSingle();

      if (!existing) {
        return res.status(404).json({ error: 'room_not_found', message: 'Room not found.' });
      }

      const updates = {};
      if (input.roomName !== undefined) updates.room_name = input.roomName.trim();
      if (input.roomCode !== undefined) updates.room_code = input.roomCode ? input.roomCode.trim() : null;
      if (input.floorLevel !== undefined) updates.floor_level = input.floorLevel || null;
      if (input.department !== undefined) updates.department = input.department ? input.department.trim() : null;
      if (input.description !== undefined) updates.description = input.description ? input.description.trim() : null;
      if (input.aliases !== undefined) updates.aliases = input.aliases;
      if (input.imageUrl !== undefined) updates.image_url = input.imageUrl ? input.imageUrl.trim() : null;

      const { data: room, error } = await db
        .from('campus_rooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      log.info({ roomId: id, by: req.user.id }, 'campus room updated');
      res.json({ room });
    } catch (err) { next(err); }
  });

// ---------------------------------------------------------------------------
// GET /api/rooms/search?q=
// Fuzzy / full-text search over room names, aliases, and departments.
// Returns matched rooms joined with their parent building info.
// Powers chatbot queries like "Where is the research innovation room?"
// ---------------------------------------------------------------------------

rooms.get('/rooms/search', async (req, res, next) => {
  try {
    const { q } = z.object({ q: z.string().trim().min(1).max(300) }).parse(req.query);

    // PRIMARY: PostgreSQL full-text search over name + department + description
    // The campus_rooms_with_building view includes all needed building fields.
    const { data: ftsData, error: ftsError } = await db
      .from('campus_rooms_with_building')
      .select('id, room_name, room_code, floor_level, department, description, aliases, building_id, building_name, category, lat, lng, image_url, image_alt, created_at')
      .textSearch(
        'room_name',   // Supabase .textSearch searches a column; we'll use ilike fallback below
        q,
        { type: 'websearch', config: 'english' }
      )
      .limit(10);

    // FALLBACK / SECONDARY: ilike search for partial matches on room_name, department, aliases
    // We always run both and merge, deduplicating by id.
    const { data: ilikeData } = await db
      .from('campus_rooms_with_building')
      .select('id, room_name, room_code, floor_level, department, description, aliases, building_id, building_name, category, lat, lng, image_url, image_alt, created_at')
      .or(`room_name.ilike.%${q}%,department.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(10);

    // Merge and deduplicate; FTS results first (higher relevance)
    const seen = new Set();
    const merged = [];
    for (const row of [...(ftsError ? [] : (ftsData ?? [])), ...(ilikeData ?? [])]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push(row);
      }
    }

    // Also check aliases array — Supabase: filter rows where aliases contains q (case-insensitive)
    const { data: aliasData } = await db
      .from('campus_rooms_with_building')
      .select('id, room_name, room_code, floor_level, department, description, aliases, building_id, building_name, category, lat, lng, image_url, image_alt, created_at')
      .filter('aliases', 'cs', `{"${q}"}`)
      .limit(5);

    for (const row of aliasData ?? []) {
      if (!seen.has(row.id)) { seen.add(row.id); merged.push(row); }
    }

    res.json({
      query: q,
      results: merged.slice(0, 10).map((r) => ({
        id:           r.id,
        roomName:     r.room_name,
        roomCode:     r.room_code ?? null,
        floorLevel:   r.floor_level ?? null,
        department:   r.department ?? null,
        description:  r.description ?? null,
        aliases:      r.aliases ?? [],
        buildingId:   r.building_id,
        buildingName: r.building_name,
        category:     r.category,
        lat:          r.lat,
        lng:          r.lng,
        imageUrl:     r.image_url ?? null,
        imageAlt:     r.image_alt ?? null,
      })),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /api/buildings/:buildingId/faculty
// List faculty members associated with a building's department
// ---------------------------------------------------------------------------

rooms.get('/buildings/:buildingId/faculty', async (req, res, next) => {
  try {
    const { buildingId } = z.object({ buildingId: z.string().trim().min(1).max(64) }).parse(req.params);

    const { data: building, error: bErr } = await db
      .from('poi')
      .select('id, name, department_id, department:department_id (id, name)')
      .eq('id', buildingId)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!building) return res.status(404).json({ error: 'building_not_found' });

    const bDeptId = building.department_id;
    const bName = (building.name || '').toLowerCase();
    const bDeptName = (building.department?.name || '').toLowerCase();

    // Check all departments whose name or college matches this building
    const { data: allDepts } = await db.from('department').select('id, name, college');
    const matchedDeptIds = new Set();
    if (bDeptId) matchedDeptIds.add(bDeptId);

    for (const d of allDepts ?? []) {
      const dName = (d.name || '').toLowerCase();
      const dCollege = (d.college || '').toLowerCase();
      if (
        (dName && (bName.includes(dName) || dName.includes(bName))) ||
        (dCollege && (bName.includes(dCollege) || dCollege.includes(bName))) ||
        (bDeptName && (dName === bDeptName || dCollege === bDeptName))
      ) {
        matchedDeptIds.add(d.id);
      } else {
        // Keyword overlap for colleges (e.g., Computing, Information and Communication Technology)
        const bWords = bName.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !['college', 'department'].includes(w));
        const dWords = `${dName} ${dCollege}`.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !['college', 'department'].includes(w));
        const overlap = bWords.filter((w) => dWords.includes(w)).length;
        if (overlap >= 2) {
          matchedDeptIds.add(d.id);
        }
      }
    }

    let facultyRows = [];
    const { data: extRows, error: extErr } = await db
      .from('faculty')
      .select('id, full_name, honorific, is_active, is_consented, department_id, department:department_id (id, name), designation, office, availability_visible, image_url, email, phone')
      .order('full_name', { ascending: true });

    if (extErr) {
      // If designation / office / image_url / email / phone is missing from Supabase schema cache, gracefully fallback
      log.warn({ err: extErr.message }, 'faculty extended select failed, falling back to base schema');
      const { data: baseRows, error: baseErr } = await db
        .from('faculty')
        .select('id, full_name, honorific, is_active, is_consented, department_id, department:department_id (id, name)')
        .order('full_name', { ascending: true });
      if (baseErr) throw baseErr;
      facultyRows = baseRows ?? [];
    } else {
      facultyRows = extRows ?? [];
    }

    // Strictly filter out synthetic simulation cohort (SIM-01..SIM-37) so only actual personnel display in directory & admin
    facultyRows = (facultyRows ?? []).filter(
      (f) => !/^SIM-\d+$/i.test(f.full_name?.trim() || '')
    );

    // Load aliases safely
    const aliasesByFaculty = new Map();
    try {
      const { data: allAliases } = await db.from('faculty_alias').select('faculty_id, alias');
      for (const a of allAliases ?? []) {
        if (!aliasesByFaculty.has(a.faculty_id)) aliasesByFaculty.set(a.faculty_id, []);
        aliasesByFaculty.get(a.faculty_id).push(a.alias);
      }
    } catch {
      // non-blocking if faculty_alias not queryable
    }

    const matched = (facultyRows ?? []).filter((f) => {
      if (f.department_id && matchedDeptIds.has(f.department_id)) return true;
      const fDept = (f.department?.name || '').toLowerCase();
      if (!fDept) return false;
      return fDept === bName || fDept === bDeptName || bName.includes(fDept) || (bDeptName && bDeptName.includes(fDept));
    });

    const store = loadFacultyProfileStore();

    res.json({
      buildingId,
      buildingName: building.name,
      faculty: matched.map((f) => {
        const fallback = store[f.id] || {};
        return {
          id: f.id,
          fullName: f.full_name,
          honorific: f.honorific ?? null,
          departmentId: f.department_id ?? null,
          departmentName: f.department?.name ?? null,
          designation: f.designation ?? fallback.designation ?? 'Faculty',
          office: f.office ?? fallback.office ?? null,
          imageUrl: f.image_url ?? fallback.imageUrl ?? null,
          email: f.email ?? fallback.email ?? null,
          phone: f.phone ?? fallback.phone ?? null,
          aliases: aliasesByFaculty.get(f.id) ?? [],
          isActive: f.is_active,
          isConsented: f.is_consented,
          availabilityStatus: f.availability_visible === false ? 'paused' : 'available',
          availabilityLabel: f.availability_visible === false ? 'Status Paused' : 'Available for Consultation',
        };
      }),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/faculty
// Add a faculty member to a department (admin / researcher only)
// ---------------------------------------------------------------------------

const facultyCreateSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  honorific: z.string().trim().max(50).optional().nullable(),
  designation: z.string().trim().max(100).optional().nullable(),
  office: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(100).optional().nullable(),
  buildingId: z.string().trim().min(1).max(64).optional().nullable(),
  departmentId: z.string().trim().min(1).max(64).optional().nullable(),
  departmentName: z.string().trim().max(200).optional().nullable(),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  aliases: z.array(z.string().trim().max(200)).max(20).optional(),
});

rooms.post('/faculty', requireAuth, requireRole('admin', 'researcher'), async (req, res, next) => {
  try {
    const input = facultyCreateSchema.parse(req.body);
    let targetDeptId = input.departmentId ?? null;

    if (!targetDeptId && input.buildingId) {
      const { data: building } = await db
        .from('poi')
        .select('id, name, department_id, department:department_id (id, name)')
        .eq('id', input.buildingId)
        .maybeSingle();

      if (building?.department_id) {
        targetDeptId = building.department_id;
      } else {
        const deptNameToMatch = input.departmentName?.trim() || building?.name;
        if (deptNameToMatch) {
          const { data: existingDept } = await db
            .from('department')
            .select('id, name')
            .ilike('name', deptNameToMatch)
            .maybeSingle();

          if (existingDept) {
            targetDeptId = existingDept.id;
          } else {
            const { data: newDept, error: deptErr } = await db
              .from('department')
              .insert({
                name: deptNameToMatch,
                data_origin: 'real',
              })
              .select()
              .single();
            if (!deptErr && newDept) {
              targetDeptId = newDept.id;
              await db.from('poi').update({ department_id: newDept.id }).eq('id', input.buildingId);
            }
          }
        }
      }
    } else if (!targetDeptId && input.departmentName?.trim()) {
      const { data: existingDept } = await db
        .from('department')
        .select('id, name')
        .ilike('name', input.departmentName.trim())
        .maybeSingle();
      if (existingDept) {
        targetDeptId = existingDept.id;
      } else {
        const { data: newDept } = await db
          .from('department')
          .insert({ name: input.departmentName.trim(), data_origin: 'real' })
          .select()
          .single();
        if (newDept) targetDeptId = newDept.id;
      }
    }

    const baseFacultyPayload = {
      full_name: input.fullName,
      honorific: input.honorific || null,
      department_id: targetDeptId,
      is_consented: true,
      consent_date: new Date().toISOString().slice(0, 10),
      is_active: true,
      data_origin: 'real',
      availability_visible: true,
      image_url: input.imageUrl ? input.imageUrl.trim() : null,
    };

    let created;
    const attempt = await db
      .from('faculty')
      .insert({
        ...baseFacultyPayload,
        designation: input.designation || 'Faculty',
        office: input.office || null,
        email: input.email ? input.email.trim() : null,
        phone: input.phone ? input.phone.trim() : null,
        building_id: input.buildingId || null,
      })
      .select('id, full_name, honorific, department_id, is_active, is_consented, department:department_id (id, name)')
      .single();

    if (attempt.error && (attempt.error.message?.includes('designation') || attempt.error.message?.includes('column') || attempt.error.message?.includes('schema cache'))) {
      log.warn({ err: attempt.error.message }, 'faculty insert with extended columns failed, falling back to base columns');
      const safePayload = { ...baseFacultyPayload };
      delete safePayload.image_url;
      const fallbackAttempt = await db
        .from('faculty')
        .insert(safePayload)
        .select('id, full_name, honorific, department_id, is_active, is_consented, department:department_id (id, name)')
        .single();
      if (fallbackAttempt.error) throw fallbackAttempt.error;
      created = fallbackAttempt.data;
    } else if (attempt.error) {
      throw attempt.error;
    } else {
      created = attempt.data;
    }

    if (created?.id) {
      const store = loadFacultyProfileStore();
      store[created.id] = {
        imageUrl: input.imageUrl ? input.imageUrl.trim() : null,
        email: input.email ? input.email.trim() : null,
        phone: input.phone ? input.phone.trim() : null,
        designation: input.designation || 'Faculty',
        office: input.office || null,
      };
      saveFacultyProfileStore(store);
    }

    // Collect provided aliases plus title-stripped and surname aliases
    const aliasSet = new Set(input.aliases ?? []);
    const clean = input.fullName.replace(/\b(prof(?:essor)?|dr|doc|engr|atty|sir|ma'?am|mr|mrs|ms)\.?\s+/gi, '').trim();
    if (clean && clean.toLowerCase() !== input.fullName.toLowerCase()) {
      aliasSet.add(clean);
    }
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      aliasSet.add(words[words.length - 1]); // surname
    }

    if (aliasSet.size > 0 && created?.id) {
      const aliasInserts = [...aliasSet].map((a) => ({
        faculty_id: created.id,
        alias: a,
        data_origin: 'real',
      }));
      try {
        await db.from('faculty_alias').insert(aliasInserts);
      } catch {
        // non-blocking
      }
    }

    clearRosterCache();
    log.info({ facultyId: created.id, by: req.user.id }, 'faculty registered');
    res.status(201).json({
      faculty: {
        id: created.id,
        fullName: created.full_name,
        honorific: created.honorific,
        designation: input.designation || 'Faculty',
        office: input.office || null,
        imageUrl: input.imageUrl ? input.imageUrl.trim() : null,
        email: input.email ? input.email.trim() : null,
        phone: input.phone ? input.phone.trim() : null,
        departmentId: created.department_id,
        departmentName: created.department?.name ?? null,
      },
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// DELETE /api/faculty/:id
// Remove a faculty member (admin / researcher only)
// ---------------------------------------------------------------------------

rooms.delete('/faculty/:id', requireAuth, requireRole('admin', 'researcher'), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().trim().min(1).max(64) }).parse(req.params);
    const { data: existing } = await db.from('faculty').select('id, full_name').eq('id', id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'faculty_not_found' });

    const { error } = await db.from('faculty').delete().eq('id', id);
    if (error) throw error;

    const store = loadFacultyProfileStore();
    if (store[id]) {
      delete store[id];
      saveFacultyProfileStore(store);
    }

    clearRosterCache();
    log.info({ facultyId: id, by: req.user.id }, 'faculty deleted');
    res.json({ deleted: true, fullName: existing.full_name });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PATCH /api/faculty/:id
// Update an existing faculty member (admin / researcher only)
// ---------------------------------------------------------------------------

const facultyUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  honorific: z.string().trim().max(50).optional().nullable(),
  designation: z.string().trim().max(100).optional().nullable(),
  office: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(100).optional().nullable(),
  buildingId: z.string().trim().min(1).max(64).optional().nullable(),
  departmentId: z.string().trim().min(1).max(64).optional().nullable(),
  departmentName: z.string().trim().max(200).optional().nullable(),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  aliases: z.array(z.string().trim().max(200)).max(20).optional(),
});

rooms.patch('/faculty/:id', requireAuth, requireRole('admin', 'researcher'), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().trim().min(1).max(64) }).parse(req.params);
    const input = facultyUpdateSchema.parse(req.body);

    const { data: existing } = await db
      .from('faculty')
      .select('id, full_name, department_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'faculty_not_found', message: 'Faculty member not found.' });
    }

    let targetDeptId = input.departmentId !== undefined ? input.departmentId : undefined;

    if (targetDeptId === undefined && input.departmentName?.trim()) {
      const { data: existingDept } = await db
        .from('department')
        .select('id, name')
        .ilike('name', input.departmentName.trim())
        .maybeSingle();
      if (existingDept) {
        targetDeptId = existingDept.id;
      } else {
        const { data: newDept } = await db
          .from('department')
          .insert({ name: input.departmentName.trim(), data_origin: 'real' })
          .select()
          .single();
        if (newDept) targetDeptId = newDept.id;
      }
    }

    const updates = {};
    if (input.fullName !== undefined) updates.full_name = input.fullName;
    if (input.honorific !== undefined) updates.honorific = input.honorific || null;
    if (input.designation !== undefined) updates.designation = input.designation || 'Faculty';
    if (input.office !== undefined) updates.office = input.office || null;
    if (input.email !== undefined) updates.email = input.email ? input.email.trim() : null;
    if (input.phone !== undefined) updates.phone = input.phone ? input.phone.trim() : null;
    if (input.imageUrl !== undefined) updates.image_url = input.imageUrl ? input.imageUrl.trim() : null;
    if (targetDeptId !== undefined) updates.department_id = targetDeptId;

    // Always persist profile fields to fallback store so image_url, email, etc. are never lost
    const store = loadFacultyProfileStore();
    store[id] = {
      ...(store[id] || {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ? input.imageUrl.trim() : null } : {}),
      ...(input.email !== undefined ? { email: input.email ? input.email.trim() : null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ? input.phone.trim() : null } : {}),
      ...(input.designation !== undefined ? { designation: input.designation || 'Faculty' } : {}),
      ...(input.office !== undefined ? { office: input.office || null } : {}),
    };
    saveFacultyProfileStore(store);

    let updated;
    const attempt = await db
      .from('faculty')
      .update(updates)
      .eq('id', id)
      .select('id, full_name, honorific, department_id, is_active, is_consented, department:department_id (id, name)')
      .single();

    if (attempt.error && (attempt.error.message?.includes('designation') || attempt.error.message?.includes('column') || attempt.error.message?.includes('schema cache'))) {
      log.warn({ err: attempt.error.message }, 'faculty update with extended columns failed, falling back to base columns');
      const safeUpdates = { ...updates };
      delete safeUpdates.designation;
      delete safeUpdates.office;
      delete safeUpdates.email;
      delete safeUpdates.phone;
      delete safeUpdates.image_url;
      const fallbackAttempt = await db
        .from('faculty')
        .update(safeUpdates)
        .eq('id', id)
        .select('id, full_name, honorific, department_id, is_active, is_consented, department:department_id (id, name)')
        .single();
      if (fallbackAttempt.error) throw fallbackAttempt.error;
      updated = fallbackAttempt.data;
    } else if (attempt.error) {
      throw attempt.error;
    } else {
      updated = attempt.data;
    }

    if (input.aliases !== undefined) {
      try {
        await db.from('faculty_alias').delete().eq('faculty_id', id);
        const aliasSet = new Set(input.aliases ?? []);
        const targetName = input.fullName || existing.full_name;
        const clean = targetName.replace(/\b(prof(?:essor)?|dr|doc|engr|atty|sir|ma'?am|mr|mrs|ms)\.?\s+/gi, '').trim();
        if (clean && clean.toLowerCase() !== targetName.toLowerCase()) {
          aliasSet.add(clean);
        }
        const words = clean.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
          aliasSet.add(words[words.length - 1]); // surname
        }

        if (aliasSet.size > 0) {
          const aliasInserts = [...aliasSet].map((a) => ({
            faculty_id: id,
            alias: a,
            data_origin: 'real',
          }));
          await db.from('faculty_alias').insert(aliasInserts);
        }
      } catch {
        // non-blocking
      }
    }

    clearRosterCache();
    const savedFallback = store[id] || {};
    res.json({
      faculty: {
        id: updated.id,
        fullName: updated.full_name,
        honorific: updated.honorific,
        designation: updated.designation ?? savedFallback.designation ?? 'Faculty',
        office: updated.office ?? savedFallback.office ?? null,
        imageUrl: updated.image_url ?? savedFallback.imageUrl ?? null,
        email: updated.email ?? savedFallback.email ?? null,
        phone: updated.phone ?? savedFallback.phone ?? null,
        departmentId: updated.department_id,
        departmentName: updated.department?.name ?? null,
      },
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /api/upload-photo
// Direct image file upload for rooms & faculty (admin / researcher only)
// ---------------------------------------------------------------------------

const uploadPhotoSchema = z.object({
  contentB64: z.string().min(1),
  folder: z.enum(['rooms', 'faculty', 'campus']).default('rooms'),
});

rooms.post('/upload-photo', requireAuth, requireRole('admin', 'researcher'), async (req, res, next) => {
  try {
    const { contentB64, folder } = uploadPhotoSchema.parse(req.body);
    const base64 = String(contentB64 || '').replace(/^data:[^;]+;base64,/, '');
    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      buffer = Buffer.alloc(0);
    }
    if (!buffer.length) {
      return res.status(400).json({ error: 'invalid_image', message: 'No image data received.' });
    }
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'file_too_large', message: 'Image must be under 8 MB.' });
    }

    let ext = 'jpg';
    let contentType = 'image/jpeg';
    if (buffer.length >= 12) {
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        ext = 'jpg'; contentType = 'image/jpeg';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        ext = 'png'; contentType = 'image/png';
      } else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        ext = 'webp'; contentType = 'image/webp';
      }
    }

    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const objectName = `${folder}/${folder}_${uniqueId}.${ext}`;

    try {
      const { error: uploadError } = await db.storage
        .from('campus-photos')
        .upload(objectName, buffer, { contentType, upsert: true });

      if (uploadError) {
        log.warn({ err: uploadError.message }, 'storage upload failed, returning data URI fallback');
        return res.json({ imageUrl: `data:${contentType};base64,${base64}` });
      }

      const { data: pub } = db.storage.from('campus-photos').getPublicUrl(objectName);
      const imageUrl = `${pub.publicUrl}?v=${Date.now()}`;
      return res.json({ imageUrl });
    } catch (storageErr) {
      log.warn({ err: storageErr.message }, 'storage upload exception, returning data URI fallback');
      return res.json({ imageUrl: `data:${contentType};base64,${base64}` });
    }
  } catch (err) { next(err); }
});

