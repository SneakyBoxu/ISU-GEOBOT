import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Map as MapIcon, MessageSquare } from 'lucide-react';
import { api } from '../../lib/api.js';
import Nav from '../shared/Nav.jsx';
import DemoBanner from '../shared/DemoBanner.jsx';
import CampusMap from './CampusMap.jsx';
import ChatInterface from './ChatInterface.jsx';

/**
 * Map left, assistant right.
 *
 * Synchronisation works off the RETRIEVED CONTEXT rather than a second lookup:
 * when an answer is grounded in a place-card, the server returns that poiId and
 * the map moves there. The map therefore follows what actually grounded the
 * answer, instead of a parallel keyword guess that could disagree with the text
 * on screen.
 *
 * On phones the panes become tabs. Thesis §1.3 claims cross-device
 * accessibility, and that is a claim worth being able to demonstrate on a
 * handset in the defense room.
 */
export default function Workspace() {
  const [params, setParams] = useSearchParams();
  const [pois, setPois] = useState([]);
  const [focusId, setFocusId] = useState(params.get('poi'));
  const [tab, setTab] = useState('chat');

  useEffect(() => {
    api.pois().then((d) => setPois(d.pois ?? [])).catch(() => setPois([]));
  }, []);

  function focus(id) {
    setFocusId(id);
    setParams(id ? { poi: id } : {}, { replace: true });
    setTab('map');
  }

  // Clearing drops the deep-link param as well, so a shared URL does not
  // silently re-select on the next render or reload.
  function clearFocus() {
    setFocusId(null);
    setParams({}, { replace: true });
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <Nav />
      <DemoBanner />

      <div className="flex border-b border-line bg-surface md:hidden" role="tablist">
        {[
          { key: 'chat', label: 'Assistant', icon: MessageSquare },
          { key: 'map', label: 'Campus map', icon: MapIcon },
        ].map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-meta font-medium transition-colors duration-state ${
              tab === t.key
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            <t.icon className="h-4 w-4" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[1.05fr_1fr]">
        <div className={`min-h-0 border-line md:border-r ${tab === 'map' ? 'block' : 'hidden md:block'}`}>
          <CampusMap
            pois={pois}
            focusId={focusId}
            onSelect={setFocusId}
            onClear={clearFocus}
          />
        </div>
        <div className={`min-h-0 ${tab === 'chat' ? 'block' : 'hidden md:block'}`}>
          <ChatInterface onPoiFocus={focus} />
        </div>
      </div>
    </div>
  );
}
