/**
 * Campus Rooms & Facilities API - test suite.
 */

process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import express from 'express';

const { api } = await import('../src/routes/index.js');

const AS_ADMIN = 'demo-admin-token';
const AS_STUDENT = 'demo-student-token';

let base;
let server;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', api);
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server?.close();
});

describe('Campus Rooms API', () => {
  let createdRoomId;

  it('GET /buildings/:buildingId/rooms returns rooms for a valid building', async () => {
    const res = await fetch(`${base}/buildings/p09/rooms`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.rooms));
    assert.ok(json.rooms.length > 0);
    assert.ok(json.rooms.some((r) => r.room_name === 'Research and Innovation Center'));
  });

  it('GET /rooms/search returns matching rooms and building info', async () => {
    const res = await fetch(`${base}/rooms/search?q=innovation`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.query, 'innovation');
    assert.ok(Array.isArray(json.results));
    assert.ok(json.results.length > 0);
    const match = json.results.find((r) => r.roomName.toLowerCase().includes('innovation'));
    assert.ok(match);
    assert.equal(match.buildingId, 'p09');
  });

  it('POST /rooms refuses unauthenticated requests', async () => {
    const res = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        buildingId: 'p09',
        roomName: 'Unauthorized Room',
      }),
    });
    assert.equal(res.status, 401);
  });

  it('POST /rooms refuses student role', async () => {
    const res = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${AS_STUDENT}`,
      },
      body: JSON.stringify({
        buildingId: 'p09',
        roomName: 'Student Room',
      }),
    });
    assert.equal(res.status, 403);
  });

  it('POST /rooms creates room when called by admin', async () => {
    const res = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${AS_ADMIN}`,
      },
      body: JSON.stringify({
        buildingId: 'p09',
        roomName: 'Robotics Workshop',
        roomCode: 'RW-102',
        floorLevel: 'Ground Floor',
        department: 'Department of Computer Science',
        description: 'Robotics lab for autonomous systems and IoT.',
        aliases: ['Robotics Lab'],
      }),
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.ok(json.room?.id);
    assert.equal(json.room.room_name, 'Robotics Workshop');
    createdRoomId = json.room.id;
  });

  it('PATCH /rooms/:id updates room details when called by admin', async () => {
    assert.ok(createdRoomId);
    const res = await fetch(`${base}/rooms/${createdRoomId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${AS_ADMIN}`,
      },
      body: JSON.stringify({
        roomName: 'Advanced Robotics Lab',
        floorLevel: '2nd Floor',
      }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.room.room_name, 'Advanced Robotics Lab');
    assert.equal(json.room.floor_level, '2nd Floor');
  });

  it('DELETE /rooms/:id deletes created room when called by admin', async () => {
    assert.ok(createdRoomId);
    const res = await fetch(`${base}/rooms/${createdRoomId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${AS_ADMIN}` },
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.deleted, true);
    assert.equal(json.roomName, 'Advanced Robotics Lab');
  });

  let createdFacultyId;

  it('GET /buildings/:buildingId/faculty returns faculty for a building', async () => {
    const res = await fetch(`${base}/buildings/p09/faculty`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.faculty));
    assert.ok(json.faculty.length > 0);
  });

  it('POST /faculty creates a faculty member when called by admin', async () => {
    const res = await fetch(`${base}/faculty`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${AS_ADMIN}`,
      },
      body: JSON.stringify({
        fullName: 'Prof. Test Teacher',
        honorific: 'Prof.',
        buildingId: 'p09',
        departmentName: 'Department of Computer Science',
        aliases: ['Test Teacher', 'Teacher Test'],
      }),
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.ok(json.faculty?.id);
    assert.equal(json.faculty.fullName, 'Prof. Test Teacher');
    assert.equal(json.faculty.departmentName, 'Department of Computer Science');
    createdFacultyId = json.faculty.id;
  });

  it('POST /chat about a faculty member states their department without room number or pin', async () => {
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Where is Prof. Test Teacher?' }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.answer);
    assert.ok(json.answer.includes('Department of Computer Science'));
    // Never reveals room number or floor
    assert.doesNotMatch(json.answer, /\b(?:room|rm\.?|office)\s*#?\s*\d+/i);
    // Never pins the map for a question about a person
    assert.equal(json.poiFocus ?? null, null);
  });

  it('PATCH /faculty/:id updates faculty details when called by admin', async () => {
    assert.ok(createdFacultyId);
    const res = await fetch(`${base}/faculty/${createdFacultyId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${AS_ADMIN}`,
      },
      body: JSON.stringify({
        fullName: 'Prof. Test Teacher Updated',
        designation: 'Associate Professor',
        office: 'Room 305',
      }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.faculty.fullName, 'Prof. Test Teacher Updated');
    assert.equal(json.faculty.designation, 'Associate Professor');
    assert.equal(json.faculty.office, 'Room 305');
  });

  it('DELETE /faculty/:id deletes the faculty member when called by admin', async () => {
    assert.ok(createdFacultyId);
    const res = await fetch(`${base}/faculty/${createdFacultyId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${AS_ADMIN}` },
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.deleted, true);
  });
});
