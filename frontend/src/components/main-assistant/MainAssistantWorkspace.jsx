import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../frontend-utilities/backendApiClient.js';
import TopNavigationBar from '../shared-components/TopNavigationBar.jsx';
import DemoModeNotificationBanner from '../shared-components/DemoModeNotificationBanner.jsx';
import InteractiveCampusMap from './InteractiveCampusMap.jsx';
import PlacesDirectoryDrawer from './PlacesDirectoryDrawer.jsx';
import FloatingChatDock from './FloatingChatDock.jsx';

/**
 * The workspace: a full-window map, an index that slides over it, and an
 * assistant you call on.
 *
 * It used to be a split pane, map beside chat. That gave half of a 1920px
 * display to a text box nobody had typed in yet, and left the map — the thing
 * this system is about — at 900px on a 355-hectare campus. The map is now the
 * page; the assistant is docked and summoned. Both were always sharing one
 * screen; the question was only which of them is furniture.
 *
 * Three surfaces, three jobs: the index finds a location, the card describes
 * the one you picked, the assistant answers questions about any of them. None
 * of the three can write — editing the map happens only in the Campus Location
 * portal, behind an authenticated role check.
 *
 * Synchronisation still works off the RETRIEVED CONTEXT rather than a second
 * lookup: when an answer is grounded in a place-card, or the assistant names a
 * location the server can verify, the map moves there. The map therefore
 * follows what actually grounded the answer, instead of a parallel keyword
 * guess that could disagree with the text on screen.
 *
 * Search and category state lives HERE rather than in either child, because
 * both of them render it: filtering the index has to filter the markers too, or
 * the count in the corner starts disagreeing with the pins beside it.
 */

// Kept in step with the panel's own responsive widths. Used only to offset the
// map's fly-to so a focused pin does not land underneath the open panel.
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
  // A nonce, not just text: asking about the same building twice in a row must
  // still refill the box, and a bare string compares equal the second time.
  const [draft, setDraft] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  // Open by default only where it does not swallow the map. The panel overlays
  // rather than displaces, so on a phone it would cover the campus entirely.
  // Only meaningful below `md`, where the index is a drawer. At and above it
  // the panel is a permanent column and this state has no effect.
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768,
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  // From `md` up the index is part of the layout, so the map's own box already
  // excludes it and no focus offset is needed. Below `md` it overlays, and a
  // pin flown to the raw coordinate would land behind it.
  const overlayPanel = panelOpen && typeof window !== 'undefined' && window.innerWidth < 768;

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

  // Focus driven by an ANSWER. The map is already the page, so there is no tab
  // to switch — but on a phone the index covers the map, and sending someone to
  // look at a location while a list is over it helps nobody.
  function focus(id) {
    setFocusId(id);
    setParams(id ? { poi: id } : {}, { replace: true });
    if (typeof window !== 'undefined' && window.innerWidth < 768) setPanelOpen(false);
  }

  // Marker or index row -> assistant. The map hands the question over rather
  // than answering it: the map knows where a building is, the assistant knows
  // what it is for, and this is the seam between them. It PRE-FILLS rather than
  // sends, so the user can edit the question before asking it.
  function ask(poi) {
    setFocusId(poi.id);
    setParams({ poi: poi.id }, { replace: true });
    setDraft({ text: `Tell me about the ${poi.name}.`, nonce: Date.now() });
    setChatOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) setPanelOpen(false);
  }

  // Clearing drops the deep-link param as well, so a shared URL does not
  // silently re-select on the next render or reload.
  function clearFocus() {
    setFocusId(null);
    setParams({}, { replace: true });
  }

  function select(id) {
    if (!id) return clearFocus();
    setFocusId(id);
    setParams({ poi: id }, { replace: true });
    // On a phone the index covers the map, and the card this raises is
    // anchored to a pin underneath it. Picking a location is a request to look
    // at it, so the list steps aside.
    if (typeof window !== 'undefined' && window.innerWidth < 768) setPanelOpen(false);
    return undefined;
  }

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
            onSelect={select}
            onAsk={ask}
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
            focusOffsetX={overlayPanel ? panelWidthPx() : 0}
          />
        </div>
      </div>

      <FloatingChatDock
        open={chatOpen}
        onToggle={() => setChatOpen((v) => !v)}
        onPoiFocus={focus}
        draft={draft}
      />
    </div>
  );
}
