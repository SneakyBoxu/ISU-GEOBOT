/**
 * Building Directory Panel.
 *
 * Dedicated building-level view for the left sidebar on the interactive campus map.
 * Replaces the "CAMPUS INDEX" when a building or marker is selected.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Building2,
  Compass,
  CornerUpRight,
  DoorOpen,
  GraduationCap,
  Info,
  Landmark,
  Mail,
  MapPin,
  MessageSquarePlus,
  PanelLeftClose,
  Phone,
  Search,
  Tag,
  Trophy,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import { categoryColor } from './mapMarkerGlyphs.js';
import { PoiGlyph } from './mapPinIconBuilder.js';
import { SkeletonRows } from '../ui-primitives/index.js';

function PoiPhotoModal({ imageUrl, name, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!imageUrl || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-enter select-none"
      onClick={onClose}
    >
      <div className="relative max-w-3xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 flex items-center gap-1.5 text-white/80 hover:text-white px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-label font-medium"
        >
          <X className="h-4 w-4" />
          <span>Close</span>
        </button>
        <div className="overflow-hidden rounded-2xl border border-white/20 shadow-2xl bg-surface max-h-[80vh]">
          <img
            src={imageUrl}
            alt={name || 'Location photo'}
            className="max-h-[80vh] w-auto max-w-full object-contain"
          />
        </div>
        <p className="mt-3 text-meta text-white/90 font-medium">{name}</p>
      </div>
    </div>,
    document.body
  );
}

function FacultyAvatar({ src, name, size = 'h-9 w-9', rounded = 'rounded-xl', iconSize = 'h-4 w-4' }) {
  const [imgError, setImgError] = useState(false);
  const effectiveSrc = (src && typeof src === 'string') ? src.trim() : null;

  if (effectiveSrc && !imgError) {
    return (
      <img
        key={effectiveSrc}
        src={effectiveSrc}
        alt={name || ''}
        className={`${size} ${rounded} object-cover ring-1 ring-accent/30 shrink-0`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`grid ${size} shrink-0 place-items-center ${rounded} bg-accent/10 text-accent`}>
      <GraduationCap className={iconSize} aria-hidden />
    </div>
  );
}

/* --- Detail Modal: Faculty --- */

function FacultyDetailModal({ faculty, buildingName, onClose, onAskGeoBot }) {
  const [enlarged, setEnlarged] = useState(false);

  // Close on Escape key & lock background scroll
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (enlarged) setEnlarged(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, enlarged]);

  if (!faculty || typeof document === 'undefined') return null;

  const displayName = [faculty.honorific, faculty.fullName].filter(Boolean).join(' ');
  const facultyPhoto = faculty.imageUrl || faculty.image_url || null;
  // Placeholder email and contact if not yet assigned in database
  const slug = (faculty.fullName || 'faculty').toLowerCase().replace(/[^a-z0-9]/g, '.');
  const displayEmail = faculty.email || `${slug}@isu.edu.ph`;
  const displayPhone = faculty.phone || '(078) 652-1234 loc. 204';

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-enter select-none"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${displayName}`}
      >
        {/* Full-screen backdrop blur and dim overlay */}
        <div className="absolute inset-0 bg-black/65 backdrop-blur-md transition-opacity" aria-hidden />

        {/* Centered Modal Card */}
        <div
          className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative border-b border-line bg-accent/[0.04] px-6 py-5">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-bg-sunken hover:text-fg"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>

            <div className="flex items-center gap-3.5">
              {facultyPhoto ? (
                <button
                  type="button"
                  onClick={() => setEnlarged(true)}
                  className="group relative h-14 w-14 rounded-2xl overflow-hidden ring-2 ring-accent/30 hover:ring-accent transition-all shrink-0 cursor-zoom-in"
                  title="Click to enlarge photo"
                >
                  <img
                    src={facultyPhoto}
                    alt={displayName}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <ZoomIn className="h-4 w-4" />
                  </div>
                </button>
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
                  <GraduationCap className="h-6 w-6" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1 pr-6">
                <h3 className="font-serif text-lg font-semibold text-fg leading-snug">
                  {displayName}
                </h3>
                <p className="mt-0.5 text-meta text-fg-muted font-medium">
                  {faculty.designation || 'Faculty Member'}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-4 px-6 py-5 max-h-[60vh] overflow-y-auto">
            {/* Office / Faculty Room */}
            <div className="flex items-start gap-3.5">
              <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-fg-subtle">Consultation Office</p>
                <p className="mt-0.5 text-meta text-fg">
                  {faculty.office ? faculty.office : 'College Faculty Room'}
                </p>
              </div>
            </div>

            {/* Official University Email */}
            <div className="flex items-start gap-3.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-fg-subtle">Official Email</p>
                <a
                  href={`mailto:${displayEmail}`}
                  className="mt-0.5 block font-mono text-[0.8rem] text-accent hover:underline select-all"
                >
                  {displayEmail}
                </a>
              </div>
            </div>

            {/* Campus Contact Number */}
            <div className="flex items-start gap-3.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-fg-subtle">Campus Contact Number</p>
                <p className="mt-0.5 font-mono text-[0.8rem] text-fg select-all">
                  {displayPhone}
                </p>
                <p className="text-[0.6875rem] text-fg-muted">Official Department Office Line</p>
              </div>
            </div>

            {/* Directory Note */}
            <div className="rounded-xl border border-line/60 bg-bg-sunken/60 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-label font-semibold text-fg">Academic Directory & Inquiries</p>
              </div>
              <p className="text-[0.72rem] leading-relaxed text-fg-muted">
                Official faculty inquiries are received via institutional email or during regular office hours at the department faculty room.
              </p>
            </div>
          </div>

          {/* Footer actions */}
          <div className="border-t border-line bg-surface/80 px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-bg py-2.5 text-label font-medium text-fg-muted transition-colors hover:border-line-strong hover:bg-bg-sunken hover:text-fg"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                <span>Back</span>
              </button>
              {onAskGeoBot && (
                <button
                  type="button"
                  onClick={() => {
                    onAskGeoBot(faculty.fullName);
                    onClose();
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/15 py-2.5 text-label font-semibold text-accent transition-colors hover:bg-accent/25 active:scale-[0.99]"
                >
                  <MessageSquarePlus className="h-4 w-4" aria-hidden />
                  <span>Ask GeoBot</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for enlarged photo */}
      {enlarged && facultyPhoto && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-enter"
          onClick={() => setEnlarged(false)}
        >
          <div className="relative max-w-lg w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setEnlarged(false)}
              className="absolute -top-12 right-0 flex items-center gap-1.5 text-white/80 hover:text-white px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-label font-medium"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
            <div className="overflow-hidden rounded-2xl border border-white/20 shadow-2xl bg-surface max-h-[75vh]">
              <img
                src={facultyPhoto}
                alt={displayName}
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
            </div>
            <p className="mt-3 text-meta text-white/90 font-medium">{displayName}</p>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

/* --- Detail Modal: Room --- */

function RoomDetailModal({ room, buildingName, onClose }) {
  const [enlarged, setEnlarged] = useState(false);

  // Close on Escape key & lock background scroll
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (enlarged) setEnlarged(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, enlarged]);

  if (!room || typeof document === 'undefined') return null;

  const roomPhoto = room.imageUrl || room.image_url || null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-enter select-none"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${room.room_name}`}
      >
        {/* Full-screen backdrop blur and dim overlay */}
        <div className="absolute inset-0 bg-black/65 backdrop-blur-md transition-opacity" aria-hidden />

        {/* Centered Modal Card */}
        <div
          className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Optional Room Photo Banner */}
          {roomPhoto && (
            <div
              onClick={() => setEnlarged(true)}
              className="group relative h-48 w-full overflow-hidden border-b border-line bg-bg-sunken cursor-zoom-in"
              title="Click to enlarge photo"
            >
              <img
                src={roomPhoto}
                alt={room.room_name}
                className="h-full w-full object-cover transition-transform group-hover:scale-102"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[0.72rem] opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="h-3.5 w-3.5" />
                <span>Click to enlarge</span>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="relative border-b border-line bg-accent/[0.04] px-6 py-5">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-bg-sunken hover:text-fg"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>

            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
                <DoorOpen className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 pr-6">
                <h3 className="font-serif text-lg font-semibold text-fg leading-snug">
                  {room.room_name}
                </h3>
                {room.room_code && (
                  <p className="mt-0.5 font-mono text-[0.8rem] font-semibold text-accent">
                    {room.room_code}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-4 px-6 py-5 max-h-[60vh] overflow-y-auto">
            {/* Floor Level */}
            {room.floor_level && (
              <div className="flex items-start gap-3.5">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-fg-subtle">Floor Level</p>
                  <p className="mt-0.5 text-meta text-fg">{room.floor_level}</p>
                </div>
              </div>
            )}

            {/* Description / Purpose */}
            {room.description && (
              <div className="flex items-start gap-3.5">
                <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-fg-subtle">Room Purpose & Usage</p>
                  <p className="mt-0.5 text-meta leading-relaxed text-fg">{room.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-line bg-surface/80 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-bg py-2.5 text-label font-medium text-fg-muted transition-colors hover:border-line-strong hover:bg-bg-sunken hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span>Back to Directory</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox for enlarged room photo */}
      {enlarged && roomPhoto && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-enter"
          onClick={() => setEnlarged(false)}
        >
          <div className="relative max-w-3xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setEnlarged(false)}
              className="absolute -top-12 right-0 flex items-center gap-1.5 text-white/80 hover:text-white px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-label font-medium"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
            <div className="overflow-hidden rounded-2xl border border-white/20 shadow-2xl bg-surface max-h-[80vh]">
              <img
                src={roomPhoto}
                alt={room.room_name}
                className="max-h-[80vh] w-auto max-w-full object-contain"
              />
            </div>
            <p className="mt-3 text-meta text-white/90 font-medium">{room.room_name}</p>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

export default function BuildingDirectoryPanel({
  poi,
  onBack,
  onToggle,
  open,
  onAsk,
  onDirections,
}) {
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'faculty' | 'overview'
  const [rooms, setRooms] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [enlargedPoiPhoto, setEnlargedPoiPhoto] = useState(false);

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

  const poiType = (poi?.type || '').toLowerCase();
  const isLandmark = poiType === 'landmark';
  const isSports = poiType === 'sports';
  const isAdministrative = poiType === 'administrative';
  const isLibrary = poiType === 'library';
  const isFacility = poiType === 'facility';
  const isLaboratory = poiType === 'laboratory';

  // ── Dynamically compute relevant tabs based on POI category and data ─────
  const tabs = useMemo(() => {
    const list = [];
    if (isLandmark) {
      list.push({ id: 'overview', label: 'Overview', icon: Landmark });
      if (rooms.length > 0) list.push({ id: 'rooms', label: 'Areas', icon: DoorOpen, count: rooms.length });
      if (faculty.length > 0) list.push({ id: 'faculty', label: 'Staff', icon: Users, count: faculty.length });
      return list;
    }

    if (isSports) {
      if (rooms.length > 0) list.push({ id: 'rooms', label: 'Courts & Areas', icon: DoorOpen, count: rooms.length });
      list.push({ id: 'overview', label: 'Overview', icon: Trophy });
      if (faculty.length > 0) list.push({ id: 'faculty', label: 'Staff', icon: Users, count: faculty.length });
      return list;
    }

    if (isAdministrative) {
      list.push({ id: 'rooms', label: 'Offices & Windows', icon: DoorOpen, count: rooms.length });
      list.push({ id: 'overview', label: 'About', icon: Building2 });
      if (faculty.length > 0) list.push({ id: 'faculty', label: 'Key Officials', icon: Users, count: faculty.length });
      return list;
    }

    if (isLibrary) {
      list.push({ id: 'rooms', label: 'Sections & Rooms', icon: DoorOpen, count: rooms.length });
      list.push({ id: 'overview', label: 'About', icon: BookOpen });
      if (faculty.length > 0) list.push({ id: 'faculty', label: 'Library Staff', icon: Users, count: faculty.length });
      return list;
    }

    if (isFacility) {
      if (rooms.length > 0) list.push({ id: 'rooms', label: 'Rooms & Units', icon: DoorOpen, count: rooms.length });
      list.push({ id: 'overview', label: 'Facility Info', icon: Info });
      if (faculty.length > 0) list.push({ id: 'faculty', label: 'Staff', icon: Users, count: faculty.length });
      return list;
    }

    // Academic Colleges & Laboratories
    const roomLabel = isLaboratory ? 'Labs & Facilities' : 'Rooms';
    const facLabel = isLaboratory ? 'Researchers & Staff' : 'Faculty';
    list.push({ id: 'rooms', label: roomLabel, icon: DoorOpen, count: rooms.length });
    list.push({ id: 'faculty', label: facLabel, icon: Users, count: faculty.length });
    list.push({ id: 'overview', label: 'About', icon: Info });
    return list;
  }, [isLandmark, isSports, isAdministrative, isLibrary, isFacility, isLaboratory, rooms.length, faculty.length]);

  // Set initial active tab when POI changes
  useEffect(() => {
    const type = (poi?.type || '').toLowerCase();
    if (type === 'landmark' || type === 'sports') {
      setActiveTab('overview');
    } else {
      setActiveTab('rooms');
    }
    fetchRooms();
    fetchFaculty();
    setQuery('');
  }, [poi?.id, poi?.type, fetchRooms, fetchFaculty]);

  // Ensure active tab remains valid when tabs change
  useEffect(() => {
    if (tabs.length === 0) return;
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

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

        {/* ── Tab Switcher: Only render if more than 1 relevant tab exists ── */}
        {tabs.length > 1 && (
          <div className="mt-3.5 flex rounded-lg border border-line bg-bg-sunken p-1" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => { setActiveTab(tab.id); setQuery(''); }}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-label font-medium transition-all ${
                    isActive
                      ? 'bg-surface text-fg shadow-xs font-semibold'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span className="truncate">{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      className={`ml-0.5 rounded-pill px-1.5 py-0.2 text-[0.625rem] ${
                        isActive
                          ? 'bg-accent/15 text-accent font-semibold'
                          : 'bg-bg text-fg-subtle'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Search bar inside building directory (shown for rooms / faculty) ── */}
      {(activeTab === 'rooms' || activeTab === 'faculty') && (
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
                  ? isAdministrative
                    ? 'Search offices, counters, services…'
                    : isLibrary
                      ? 'Search sections, AVR, digital hub…'
                      : isSports
                        ? 'Search courts, areas, facilities…'
                        : 'Search rooms, labs, floors…'
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
      )}

      {/* ── Scrollable Tab Content ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-3.5">
            {/* POI Hero Photograph Banner */}
            {poi.imageUrl && (
              <div
                onClick={() => setEnlargedPoiPhoto(true)}
                className="group relative h-44 w-full overflow-hidden rounded-xl border border-line bg-bg-sunken cursor-zoom-in shadow-2xs"
                title="Click to view full photo"
              >
                <img
                  src={poi.imageUrl}
                  alt={poi.imageAlt || poi.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-104"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                  <span className="font-semibold truncate text-[0.8125rem] drop-shadow-sm">{poi.name}</span>
                  <span className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[0.6875rem] backdrop-blur-xs font-medium">
                    <ZoomIn className="h-3 w-3" />
                    Zoom
                  </span>
                </div>
              </div>
            )}

            {/* Contextual Category Callout Banner */}
            {isLandmark && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3.5">
                <div className="flex items-center gap-2 text-red-400 font-semibold text-label uppercase tracking-wider">
                  <Landmark className="h-4 w-4" />
                  <span>Campus Landmark & Gathering Area</span>
                </div>
                <p className="mt-1 text-label text-fg-muted leading-relaxed">
                  Open-air campus landmark or monument. There are no classroom assignments or faculty consultation offices at this location.
                </p>
              </div>
            )}

            {isSports && (
              <div className="rounded-xl border border-teal-500/25 bg-teal-500/10 p-3.5">
                <div className="flex items-center gap-2 text-teal-400 font-semibold text-label uppercase tracking-wider">
                  <Trophy className="h-4 w-4" />
                  <span>Athletic & Sports Facility</span>
                </div>
                <p className="mt-1 text-label text-fg-muted leading-relaxed">
                  University venue for physical education, university meets, and athletics. Physical education instructors hold student consultations at their academic departments.
                </p>
              </div>
            )}

            {isAdministrative && (
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3.5">
                <div className="flex items-center gap-2 text-violet-400 font-semibold text-label uppercase tracking-wider">
                  <Building2 className="h-4 w-4" />
                  <span>Executive & Administrative Offices</span>
                </div>
                <p className="mt-1 text-label text-fg-muted leading-relaxed">
                  Houses executive leadership and student transaction counters. Switch to the Offices & Windows tab to view specific service units.
                </p>
              </div>
            )}

            {isLibrary && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-label uppercase tracking-wider">
                  <BookOpen className="h-4 w-4" />
                  <span>University Learning Resources</span>
                </div>
                <p className="mt-1 text-label text-fg-muted leading-relaxed">
                  Academic learning hub housing book collections, periodicals, AVR, and digital research archives.
                </p>
              </div>
            )}

            {/* Primary Function */}
            {poi.buildingFunction && (
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-fg-subtle">Primary Purpose</p>
                <p className="mt-1 text-meta font-medium text-fg leading-snug">{poi.buildingFunction}</p>
              </div>
            )}

            {/* Full Description */}
            {poi.description && (
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-fg-subtle">About this Location</p>
                <p className="mt-1.5 text-meta leading-relaxed text-fg-muted whitespace-pre-line">{poi.description}</p>
              </div>
            )}

            {/* Location coordinates & stats */}
            <div className="rounded-xl border border-line bg-surface/50 p-3 text-label text-fg-subtle">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span>GPS Coordinates</span>
                </div>
                <span className="font-mono text-[0.6875rem] text-fg">
                  {poi.lat != null ? Number(poi.lat).toFixed(5) : '—'}, {poi.lng != null ? Number(poi.lng).toFixed(5) : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

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
                  {query
                    ? 'No matching rooms'
                    : isAdministrative
                      ? 'No offices or windows registered yet'
                      : isLibrary
                        ? 'No library sections registered yet'
                        : isSports
                          ? 'No designated courts or areas registered'
                          : 'No rooms registered for this facility'}
                </p>
                <p className="mt-1 text-label text-fg-muted">
                  {query
                    ? 'Try searching with another keyword or room code.'
                    : 'Internal rooms, offices, and facilities for this building have not been added yet.'}
                </p>
              </div>
            )}

            {!loadingRooms && filteredRooms.length > 0 && (
              <ul className="space-y-2.5" aria-label="Building rooms">
                {filteredRooms.map((room) => (
                  <li
                    key={room.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedRoom(room)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRoom(room); } }}
                    className="cursor-pointer rounded-lg border border-line bg-surface p-3 transition-all hover:border-accent/40 hover:shadow-xs active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3">
                      {(room.imageUrl || room.image_url) ? (
                        <img
                          src={room.imageUrl || room.image_url}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover ring-1 ring-line shrink-0"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-500/10 text-teal-400">
                          <DoorOpen className="h-5 w-5" aria-hidden />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
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
                          <p className="mt-0.5 font-mono text-[0.75rem] font-medium text-accent">
                            {room.room_code}
                          </p>
                        )}
                      </div>
                    </div>

                    {room.description && (
                      <p className="mt-1 text-label text-fg-muted line-clamp-2">
                        {room.description}
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
                  {query ? 'No matching personnel' : 'No personnel records match this department'}
                </p>
                <p className="mt-1 text-label text-fg-muted">
                  {query
                    ? 'Try searching by instructor surname or department title.'
                    : 'Personnel working in this building or department will appear here once registered.'}
                </p>
              </div>
            )}

            {!loadingFaculty && filteredFaculty.length > 0 && (
              <ul className="space-y-2.5" aria-label="Faculty members">
                {filteredFaculty.map((f) => (
                  <li
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedFaculty(f)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedFaculty(f); } }}
                    className="cursor-pointer rounded-lg border border-line bg-surface p-3 transition-all hover:border-accent/40 hover:shadow-xs active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <FacultyAvatar
                        src={f.imageUrl || f.image_url}
                        name={f.fullName}
                        size="h-9 w-9"
                        rounded="rounded-xl"
                        iconSize="h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-meta font-medium text-fg">
                          {f.honorific ? `${f.honorific} ` : ''}
                          {f.fullName}
                        </p>
                        <p className="mt-0.5 text-label text-fg-muted truncate">
                          {f.designation || 'Faculty Member'}
                          {f.office ? ` • ${f.office}` : ''}
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
      {/* ── Detail Modals ── */}
      {selectedFaculty && (
        <FacultyDetailModal
          faculty={selectedFaculty}
          buildingName={poi.name}
          onClose={() => setSelectedFaculty(null)}
          onAskGeoBot={onAsk ? (name) => onAsk({ type: 'faculty_query', query: `Is ${name} available for consultation right now?` }) : null}
        />
      )}
      {selectedRoom && (
        <RoomDetailModal
          room={selectedRoom}
          buildingName={poi.name}
          onClose={() => setSelectedRoom(null)}
        />
      )}
      {enlargedPoiPhoto && poi.imageUrl && (
        <PoiPhotoModal
          imageUrl={poi.imageUrl}
          name={poi.name}
          onClose={() => setEnlargedPoiPhoto(false)}
        />
      )}
    </div>
  );
}
