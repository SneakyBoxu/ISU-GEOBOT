import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../frontend-utilities/backendApiClient.js';
import TopNavigationBar from '../shared-components/TopNavigationBar.jsx';
import DemoModeNotificationBanner from '../shared-components/DemoModeNotificationBanner.jsx';
import InteractiveCampusMap from './InteractiveCampusMap.jsx';
import PlacesDirectoryDrawer from './PlacesDirectoryDrawer.jsx';
import FloatingChatDock from './FloatingChatDock.jsx';
import {
  CAMPUS_PRESET_GATES, fetchWalkingRoute, getBrowserLocation,
} from '../../frontend-utilities/campusRoutingService.js';

/**
 * The workspace: a full-window map, an index that slides over it, an
 * assistant you call on, and live in-map walking route navigation.
 */
function panelWidthPx() {
  if (typeof window === 'undefined') return 0;
  const w = window.innerWidth;
  if (w >= 1280) return 320;   // xl:w-[20rem]
  if (w >= 1024) return 288;   // lg:w-[18rem]
  if (w >= 768) return 256;    // md:w-[16rem]
  return Math.min(320, w * 0.85);
}

export default function Workspace() {
  const [params, setParams] = useSearchParams();
  const [pois, setPois] = useState([]);
  const [focusId, setFocusId] = useState(params.get('poi'));
  const [draft, setDraft] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768,
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  // Navigation State
  const [navDestination, setNavDestination] = useState(null);
  const [navOrigin, setNavOrigin] = useState(CAMPUS_PRESET_GATES[0]);
  const [navRoute, setNavRoute] = useState(null);
  const [navLoading, setNavLoading] = useState(false);
  const [navError, setNavError] = useState(null);

  const overlayPanel = panelOpen && typeof window !== 'undefined' && window.innerWidth < 768;

  const poiParam = params.get('poi');
  const dirParam = params.get('directions') === 'true' || params.get('nav') === 'true';
  const qParam = params.get('q');

  useEffect(() => {
    api.pois().then((d) => setPois(d.pois ?? [])).catch(() => setPois([]));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pois.filter(
      (p) => (category === 'all' || p.type === category)
        && (!q || p.name.toLowerCase().includes(q)
            || p.department?.toLowerCase().includes(q)
            || p.buildingFunction?.toLowerCase().includes(q)),
    );
  }, [pois, query, category]);

  function focus(id) {
    setFocusId(id);
    setParams(id ? { poi: id } : {}, { replace: true });
    if (typeof window !== 'undefined' && window.innerWidth < 768) setPanelOpen(false);
  }

  function ask(poi) {
    setFocusId(poi.id);
    setParams({ poi: poi.id }, { replace: true });
    setDraft({ text: `Tell me about the ${poi.name}.`, nonce: Date.now() });
    setChatOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) setPanelOpen(false);
  }

  function clearFocus() {
    setFocusId(null);
    setParams({}, { replace: true });
  }

  function select(id) {
    if (!id) return clearFocus();
    setFocusId(id);
    setParams({ poi: id }, { replace: true });
    if (typeof window !== 'undefined' && window.innerWidth < 768) setPanelOpen(false);
    return undefined;
  }

  // --- In-Map Navigation Handlers ---
  const handleStartDirections = useCallback(async (destinationPoi, optionalOrigin = null) => {
    if (!destinationPoi) return;

    const targetPoi = typeof destinationPoi === 'string'
      ? pois.find((p) => p.id === destinationPoi || p.slug === destinationPoi)
      : destinationPoi;

    if (!targetPoi) return;

    setNavDestination(targetPoi);
    setFocusId(targetPoi.id);

    const origin = optionalOrigin ?? navOrigin ?? CAMPUS_PRESET_GATES[0];
    setNavOrigin(origin);
    setNavLoading(true);
    setNavError(null);

    try {
      const route = await fetchWalkingRoute(origin, targetPoi);
      setNavRoute(route);
    } catch (err) {
      setNavError(err.message || 'Could not calculate walking path');
    } finally {
      setNavLoading(false);
    }

    if (typeof window !== 'undefined' && window.innerWidth < 768) setPanelOpen(false);
  }, [pois, navOrigin]);

  useEffect(() => {
    if (poiParam) {
      setFocusId(poiParam);
      if (dirParam && pois.length > 0) {
        handleStartDirections(poiParam);
      }
    }
  }, [poiParam, dirParam, pois, handleStartDirections]);

  useEffect(() => {
    if (qParam) {
      setDraft({ text: qParam, nonce: Date.now() });
      setChatOpen(true);
    }
  }, [qParam]);

  const handleChangeOrigin = useCallback(async (newOrigin) => {
    if (!newOrigin) return;
    setNavOrigin(newOrigin);
    if (!navDestination) return;

    setNavLoading(true);
    setNavError(null);
    try {
      const route = await fetchWalkingRoute(newOrigin, navDestination);
      setNavRoute(route);
    } catch (err) {
      setNavError(err.message || 'Could not calculate walking path');
    } finally {
      setNavLoading(false);
    }
  }, [navDestination]);

  const handleUseGpsOrigin = useCallback(async () => {
    setNavLoading(true);
    setNavError(null);
    try {
      const userLoc = await getBrowserLocation();
      setNavOrigin(userLoc);
      if (navDestination) {
        const route = await fetchWalkingRoute(userLoc, navDestination);
        setNavRoute(route);
      }
    } catch (err) {
      setNavError(err.message || 'Could not obtain GPS location');
    } finally {
      setNavLoading(false);
    }
  }, [navDestination]);

  const handleClearNavigation = useCallback(() => {
    setNavDestination(null);
    setNavRoute(null);
    setNavError(null);
    setNavLoading(false);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg">
      <TopNavigationBar />
      <DemoModeNotificationBanner />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full">
          <PlacesDirectoryDrawer
            pois={pois}
            visible={visible}
            focusId={focusId}
            navDestinationId={navDestination?.id}
            onSelect={select}
            onAsk={ask}
            onDirections={handleStartDirections}
            open={panelOpen}
            onToggle={() => setPanelOpen((v) => !v)}
            query={query}
            onQueryChange={setQuery}
            category={category}
            onCategoryChange={setCategory}
          />
          <InteractiveCampusMap
            pois={pois}
            visible={visible}
            focusId={focusId}
            onSelect={select}
            onClear={clearFocus}
            onAsk={ask}
            onDirections={handleStartDirections}
            focusOffsetX={overlayPanel ? panelWidthPx() : 0}
            navDestination={navDestination}
            navOrigin={navOrigin}
            navRoute={navRoute}
            navLoading={navLoading}
            navError={navError}
            onClearNavigation={handleClearNavigation}
            onSetOrigin={handleChangeOrigin}
            onUseGpsOrigin={handleUseGpsOrigin}
          />
        </div>
      </div>

      <FloatingChatDock
        open={chatOpen}
        onToggle={() => setChatOpen((v) => !v)}
        onPoiFocus={focus}
        onDirections={handleStartDirections}
        draft={draft}
      />
    </div>
  );
}
