/**
 * Building Directory Panel.
 *
 * Dedicated building-level view for the left sidebar on the interactive campus map.
 * Replaces the "CAMPUS INDEX" when a building or marker is selected.
 *
 * Features:
 *   - "← Back to Campus Index" button
 *   - Building identity header & category badge
 *   - Dual tab navigation: [Rooms & Facilities] & [Faculty & Staff]
 *   - Real-time room cards with floor badges & codes
 *   - Faculty cards with designations & availability badges
 *   - Scoped search / filter within the building's rooms or faculty
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CornerUpRight,
  DoorOpen,
  GraduationCap,
  MessageSquarePlus,
  PanelLeftClose,
  Search,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { categoryColor } from './mapMarkerGlyphs.js';
import { PoiGlyph } from './mapPinIconBuilder.js';
import { SkeletonRows } from '../ui-primitives/index.js';

export default function BuildingDirectoryPanel({
  poi,
  onBack,
  onToggle,
  open,
  onAsk,
  onDirections,
}) {
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'faculty'
  const [rooms, setRooms] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [query, setQuery] = useState('');

  // ── Load rooms for this building ─────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    if (!poi?.id) return;
    setLoadingRooms(true);
    try {
      const res = await api.buildingRooms(poi.id);
      setRooms(res.rooms ?? []);
    } catch {
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, [poi?.id]);

  // ── Load faculty for this building/department ────────────────────────────
  const fetchFaculty = useCallback(async () => {
    if (!poi?.id) return;
    setLoadingFaculty(true);
    try {
      const res = await api.buildingFaculty(poi.id);
      setFaculty(res.faculty ?? []);
    } catch {
      setFaculty([]);
    } finally {
      setLoadingFaculty(false);
    }
  }, [poi?.id]);

  useEffect(() => {
    fetchRooms();
    fetchFaculty();
    setQuery('');
  }, [fetchRooms, fetchFaculty]);

  // ── Filtered data ────────────────────────────────────────────────────────
  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const name = (r.room_name || '').toLowerCase();
      const code = (r.room_code || '').toLowerCase();
      const floor = (r.floor_level || '').toLowerCase();
      const dept = (r.department || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      const aliases = (r.aliases || []).join(' ').toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        floor.includes(q) ||
        dept.includes(q) ||
        desc.includes(q) ||
        aliases.includes(q)
      );
    });
  }, [rooms, query]);

  const filteredFaculty = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faculty;
    return faculty.filter((f) => {
      const name = (f.fullName || '').toLowerCase();
      const honorific = (f.honorific || '').toLowerCase();
      const dept = (f.departmentName || f.department || '').toLowerCase();
      const desig = (f.designation || '').toLowerCase();
      const office = (f.office || '').toLowerCase();
      return (
        name.includes(q) ||
        honorific.includes(q) ||
        dept.includes(q) ||
        desig.includes(q) ||
        office.includes(q)
      );
    });
  }, [faculty, query]);

  const catColor = categoryColor(poi.type);

  return (
    <div className="flex h-full flex-col">
      {/* ── Top Bar: Back Button & Sidebar Close ── */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-label font-medium text-fg-muted transition-colors hover:bg-bg-sunken hover:text-fg"
          title="Return to full campus building index"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 text-fg-subtle transition-transform group-hover:-translate-x-0.5 group-hover:text-fg"
            aria-hidden
          />
          <span>Back to Campus Index</span>
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label="Hide sidebar"
          title="Hide sidebar"
          className="btn-icon -mr-1"
        >
          <PanelLeftClose className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* ── Building Header ── */}
      <div className="border-b border-line bg-surface px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-pill"
            style={{ background: catColor, color: 'rgb(var(--cat-ink))' }}
          >
            <PoiGlyph type={poi.type} icon={poi.icon} size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-meta font-semibold leading-snug text-fg">{poi.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-block rounded-pill px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.09em]"
                style={{
                  color: catColor,
                  background: categoryColor(poi.type, 0.16),
                }}
              >
                {poi.type}
              </span>
              {poi.department && (
                <span className="truncate text-label text-fg-subtle">
                  • {poi.department}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab Switcher: Rooms & Facilities vs Faculty & Staff ── */}
        <div className="mt-3.5 flex rounded-lg border border-line bg-bg-sunken p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rooms'}
            onClick={() => { setActiveTab('rooms'); setQuery(''); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-label font-medium transition-all ${
              activeTab === 'rooms'
                ? 'bg-surface text-fg shadow-xs font-semibold'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <DoorOpen className="h-3.5 w-3.5" aria-hidden />
            <span>Rooms</span>
            <span
              className={`ml-1 rounded-pill px-1.5 py-0.2 text-[0.625rem] ${
                activeTab === 'rooms'
                  ? 'bg-accent/15 text-accent font-semibold'
                  : 'bg-bg text-fg-subtle'
              }`}
            >
              {rooms.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'faculty'}
            onClick={() => { setActiveTab('faculty'); setQuery(''); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-label font-medium transition-all ${
              activeTab === 'faculty'
                ? 'bg-surface text-fg shadow-xs font-semibold'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden />
            <span>Faculty</span>
            <span
              className={`ml-1 rounded-pill px-1.5 py-0.2 text-[0.625rem] ${
                activeTab === 'faculty'
                  ? 'bg-accent/15 text-accent font-semibold'
                  : 'bg-bg text-fg-subtle'
              }`}
            >
              {faculty.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── Search bar inside building directory ── */}
      <div className="border-b border-line px-4 py-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeTab === 'rooms'
                ? 'Search rooms, labs, floors…'
                : 'Search faculty, teachers, titles…'
            }
            aria-label={
              activeTab === 'rooms'
                ? 'Search rooms in this building'
                : 'Search faculty in this building'
            }
            className="input min-h-[2.125rem] border-transparent bg-bg-sunken pl-8 pr-8 text-label"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-fg-subtle transition-colors hover:text-fg"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable Tab Content ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        {/* ROOMS TAB */}
        {activeTab === 'rooms' && (
          <div>
            {loadingRooms && rooms.length === 0 && <SkeletonRows rows={5} />}

            {!loadingRooms && filteredRooms.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-line bg-bg-sunken text-fg-subtle">
                  <DoorOpen className="h-5 w-5" aria-hidden />
                </div>
                <p className="mt-3 text-meta font-medium text-fg">
                  {query ? 'No matching rooms' : 'No rooms registered for this facility'}
                </p>
                <p className="mt-1 text-label text-fg-muted">
                  {query
                    ? 'Try searching with another keyword or room code.'
                    : 'Internal rooms and laboratories for this building have not been added yet.'}
                </p>
              </div>
            )}

            {!loadingRooms && filteredRooms.length > 0 && (
              <ul className="space-y-2.5" aria-label="Building rooms">
                {filteredRooms.map((room) => (
                  <li
                    key={room.id}
                    className="rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong hover:shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-meta font-medium text-fg leading-snug">
                        {room.room_name}
                      </p>
                      {room.floor_level && (
                        <span className="shrink-0 rounded border border-line bg-bg-sunken px-1.5 py-0.5 text-[0.6875rem] font-medium text-fg-muted">
                          {room.floor_level}
                        </span>
                      )}
                    </div>

                    {room.room_code && (
                      <p className="mt-1 font-mono text-[0.75rem] font-medium text-accent">
                        {room.room_code}
                      </p>
                    )}

                    {(room.department || room.description) && (
                      <p className="mt-1 text-label text-fg-muted line-clamp-2">
                        {room.department ? `${room.department} • ` : ''}
                        {room.description || ''}
                      </p>
                    )}

                    {room.aliases && room.aliases.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {room.aliases.map((a) => (
                          <span
                            key={a}
                            className="rounded border border-line/60 bg-bg-sunken px-1.5 py-0.2 text-[0.65rem] text-fg-subtle"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* FACULTY TAB */}
        {activeTab === 'faculty' && (
          <div>
            {loadingFaculty && faculty.length === 0 && <SkeletonRows rows={5} />}

            {!loadingFaculty && filteredFaculty.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-line bg-bg-sunken text-fg-subtle">
                  <GraduationCap className="h-5 w-5" aria-hidden />
                </div>
                <p className="mt-3 text-meta font-medium text-fg">
                  {query ? 'No matching faculty' : 'No faculty records match this department'}
                </p>
                <p className="mt-1 text-label text-fg-muted">
                  {query
                    ? 'Try searching by instructor surname or department title.'
                    : 'Faculty members working in this building or department will appear here once registered.'}
                </p>
              </div>
            )}

            {!loadingFaculty && filteredFaculty.length > 0 && (
              <ul className="space-y-2.5" aria-label="Faculty members">
                {filteredFaculty.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong hover:shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                        <GraduationCap className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-meta font-medium text-fg">
                          {f.honorific ? `${f.honorific} ` : ''}
                          {f.fullName}
                        </p>
                        <p className="mt-0.5 text-label text-fg-muted truncate">
                          {f.designation || 'Faculty'}
                          {f.departmentName || f.department
                            ? ` • ${f.departmentName || f.department}`
                            : ''}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Footer Actions ── */}
      <div className="border-t border-line bg-surface/50 p-3">
        <div className="flex items-center gap-2">
          {onDirections && (
            <button
              type="button"
              onClick={() => onDirections(poi)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-bg py-2 text-label font-medium text-fg transition-colors hover:border-line-strong hover:bg-bg-sunken"
            >
              <CornerUpRight className="h-3.5 w-3.5 text-accent" aria-hidden />
              <span>Directions</span>
            </button>
          )}

          {onAsk && (
            <button
              type="button"
              onClick={() => onAsk(poi)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-bg py-2 text-label font-medium text-fg transition-colors hover:border-line-strong hover:bg-bg-sunken"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-fg-muted" aria-hidden />
              <span>Ask GeoBot</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
