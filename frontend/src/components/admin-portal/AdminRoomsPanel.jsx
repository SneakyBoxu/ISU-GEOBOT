/**
 * Rooms & Facilities panel for the unified Admin Dashboard.
 *
 * Left sidebar: lists registered buildings (from campus_locations/poi) with
 *   building name, category badge, and room count.
 * Right panel: shows selected building's rooms in a table, with Add/Delete actions.
 * Add Room modal: a slide-over drawer with all room fields.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, DoorOpen, Plus, Search, Trash2, X, ChevronRight, Users, GraduationCap, Pencil,
} from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import {
  Alert, Button, EmptyState, Field, Input, Select, SkeletonRows, Textarea,
} from '../ui-primitives/index.js';

const FLOOR_OPTIONS = [
  'Basement', 'Ground Floor', '2nd Floor', '3rd Floor', '4th Floor',
  '5th Floor', '6th Floor', 'Roof',
];

const POI_TYPE_LABELS = {
  college:        'College',
  administrative: 'Admin',
  laboratory:     'Lab',
  library:        'Library',
  facility:       'Facility',
  landmark:       'Landmark',
  sports:         'Sports',
  other:          'Other',
};

// Color mapping for category badges (matching existing mapMarkerGlyphs colour logic)
const CATEGORY_COLORS = {
  college:        'bg-blue-500/15 text-blue-300 border-blue-500/30',
  administrative: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  laboratory:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  library:        'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  facility:       'bg-orange-500/15 text-orange-300 border-orange-500/30',
  landmark:       'bg-red-500/15 text-red-300 border-red-500/30',
  sports:         'bg-teal-500/15 text-teal-300 border-teal-500/30',
  other:          'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const EMPTY_FORM = {
  roomName: '', roomCode: '', floorLevel: '', department: '', description: '', aliases: '',
};

export default function AdminRoomsPanel({ session }) {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('rooms'); // 'rooms' | 'faculty'
  const [rooms, setRooms] = useState([]);
  const [roomCounts, setRoomCounts] = useState({});  // buildingId -> count
  const [buildingFaculty, setBuildingFaculty] = useState([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [facultyForm, setFacultyForm] = useState({
    fullName: '',
    honorific: 'Prof.',
    designation: 'Faculty',
    office: '',
    departmentName: '',
    aliases: '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [query, setQuery] = useState('');

  const getAutoDepartment = useCallback((building) => {
    return building?.department?.name || building?.name || '';
  }, []);

  // Load all buildings and departments
  const loadBuildings = useCallback(async () => {
    if (!session) return;
    setLoadingBuildings(true);
    try {
      const data = await api.adminPois(session.access_token);
      const pois = (data.pois ?? []).filter((p) => p.is_published !== false);
      setBuildings(pois);

      try {
        const d = await api.adminDepartments(session.access_token);
        setAvailableDepartments(d.departments ?? []);
      } catch {
        // non-blocking
      }

      // Load room counts for each building in parallel
      const counts = {};
      await Promise.allSettled(
        pois.map(async (b) => {
          try {
            const r = await api.buildingRooms(b.id, session.access_token);
            counts[b.id] = (r.rooms ?? []).length;
          } catch { counts[b.id] = 0; }
        })
      );
      setRoomCounts(counts);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setLoadingBuildings(false);
    }
  }, [session]);

  // Load rooms for selected building
  const loadRooms = useCallback(async (building) => {
    if (!building || !session) return;
    setLoadingRooms(true);
    setMsg(null);
    try {
      const data = await api.buildingRooms(building.id, session.access_token);
      setRooms(data.rooms ?? []);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setLoadingRooms(false);
    }
  }, [session]);

  // Load faculty for selected building
  const loadFaculty = useCallback(async (building) => {
    if (!building || !session) return;
    setLoadingFaculty(true);
    try {
      const data = await api.buildingFaculty(building.id, session.access_token);
      setBuildingFaculty(data.faculty ?? []);
    } catch {
      // non-blocking
    } finally {
      setLoadingFaculty(false);
    }
  }, [session]);

  useEffect(() => { loadBuildings(); }, [loadBuildings]);

  useEffect(() => {
    if (selectedBuilding) {
      loadRooms(selectedBuilding);
      loadFaculty(selectedBuilding);
    } else {
      setRooms([]);
      setBuildingFaculty([]);
    }
  }, [selectedBuilding, loadRooms, loadFaculty]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setFac = (k, v) => setFacultyForm((f) => ({ ...f, [k]: v }));

  const openModal = () => {
    setEditingRoom(null);
    const autoDept = getAutoDepartment(selectedBuilding);
    setForm({ ...EMPTY_FORM, department: autoDept });
    setMsg(null);
    setShowModal(true);
  };

  const openEditModal = (room) => {
    setEditingRoom(room);
    setForm({
      roomName: room.room_name || '',
      roomCode: room.room_code || '',
      floorLevel: room.floor_level || '',
      department: room.department || '',
      description: room.description || '',
      aliases: Array.isArray(room.aliases) ? room.aliases.join(', ') : (room.aliases || ''),
    });
    setMsg(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRoom(null);
    setForm(EMPTY_FORM);
    setMsg(null);
  };

  const openFacultyModal = () => {
    setEditingFaculty(null);
    const autoDept = getAutoDepartment(selectedBuilding);
    setFacultyForm({
      fullName: '',
      honorific: 'Prof.',
      designation: 'Faculty',
      office: '',
      departmentName: autoDept,
      aliases: '',
    });
    setMsg(null);
    setShowFacultyModal(true);
  };

  const openEditFacultyModal = (f) => {
    setEditingFaculty(f);
    setFacultyForm({
      fullName: f.fullName || '',
      honorific: f.honorific ?? 'Prof.',
      designation: f.designation || 'Faculty',
      office: f.office || '',
      departmentName: f.departmentName || selectedBuilding?.name || '',
      aliases: Array.isArray(f.aliases) ? f.aliases.join(', ') : '',
    });
    setMsg(null);
    setShowFacultyModal(true);
  };

  const closeFacultyModal = () => {
    setShowFacultyModal(false);
    setEditingFaculty(null);
    setFacultyForm({ fullName: '', honorific: 'Prof.', designation: 'Faculty', office: '', departmentName: '', aliases: '' });
  };

  async function submitRoom(e) {
    e.preventDefault();
    if (!selectedBuilding) return;
    setBusy(true); setMsg(null);
    try {
      const payload = {
        roomName:    form.roomName.trim(),
        roomCode:    form.roomCode.trim() || null,
        floorLevel:  form.floorLevel || null,
        department:  form.department.trim() || null,
        description: form.description.trim() || null,
        aliases:     form.aliases ? form.aliases.split(',').map((s) => s.trim()).filter(Boolean) : [],
      };

      if (editingRoom) {
        await api.adminUpdateRoom(session.access_token, editingRoom.id, payload);
        setMsg({ kind: 'ok', text: `Room "${form.roomName}" updated successfully.` });
      } else {
        await api.adminCreateRoom(session.access_token, {
          ...payload,
          buildingId: selectedBuilding.id,
        });
        setMsg({ kind: 'ok', text: `Room "${form.roomName}" added.` });
        setRoomCounts((prev) => ({ ...prev, [selectedBuilding.id]: (prev[selectedBuilding.id] ?? 0) + 1 }));
      }
      closeModal();
      await loadRooms(selectedBuilding);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRoom(room) {
    if (!window.confirm(`Delete room "${room.room_name}"? This cannot be undone.`)) return;
    setBusy(true); setMsg(null);
    try {
      await api.adminDeleteRoom(session.access_token, room.id);
      setMsg({ kind: 'ok', text: `"${room.room_name}" deleted.` });
      await loadRooms(selectedBuilding);
      setRoomCounts((prev) => ({ ...prev, [selectedBuilding.id]: Math.max(0, (prev[selectedBuilding.id] ?? 1) - 1) }));
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function submitFaculty(e) {
    e.preventDefault();
    if (!selectedBuilding) return;
    setBusy(true); setMsg(null);
    try {
      const payload = {
        fullName: facultyForm.fullName.trim(),
        honorific: facultyForm.honorific || null,
        designation: facultyForm.designation?.trim() || 'Faculty',
        office: facultyForm.office?.trim() || null,
        departmentName: facultyForm.departmentName.trim() || null,
        aliases: facultyForm.aliases ? facultyForm.aliases.split(',').map((s) => s.trim()).filter(Boolean) : [],
      };

      if (editingFaculty) {
        await api.adminUpdateFaculty(session.access_token, editingFaculty.id, payload);
        setMsg({ kind: 'ok', text: `Faculty member "${facultyForm.fullName}" updated successfully.` });
      } else {
        await api.adminCreateFaculty(session.access_token, {
          ...payload,
          buildingId: selectedBuilding.id,
        });
        setMsg({ kind: 'ok', text: `Faculty member "${facultyForm.fullName}" registered.` });
      }
      closeFacultyModal();
      await loadFaculty(selectedBuilding);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteFaculty(f) {
    if (!window.confirm(`Delete faculty member "${f.fullName}"? This cannot be undone.`)) return;
    setBusy(true); setMsg(null);
    try {
      await api.adminDeleteFaculty(session.access_token, f.id);
      setMsg({ kind: 'ok', text: `"${f.fullName}" deleted.` });
      await loadFaculty(selectedBuilding);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const filteredBuildings = buildings.filter(
    (b) => b.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex min-h-[600px] gap-0 rounded-xl border border-line overflow-hidden">
      {/* ── Left: Building Selector ── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-surface">
        <div className="border-b border-line px-4 py-4">
          <p className="text-label font-semibold uppercase tracking-widest text-fg-subtle opacity-60 mb-3">
            Buildings
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter buildings…"
              aria-label="Filter buildings"
              className="w-full rounded-md border border-line bg-bg-sunken py-2 pl-8 pr-3 text-meta text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loadingBuildings && buildings.length === 0 && (
            <div className="px-4 py-3"><SkeletonRows rows={5} /></div>
          )}
          {!loadingBuildings && filteredBuildings.length === 0 && (
            <p className="px-4 py-6 text-center text-meta text-fg-muted">No buildings found.</p>
          )}
          {filteredBuildings.map((b) => {
            const isSelected = selectedBuilding?.id === b.id;
            const catLabel = POI_TYPE_LABELS[b.poi_type] ?? b.poi_type;
            const catColor = CATEGORY_COLORS[b.poi_type] ?? CATEGORY_COLORS.other;
            const count = roomCounts[b.id] ?? 0;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBuilding(b)}
                className={`group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                  isSelected
                    ? 'bg-accent-subtle border-r-2 border-accent'
                    : 'hover:bg-bg-sunken border-r-2 border-transparent'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-meta font-medium ${isSelected ? 'text-accent' : 'text-fg'}`}>
                    {b.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-label font-medium ${catColor}`}>
                      {catLabel}
                    </span>
                    <span className="text-label text-fg-subtle">{count} room{count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? 'text-accent' : 'text-fg-subtle'}`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Right: Room List ── */}
      <main className="flex min-w-0 flex-1 flex-col bg-bg">
        {!selectedBuilding ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <EmptyState icon={DoorOpen} title="Select a building">
              Choose a building from the left to view and manage its rooms.
            </EmptyState>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-500/30 bg-teal-500/10">
                  <DoorOpen className="h-5 w-5 text-teal-400" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h2 className="font-serif text-h3 text-fg">{selectedBuilding.name}</h2>
                  <p className="mt-0.5 text-label text-fg-muted">
                    {rooms.length} room{rooms.length !== 1 ? 's' : ''} • {buildingFaculty.length} faculty member{buildingFaculty.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Sub-tab toggle */}
                <div className="flex items-center gap-1 rounded-lg border border-line bg-bg-sunken p-1">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('rooms')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label font-medium transition-colors ${
                      activeSubTab === 'rooms'
                        ? 'bg-surface text-fg shadow-sm'
                        : 'text-fg-subtle hover:text-fg'
                    }`}
                  >
                    <DoorOpen className="h-3.5 w-3.5" />
                    Rooms ({rooms.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('faculty')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label font-medium transition-colors ${
                      activeSubTab === 'faculty'
                        ? 'bg-surface text-fg shadow-sm'
                        : 'text-fg-subtle hover:text-fg'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Faculty ({buildingFaculty.length})
                  </button>
                </div>

                {activeSubTab === 'rooms' ? (
                  <Button variant="primary" size="sm" icon={Plus} onClick={openModal}>
                    Add Room
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" icon={Plus} onClick={openFacultyModal}>
                    Add Faculty
                  </Button>
                )}
              </div>
            </header>

            {/* Status messages */}
            {msg && (
              <div className="px-6 pt-4">
                <Alert tone={msg.kind === 'ok' ? 'success' : 'error'}>{msg.text}</Alert>
              </div>
            )}

            {/* Tab 1: Rooms */}
            {activeSubTab === 'rooms' && (
              <div className="flex-1 overflow-auto px-6 py-6">
                {loadingRooms && rooms.length === 0 && <SkeletonRows rows={4} />}

                {!loadingRooms && rooms.length === 0 && (
                  <EmptyState icon={DoorOpen} title="No rooms yet">
                    Click <strong>Add Room</strong> to register the first room in this building.
                  </EmptyState>
                )}

                {rooms.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-line">
                    <table className="w-full text-left text-meta">
                      <thead className="border-b border-line bg-bg-sunken">
                        <tr>
                          {['Name', 'Code', 'Floor', 'Department', 'Description', ''].map((h) => (
                            <th key={h} className="px-4 py-3 text-label font-semibold uppercase tracking-wide text-fg-subtle opacity-70">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {rooms.map((room) => (
                          <tr key={room.id} className="hover:bg-bg-sunken transition-colors">
                            <td className="px-4 py-3 font-medium text-fg">
                              {room.room_name}
                              {room.aliases && room.aliases.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {room.aliases.map((a) => (
                                    <span key={a} className="inline-flex items-center rounded border border-line px-1.5 py-0.5 text-label text-fg-subtle">
                                      {a}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-data text-fg-muted">
                              {room.room_code ?? <span className="text-fg-subtle">—</span>}
                            </td>
                            <td className="px-4 py-3 text-fg-muted">
                              {room.floor_level ?? <span className="text-fg-subtle">—</span>}
                            </td>
                            <td className="px-4 py-3 text-fg-muted">
                              {room.department ?? <span className="text-fg-subtle">—</span>}
                            </td>
                            <td className="max-w-xs px-4 py-3 text-fg-subtle">
                              <p className="line-clamp-2 text-label">{room.description ?? '—'}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(room)}
                                  disabled={busy}
                                  title={`Edit ${room.room_name}`}
                                  className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-bg-sunken hover:text-fg focus-visible:outline-focus disabled:opacity-50"
                                >
                                  <Pencil className="h-4 w-4" aria-hidden />
                                  <span className="sr-only">Edit {room.room_name}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRoom(room)}
                                  disabled={busy}
                                  title={`Delete ${room.room_name}`}
                                  className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-focus disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                  <span className="sr-only">Delete {room.room_name}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Faculty */}
            {activeSubTab === 'faculty' && (
              <div className="flex-1 overflow-auto px-6 py-6">
                {loadingFaculty && buildingFaculty.length === 0 && <SkeletonRows rows={4} />}

                {!loadingFaculty && buildingFaculty.length === 0 && (
                  <EmptyState icon={Users} title="No faculty registered yet">
                    Click <strong>Add Faculty</strong> to register professors and instructors working in this department.
                  </EmptyState>
                )}

                {buildingFaculty.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-line">
                    <table className="w-full text-left text-meta">
                      <thead className="border-b border-line bg-bg-sunken">
                        <tr>
                          {['Faculty Member', 'Designation', 'Department / College', 'Office', 'Status', ''].map((h) => (
                            <th key={h} className="px-4 py-3 text-label font-semibold uppercase tracking-wide text-fg-subtle opacity-70">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {buildingFaculty.map((f) => (
                          <tr key={f.id} className="hover:bg-bg-sunken transition-colors">
                            <td className="px-4 py-3 font-medium text-fg">
                              <div className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 text-accent shrink-0" />
                                <span>{f.fullName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-fg-muted font-medium">
                              {f.designation ?? 'Faculty'}
                            </td>
                            <td className="px-4 py-3 text-fg-muted">
                              {f.departmentName ?? selectedBuilding.name}
                            </td>
                            <td className="px-4 py-3 text-fg-muted font-mono text-label">
                              {f.office ?? <span className="text-fg-subtle">—</span>}
                            </td>
                            <td className="px-4 py-3 text-label">
                              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400 border border-emerald-500/20">
                                Active & Directory Linked
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditFacultyModal(f)}
                                  disabled={busy}
                                  title={`Edit ${f.fullName}`}
                                  className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-bg-sunken hover:text-fg focus-visible:outline-focus disabled:opacity-50"
                                >
                                  <Pencil className="h-4 w-4" aria-hidden />
                                  <span className="sr-only">Edit {f.fullName}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteFaculty(f)}
                                  disabled={busy}
                                  title={`Delete ${f.fullName}`}
                                  className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-focus disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                  <span className="sr-only">Delete {f.fullName}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Add Room Modal / Slide-over ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={closeModal}
            aria-hidden
          />
          {/* Drawer */}
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-lg">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
                  <DoorOpen className="h-4 w-4 text-teal-400" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <p className="text-meta font-semibold text-fg">{editingRoom ? 'Edit Room' : 'Add Room'}</p>
                  <p className="text-label text-fg-muted truncate max-w-[16rem]">{selectedBuilding?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-bg-sunken hover:text-fg"
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Close</span>
              </button>
            </div>

            {/* Drawer form */}
            <form onSubmit={submitRoom} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-5 px-6 py-6">
                <Field label="Room name" required>
                  {({ id }) => (
                    <Input
                      id={id} required minLength={1} maxLength={200}
                      value={form.roomName}
                      onChange={(e) => set('roomName', e.target.value)}
                      placeholder="Research Innovation Room"
                    />
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Room code">
                    {({ id }) => (
                      <Input
                        id={id} maxLength={50}
                        value={form.roomCode}
                        onChange={(e) => set('roomCode', e.target.value)}
                        placeholder="IRC-101"
                      />
                    )}
                  </Field>
                  <Field label="Floor level">
                    {({ id }) => (
                      <Select id={id} value={form.floorLevel} onChange={(e) => set('floorLevel', e.target.value)}>
                        <option value="">Not specified</option>
                        {FLOOR_OPTIONS.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>

                <Field
                  label="Department / College"
                  hint="Auto-filled from building. You can change this if the room belongs to a specific sub-department (e.g. IT Department, CS Department)."
                >
                  {({ id, describedBy }) => (
                    <div className="space-y-1">
                      <div className="relative">
                        <Input
                          id={id}
                          list="room-dept-suggestions"
                          maxLength={200}
                          aria-describedby={describedBy}
                          value={form.department}
                          onChange={(e) => set('department', e.target.value)}
                          placeholder={getAutoDepartment(selectedBuilding) || 'College or Department'}
                        />
                        {form.department !== getAutoDepartment(selectedBuilding) && (
                          <button
                            type="button"
                            onClick={() => set('department', getAutoDepartment(selectedBuilding))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-label font-medium text-accent hover:underline px-1.5 py-0.5 rounded bg-surface border border-line"
                            title="Reset to building name"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <datalist id="room-dept-suggestions">
                        {selectedBuilding?.department?.name && (
                          <option value={selectedBuilding.department.name} />
                        )}
                        {selectedBuilding?.name && (
                          <option value={selectedBuilding.name} />
                        )}
                        {availableDepartments.map((d) => (
                          <option key={d.id} value={d.name} />
                        ))}
                      </datalist>
                    </div>
                  )}
                </Field>

                <Field label="Description" hint="What is this room used for?">
                  {({ id, describedBy }) => (
                    <Textarea
                      id={id} rows={3} maxLength={2000}
                      aria-describedby={describedBy}
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="Used for research meetings and innovation showcases."
                    />
                  )}
                </Field>

                <Field label="Aliases" hint="Comma-separated alternate names for search.">
                  {({ id, describedBy }) => (
                    <Input
                      id={id} maxLength={1000}
                      aria-describedby={describedBy}
                      value={form.aliases}
                      onChange={(e) => set('aliases', e.target.value)}
                      placeholder="Innovation Center, Research Room, IRC"
                    />
                  )}
                </Field>

                {msg && (
                  <Alert tone={msg.kind === 'ok' ? 'success' : 'error'}>{msg.text}</Alert>
                )}
              </div>

              <div className="flex gap-2 border-t border-line px-6 py-4">
                <Button type="submit" variant="primary" size="lg" loading={busy} className="flex-1">
                  {editingRoom ? 'Save Changes' : 'Add room'}
                </Button>
                <Button type="button" variant="text" onClick={closeModal}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Faculty Modal / Slide-over ── */}
      {showFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={closeFacultyModal}
            aria-hidden
          />
          {/* Drawer */}
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-lg">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                  <Users className="h-4 w-4 text-accent" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <p className="text-meta font-semibold text-fg">{editingFaculty ? 'Edit Faculty / Teacher' : 'Add Faculty / Teacher'}</p>
                  <p className="text-label text-fg-muted truncate max-w-[16rem]">{selectedBuilding?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFacultyModal}
                className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-bg-sunken hover:text-fg"
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Close</span>
              </button>
            </div>

            {/* Drawer form */}
            <form onSubmit={submitFaculty} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-5 px-6 py-6">
                <Field label="Full name" required hint="e.g. Maria Santos or Juan Dela Cruz">
                  {({ id }) => (
                    <Input
                      id={id} required minLength={1} maxLength={200}
                      value={facultyForm.fullName}
                      onChange={(e) => setFac('fullName', e.target.value)}
                      placeholder="Maria Santos"
                    />
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Title / Honorific">
                    {({ id }) => (
                      <Select
                        id={id}
                        value={facultyForm.honorific}
                        onChange={(e) => setFac('honorific', e.target.value)}
                      >
                        <option value="Prof.">Prof.</option>
                        <option value="Dr.">Dr.</option>
                        <option value="Engr.">Engr.</option>
                        <option value="Atty.">Atty.</option>
                        <option value="Sir">Sir</option>
                        <option value="Ma'am">Ma'am</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="">None</option>
                      </Select>
                    )}
                  </Field>

                  <Field label="Aliases" hint="e.g. Santos, Sir Santos">
                    {({ id, describedBy }) => (
                      <Input
                        id={id} maxLength={300}
                        aria-describedby={describedBy}
                        value={facultyForm.aliases}
                        onChange={(e) => setFac('aliases', e.target.value)}
                        placeholder="Santos, Prof Santos"
                      />
                    )}
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Designation / Rank">
                    {({ id }) => (
                      <Input
                        id={id}
                        maxLength={100}
                        value={facultyForm.designation}
                        onChange={(e) => setFac('designation', e.target.value)}
                        placeholder="Associate Professor"
                      />
                    )}
                  </Field>
                  <Field label="Office / Room" hint="e.g. Room 201">
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        maxLength={100}
                        aria-describedby={describedBy}
                        value={facultyForm.office}
                        onChange={(e) => setFac('office', e.target.value)}
                        placeholder="Room 201"
                      />
                    )}
                  </Field>
                </div>

                <Field
                  label="Department / College"
                  hint="Auto-filled from current building. Edit if this faculty belongs to a specific sub-department."
                >
                  {({ id, describedBy }) => (
                    <div className="space-y-1">
                      <div className="relative">
                        <Input
                          id={id}
                          list="faculty-dept-suggestions"
                          maxLength={200}
                          aria-describedby={describedBy}
                          value={facultyForm.departmentName}
                          onChange={(e) => setFac('departmentName', e.target.value)}
                          placeholder={getAutoDepartment(selectedBuilding) || 'College or Department'}
                        />
                        {facultyForm.departmentName !== getAutoDepartment(selectedBuilding) && (
                          <button
                            type="button"
                            onClick={() => setFac('departmentName', getAutoDepartment(selectedBuilding))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-label font-medium text-accent hover:underline px-1.5 py-0.5 rounded bg-surface border border-line"
                            title="Reset to building department"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <datalist id="faculty-dept-suggestions">
                        {selectedBuilding?.department?.name && (
                          <option value={selectedBuilding.department.name} />
                        )}
                        {selectedBuilding?.name && (
                          <option value={selectedBuilding.name} />
                        )}
                        {availableDepartments.map((d) => (
                          <option key={d.id} value={d.name} />
                        ))}
                      </datalist>
                    </div>
                  )}
                </Field>

                {/* Privacy policy notice */}
                <div className="rounded-lg border border-accent/20 bg-accent-subtle/30 p-3.5 text-label text-fg-muted space-y-1">
                  <p className="font-semibold text-fg">Faculty Directory & Privacy Policy:</p>
                  <p>
                    When asked, the chatbot will state which department or college this faculty member is affiliated with.
                    In accordance with campus privacy guidelines, the chatbot will <strong>never</strong> state, guess, or infer exact room numbers or real-time physical locations.
                  </p>
                </div>

                {msg && (
                  <Alert tone={msg.kind === 'ok' ? 'success' : 'error'}>{msg.text}</Alert>
                )}
              </div>

              <div className="flex gap-2 border-t border-line px-6 py-4">
                <Button type="submit" variant="primary" size="lg" loading={busy} className="flex-1">
                  {editingFaculty ? 'Save Changes' : 'Register Faculty'}
                </Button>
                <Button type="button" variant="text" onClick={closeFacultyModal}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
