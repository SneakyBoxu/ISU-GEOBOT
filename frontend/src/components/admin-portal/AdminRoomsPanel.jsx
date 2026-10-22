/**
 * Rooms & Facilities panel for the unified Admin Dashboard.
 *
 * Left sidebar: lists registered buildings (from campus_locations/poi) with
 *   building name, category badge, and room count.
 * Right panel: shows selected building's rooms in a table, with Add/Delete actions.
 * Add Room modal: a slide-over drawer with all room fields.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Building2, DoorOpen, Plus, Search, Trash2, X, ChevronRight, Users, GraduationCap, Pencil,
  Upload, ImagePlus, Loader2, Crop, Check, Info, Landmark, Trophy,
} from 'lucide-react';
import { api } from '../../frontend-utilities/backendApiClient.js';
import {
  Alert, Button, EmptyState, Field, Input, Select, SkeletonRows, Textarea,
} from '../ui-primitives/index.js';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

function FacultyAvatar({ src, name, size = 'h-8 w-8', iconSize = 'h-4 w-4' }) {
  const [imgError, setImgError] = useState(false);
  const effectiveSrc = (src && typeof src === 'string') ? src.trim() : null;

  if (effectiveSrc && !imgError) {
    return (
      <img
        key={effectiveSrc}
        src={effectiveSrc}
        alt={name || ''}
        className={`${size} rounded-full object-cover border border-accent/20 bg-bg-sunken shrink-0`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`flex ${size} items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent shrink-0`}>
      <GraduationCap className={iconSize} />
    </div>
  );
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downscale(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE / image.width, MAX_EDGE / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve({
        base64: out.split(',')[1],
        preview: out,
      });
    };
    image.onerror = () => reject(new Error('That file could not be read as an image.'));
    image.src = dataUrl;
  });
}

function ImageCropModal({ imageSrc, isCircle = false, label = 'Photo', onDone, onCancel }) {
  const [aspect, setAspect] = useState(isCircle ? 1 : 16 / 9);
  const [crop, setCrop] = useState(null);
  const imgRef = useRef(null);

  const initCrop = useCallback((img, targetAspect) => {
    if (!img) return;
    const { width, height } = img;
    const a = targetAspect !== undefined ? targetAspect : aspect;
    if (!a) {
      setCrop({ unit: '%', x: 5, y: 5, width: 90, height: 90 });
      return;
    }
    const targetW = Math.min(width * 0.9, height * 0.9 * a);
    const targetH = targetW / a;
    setCrop({
      unit: '%',
      x: ((width - targetW) / 2 / width) * 100,
      y: ((height - targetH) / 2 / height) * 100,
      width: (targetW / width) * 100,
      height: (targetH / height) * 100,
    });
  }, [aspect]);

  const handleImageLoad = (e) => {
    initCrop(e.currentTarget, aspect);
  };

  const handleAspectChange = (newAspect) => {
    setAspect(newAspect);
    if (imgRef.current) {
      initCrop(imgRef.current, newAspect);
    }
  };

  const resetFull = () => {
    setAspect(null);
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  };

  const applyCrop = () => {
    const image = imgRef.current;
    if (!image || !crop?.width || !crop?.height) {
      onDone(imageSrc);
      return;
    }

    const box = crop.unit === '%'
      ? {
        x: (crop.x / 100) * image.width,
        y: (crop.y / 100) * image.height,
        width: (crop.width / 100) * image.width,
        height: (crop.height / 100) * image.height,
      }
      : crop;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const sourceX = Math.max(0, box.x * scaleX);
    const sourceY = Math.max(0, box.y * scaleY);
    const sourceWidth = Math.min(image.naturalWidth - sourceX, box.width * scaleX);
    const sourceHeight = Math.min(image.naturalHeight - sourceY, box.height * scaleY);

    const maxOutEdge = 1600;
    const outputScale = Math.min(1, maxOutEdge / sourceWidth, maxOutEdge / sourceHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
    canvas.height = Math.max(1, Math.round(sourceHeight * outputScale));

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, canvas.width, canvas.height,
    );

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.90);
    onDone(croppedDataUrl);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-enter select-none"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-2xl flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5 text-fg">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">
              <Crop className="h-4 w-4" />
            </div>
            <div>
              <p className="text-meta font-semibold text-fg">Crop {label}</p>
              <p className="text-[0.75rem] text-fg-subtle">
                Frame what should be displayed in the directory & cards
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded-lg text-fg-subtle hover:bg-bg-sunken hover:text-fg transition-colors"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {/* Aspect Ratio Options */}
        <div className="flex items-center gap-2">
          <span className="text-[0.72rem] font-medium text-fg-subtle uppercase tracking-wider">Format:</span>
          {isCircle ? (
            <>
              <button
                type="button"
                onClick={() => handleAspectChange(1)}
                className={`px-2.5 py-1 rounded-md text-label font-medium transition-colors ${
                  aspect === 1 ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-bg-sunken text-fg-subtle hover:text-fg border border-line'
                }`}
              >
                1:1 (Avatar)
              </button>
              <button
                type="button"
                onClick={() => handleAspectChange(null)}
                className={`px-2.5 py-1 rounded-md text-label font-medium transition-colors ${
                  aspect === null ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-bg-sunken text-fg-subtle hover:text-fg border border-line'
                }`}
              >
                Freeform
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleAspectChange(16 / 9)}
                className={`px-2.5 py-1 rounded-md text-label font-medium transition-colors ${
                  aspect === 16 / 9 ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-bg-sunken text-fg-subtle hover:text-fg border border-line'
                }`}
              >
                16:9 Banner
              </button>
              <button
                type="button"
                onClick={() => handleAspectChange(4 / 3)}
                className={`px-2.5 py-1 rounded-md text-label font-medium transition-colors ${
                  aspect === 4 / 3 ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-bg-sunken text-fg-subtle hover:text-fg border border-line'
                }`}
              >
                4:3 Standard
              </button>
              <button
                type="button"
                onClick={() => handleAspectChange(null)}
                className={`px-2.5 py-1 rounded-md text-label font-medium transition-colors ${
                  aspect === null ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-bg-sunken text-fg-subtle hover:text-fg border border-line'
                }`}
              >
                Freeform
              </button>
            </>
          )}
        </div>

        {/* Cropping Area */}
        <div className="flex h-[48vh] min-h-[250px] items-center justify-center overflow-hidden rounded-xl bg-black/50 border border-line p-2">
          <ReactCrop
            crop={crop}
            onChange={(pixelCrop) => setCrop(pixelCrop)}
            aspect={aspect}
            circularCrop={isCircle && aspect === 1}
            keepSelection
            className="max-h-[44vh] max-w-full"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop target"
              onLoad={handleImageLoad}
              className="max-h-[44vh] w-auto max-w-full object-contain block"
            />
          </ReactCrop>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-line">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line bg-bg py-2.5 text-label font-medium text-fg-muted hover:bg-bg-sunken hover:text-fg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={resetFull}
            className="flex-1 rounded-xl border border-line bg-bg py-2.5 text-label font-medium text-fg-muted hover:bg-bg-sunken hover:text-fg transition-colors"
          >
            Select Full
          </button>
          <button
            type="button"
            onClick={applyCrop}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-label font-semibold text-white shadow-xs hover:opacity-90 active:scale-[0.99] transition-all"
          >
            <Check className="h-4 w-4" />
            <span>Apply Crop</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PhotoUploader({ value, onChange, folder = 'rooms', token, isCircle = false, label = 'Photo' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const inputRef = useRef(null);

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await readAsDataURL(file);
      // Automatically pop the crop modal upon choosing a file
      setCropSrc(dataUrl);
    } catch (err) {
      setError(err.message || 'Failed to read image file');
    }
  };

  const handleCropDone = async (croppedDataUrl) => {
    setCropSrc(null);
    setError(null);
    setUploading(true);
    // Immediately set preview for instant visual feedback
    onChange(croppedDataUrl);
    try {
      const { base64 } = await downscale(croppedDataUrl);
      if (token) {
        const res = await api.uploadPhoto(token, { contentB64: base64, folder });
        if (res?.imageUrl) {
          onChange(res.imageUrl);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handlePick}
        className="hidden"
      />

      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          isCircle={isCircle}
          label={label}
          onDone={handleCropDone}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {value ? (
        <div className={`flex items-center gap-3.5 p-3 rounded-xl border border-line bg-bg-sunken ${isCircle ? '' : 'flex-col sm:flex-row'}`}>
          <div className={`overflow-hidden border border-line bg-surface shrink-0 ${isCircle ? 'h-16 w-16 rounded-full ring-2 ring-accent/20' : 'h-24 w-full sm:w-36 rounded-lg'}`}>
            <img
              src={value}
              alt="Uploaded preview"
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-label font-medium text-fg hover:bg-bg-sunken transition-colors"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              <span>{uploading ? 'Uploading...' : 'Change photo'}</span>
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => setCropSrc(value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-label font-medium text-fg hover:bg-bg-sunken transition-colors"
              title="Recrop photo"
            >
              <Crop className="h-3.5 w-3.5 text-accent" />
              <span>Crop</span>
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-label font-medium text-error hover:bg-error/10 transition-colors"
              title="Remove photo"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          className="group cursor-pointer flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-4 transition-colors hover:border-accent hover:bg-accent/[0.02]"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent transition-transform group-hover:scale-105">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </div>
          <div className="text-center">
            <p className="text-meta font-medium text-fg">
              {uploading ? 'Processing photo…' : `Click to choose ${label.toLowerCase()}`}
            </p>
            <p className="text-label text-fg-subtle">
              Supports .jpg, .png, .webp image files (with cropping)
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-label text-error">{error}</p>
      )}
    </div>
  );
}

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
  roomName: '', roomCode: '', floorLevel: '', department: '', description: '', aliases: '', imageUrl: '',
};

export default function AdminRoomsPanel({ session }) {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('rooms'); // 'rooms' | 'faculty'
  const [rooms, setRooms] = useState([]);
  const [roomCounts, setRoomCounts] = useState({});  // buildingId -> count
  const [facultyCounts, setFacultyCounts] = useState({}); // buildingId -> count
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
    imageUrl: '',
    email: '',
    phone: '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

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
      setSelectedBuilding((prev) => {
        if (prev && pois.some((p) => p.id === prev.id)) return prev;
        return pois.find((p) => p.slug === 'college-computing') || pois.find((p) => p.poi_type === 'college') || pois[0] || null;
      });

      try {
        const d = await api.adminDepartments(session.access_token);
        setAvailableDepartments(d.departments ?? []);
      } catch {
        // non-blocking
      }

      // Load room and faculty counts for each building in parallel
      const rCounts = {};
      const fCounts = {};
      await Promise.allSettled(
        pois.map(async (b) => {
          const [roomRes, facRes] = await Promise.allSettled([
            api.buildingRooms(b.id, session.access_token),
            api.buildingFaculty(b.id, session.access_token),
          ]);
          rCounts[b.id] = roomRes.status === 'fulfilled' ? (roomRes.value?.rooms ?? []).length : 0;
          fCounts[b.id] = facRes.status === 'fulfilled' ? (facRes.value?.faculty ?? []).length : 0;
        })
      );
      setRoomCounts(rCounts);
      setFacultyCounts(fCounts);
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
      imageUrl: room.imageUrl || room.image_url || '',
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
      imageUrl: '',
      email: '',
      phone: '',
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
      imageUrl: f.imageUrl || f.image_url || '',
      email: f.email || '',
      phone: f.phone || '',
    });
    setMsg(null);
    setShowFacultyModal(true);
  };

  const closeFacultyModal = () => {
    setShowFacultyModal(false);
    setEditingFaculty(null);
    setFacultyForm({ fullName: '', honorific: 'Prof.', designation: 'Faculty', office: '', departmentName: '', aliases: '', imageUrl: '', email: '', phone: '' });
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
        imageUrl:    form.imageUrl?.trim() || null,
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
        email: facultyForm.email?.trim() || null,
        phone: facultyForm.phone?.trim() || null,
        departmentName: facultyForm.departmentName.trim() || null,
        aliases: facultyForm.aliases ? facultyForm.aliases.split(',').map((s) => s.trim()).filter(Boolean) : [],
        imageUrl: facultyForm.imageUrl?.trim() || null,
      };

      if (editingFaculty) {
        const res = await api.adminUpdateFaculty(session.access_token, editingFaculty.id, payload);
        setMsg({ kind: 'ok', text: `Faculty member "${facultyForm.fullName}" updated successfully.` });
        if (res?.faculty) {
          setBuildingFaculty((prev) =>
            prev.map((item) => (item.id === editingFaculty.id ? { ...item, ...res.faculty } : item))
          );
        }
      } else {
        const res = await api.adminCreateFaculty(session.access_token, {
          ...payload,
          buildingId: selectedBuilding.id,
        });
        setMsg({ kind: 'ok', text: `Faculty member "${facultyForm.fullName}" registered.` });
        setFacultyCounts((prev) => ({ ...prev, [selectedBuilding.id]: (prev[selectedBuilding.id] ?? 0) + 1 }));
        if (res?.faculty) {
          setBuildingFaculty((prev) => [res.faculty, ...prev]);
        }
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
      setFacultyCounts((prev) => ({ ...prev, [selectedBuilding.id]: Math.max(0, (prev[selectedBuilding.id] ?? 1) - 1) }));
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const filteredBuildings = useMemo(() => {
    return buildings.filter((b) => {
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || b.name.toLowerCase().includes(q) || (b.poi_type || '').toLowerCase().includes(q);
      if (!matchesQuery) return false;

      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'colleges') return b.poi_type === 'college';
      if (categoryFilter === 'offices') return b.poi_type === 'administrative' || b.poi_type === 'library';
      if (categoryFilter === 'labs') return b.poi_type === 'laboratory' || b.poi_type === 'facility';
      if (categoryFilter === 'landmarks') return b.poi_type === 'landmark' || b.poi_type === 'sports';
      return true;
    });
  }, [buildings, query, categoryFilter]);

  return (
    <div className="flex h-full w-full min-h-0 gap-0 rounded-xl border border-line overflow-hidden bg-surface shadow-xs">
      {/* ── Left: Building Selector ── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-surface h-full">
        <div className="shrink-0 border-b border-line px-4 py-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-label font-semibold uppercase tracking-widest text-fg-subtle opacity-60">
              Buildings
            </p>
            {filteredBuildings.length > 0 && (
              <span className="text-[0.6875rem] font-medium text-fg-subtle">
                {filteredBuildings.length} shown
              </span>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="mb-2.5 flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'colleges', label: 'Colleges' },
              { id: 'offices', label: 'Offices' },
              { id: 'labs', label: 'Labs' },
              { id: 'landmarks', label: 'Landmarks' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCategoryFilter(f.id)}
                className={`rounded-md px-2 py-0.5 text-[0.6875rem] font-medium transition-colors ${
                  categoryFilter === f.id
                    ? 'bg-accent text-accent-contrast font-semibold shadow-xs'
                    : 'bg-bg-sunken text-fg-muted hover:bg-line/40 hover:text-fg'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

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
            const facCount = facultyCounts[b.id] ?? 0;
            const isLandmark = b.poi_type === 'landmark';
            const isSports = b.poi_type === 'sports';
            const isAcademic = b.poi_type === 'college' || b.poi_type === 'laboratory';

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
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-label text-fg-subtle">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[0.6875rem] font-medium ${catColor}`}>
                      {catLabel}
                    </span>
                    {isLandmark ? (
                      <>
                        <span className="opacity-40">•</span>
                        <span className="text-amber-400/80 font-medium text-[0.6875rem]">Open Landmark</span>
                      </>
                    ) : isSports && count === 0 ? (
                      <>
                        <span className="opacity-40">•</span>
                        <span className="text-teal-400/80 font-medium text-[0.6875rem]">Open Field / Court</span>
                      </>
                    ) : (
                      <>
                        <span className="opacity-40">•</span>
                        <span>{count} {count === 1 ? 'room' : 'rooms'}</span>
                        {(isAcademic || facCount > 0) && (
                          <>
                            <span className="opacity-40">•</span>
                            <span className={facCount > 0 ? 'text-fg-muted font-medium' : ''}>
                              {facCount} faculty
                            </span>
                          </>
                        )}
                      </>
                    )}
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
      <main className="flex min-w-0 flex-1 flex-col bg-bg h-full overflow-hidden">
        {!selectedBuilding ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <EmptyState icon={DoorOpen} title="Select a building">
              Choose a building from the left to view and manage its rooms.
            </EmptyState>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="shrink-0 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4">
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

            {/* Context Notice for Landmarks & Open Fields */}
            {selectedBuilding.poi_type === 'landmark' && (
              <div className="shrink-0 px-6 pt-4">
                <div className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3.5 text-fg">
                  <Landmark className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                  <div className="text-meta">
                    <p className="font-semibold text-red-300">Open-Air Campus Landmark</p>
                    <p className="mt-0.5 text-label text-fg-muted leading-relaxed">
                      Outdoor monuments, gates, and gathering plazas do not usually have indoor classrooms or faculty consultation offices. You can still register specific kiosks, security posts, or event zones below if needed.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {selectedBuilding.poi_type === 'sports' && rooms.length === 0 && (
              <div className="shrink-0 px-6 pt-4">
                <div className="flex items-start gap-3 rounded-xl border border-teal-500/25 bg-teal-500/10 p-3.5 text-fg">
                  <Trophy className="h-5 w-5 shrink-0 text-teal-400 mt-0.5" />
                  <div className="text-meta">
                    <p className="font-semibold text-teal-300">Athletic & Sports Field</p>
                    <p className="mt-0.5 text-label text-fg-muted leading-relaxed">
                      This venue is an open sports field or gym. PE instructors hold student consultations at their academic department. You may add specific courts, bleachers, or locker facilities as rooms below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Status messages */}
            {msg && (
              <div className="shrink-0 px-6 pt-4">
                <Alert tone={msg.kind === 'ok' ? 'success' : 'error'}>{msg.text}</Alert>
              </div>
            )}

            {/* Tab 1: Rooms */}
            {activeSubTab === 'rooms' && (
              <div className="flex-1 overflow-auto px-6 py-6">
                {loadingRooms && rooms.length === 0 && <SkeletonRows rows={4} />}

                {!loadingRooms && rooms.length === 0 && (
                  <EmptyState icon={DoorOpen} title="No rooms yet">
                    {selectedBuilding.poi_type === 'landmark'
                      ? 'Landmarks do not require indoor rooms. You may click Add Room if you wish to register a specific guard post, booth, or gathering zone.'
                      : 'Click Add Room to register the first room in this building.'}
                  </EmptyState>
                )}

                {rooms.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-line">
                    <table className="w-full text-left text-meta">
                      <thead className="border-b border-line bg-bg-sunken">
                        <tr>
                          {['Name', 'Code', 'Floor', 'Description', ''].map((h) => (
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
                              <div className="flex items-center gap-2.5">
                                {(room.image_url || room.imageUrl) ? (
                                  <img
                                    src={room.image_url || room.imageUrl}
                                    alt=""
                                    className="h-8 w-8 rounded-md object-cover border border-line bg-bg-sunken shrink-0"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-bg-sunken text-fg-subtle shrink-0">
                                    <DoorOpen className="h-4 w-4" />
                                  </div>
                                )}
                                <div>
                                  <div>{room.room_name}</div>
                                  {room.aliases && room.aliases.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {room.aliases.map((a) => (
                                        <span key={a} className="inline-flex items-center rounded border border-line px-1.5 py-0.5 text-label text-fg-subtle">
                                          {a}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-data text-fg-muted">
                              {room.room_code ?? <span className="text-fg-subtle">—</span>}
                            </td>
                            <td className="px-4 py-3 text-fg-muted">
                              {room.floor_level ?? <span className="text-fg-subtle">—</span>}
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
                  <EmptyState
                    icon={Users}
                    title={
                      selectedBuilding.poi_type === 'landmark' || selectedBuilding.poi_type === 'sports'
                        ? 'No faculty roster at this location'
                        : 'No faculty registered yet'
                    }
                  >
                    {selectedBuilding.poi_type === 'landmark' || selectedBuilding.poi_type === 'sports'
                      ? 'Outdoor landmarks and sports venues do not have faculty consultation offices. Teaching instructors should be registered under academic colleges.'
                      : 'Click Add Faculty to register professors and instructors working in this department.'}
                  </EmptyState>
                )}

                {buildingFaculty.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-line">
                    <table className="w-full text-left text-meta">
                      <thead className="border-b border-line bg-bg-sunken">
                        <tr>
                          {['Faculty Member', 'Designation', 'Consultation Office', 'Official Email', 'Campus Contact', 'Status', ''].map((h) => (
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
                              <div className="flex items-center gap-2.5">
                                <FacultyAvatar
                                  src={f.imageUrl || f.image_url}
                                  name={f.fullName}
                                  size="h-8 w-8"
                                  iconSize="h-4 w-4"
                                />
                                <span>{f.fullName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-fg-muted font-medium">
                              {f.designation ?? 'Faculty'}
                            </td>
                            <td className="px-4 py-3 text-fg-muted font-mono text-label">
                              {f.office ?? <span className="text-fg-subtle">—</span>}
                            </td>
                            <td className="px-4 py-3 text-fg-muted font-mono text-label">
                              {f.email ? (
                                <span className="text-accent">{f.email}</span>
                              ) : (
                                <span className="text-fg-subtle text-[0.72rem] italic">Auto (@isu.edu.ph)</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-fg-muted font-mono text-label">
                              {f.phone ? (
                                <span>{f.phone}</span>
                              ) : (
                                <span className="text-fg-subtle text-[0.72rem] italic">Campus Line</span>
                              )}
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

                <Field label="Room / Facility Picture" hint="Select an image file from your computer (.jpg, .png, .webp)">
                  {() => (
                    <PhotoUploader
                      value={form.imageUrl}
                      onChange={(url) => set('imageUrl', url)}
                      folder="rooms"
                      token={session?.access_token}
                      isCircle={false}
                      label="Room Photo"
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

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Official Email" hint="e.g. sim01@isu.edu.ph">
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        type="email"
                        maxLength={200}
                        aria-describedby={describedBy}
                        value={facultyForm.email}
                        onChange={(e) => setFac('email', e.target.value)}
                        placeholder="sim01@isu.edu.ph"
                      />
                    )}
                  </Field>
                  <Field label="Campus Contact Number" hint="e.g. (078) 652-1234 loc. 204">
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        maxLength={100}
                        aria-describedby={describedBy}
                        value={facultyForm.phone}
                        onChange={(e) => setFac('phone', e.target.value)}
                        placeholder="(078) 652-1234 loc. 204"
                      />
                    )}
                  </Field>
                </div>

                <Field label="Faculty Portrait Photo" hint="Select a portrait photo or avatar (.jpg, .png, .webp)">
                  {() => (
                    <PhotoUploader
                      value={facultyForm.imageUrl}
                      onChange={(url) => setFac('imageUrl', url)}
                      folder="faculty"
                      token={session?.access_token}
                      isCircle={true}
                      label="Faculty Photo"
                    />
                  )}
                </Field>

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
