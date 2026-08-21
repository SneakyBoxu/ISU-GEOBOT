import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../frontend-utilities/backendApiClient.js';

/**
 * The campus locations, for the whole landing page.
 *
 * WHY A HOOK AND NOT A HARDCODED NUMBER. The page used to say "Twenty-eight
 * places" in four different sentences. Twenty-eight was true the day it was
 * written and stops being true the first time somebody adds a building through
 * the Campus Location portal — and nothing would have told them, because prose
 * does not fail loudly. The cards and tab counts were already live; only the
 * writing was stale, which is the worst combination: a page correcting itself in
 * one place and contradicting itself in another.
 *
 * Everything countable now comes from here, so the homepage cannot disagree with
 * the database.
 *
 * ONE REQUEST FOR THE PAGE. The hero and the discovery section were each about
 * to call the same endpoint on mount; sharing the result is one fetch instead of
 * two for identical data.
 *
 * IT ALSO REFETCHES WHEN THE TAB COMES BACK. The workflow that actually happens
 * is: add a location in the portal tab, switch back to the landing tab already
 * open beside it. Fetching only on mount means that tab keeps showing the old
 * count until someone thinks to reload, which nobody does — they conclude the
 * page is wrong.
 */

/** Skip a refetch if one landed recently, so alt-tabbing cannot hammer the API. */
const MIN_INTERVAL_MS = 20_000;

export function useCampusLocations() {
  const [pois, setPois] = useState([]);
  const [state, setState] = useState('loading');

  const aliveRef = useRef(true);
  const lastLoadedRef = useRef(0);

  const load = useCallback(async () => {
    lastLoadedRef.current = Date.now();
    try {
      const d = await api.pois();
      if (!aliveRef.current) return;
      setPois(d.pois ?? []);
      setState('ready');
    } catch {
      if (!aliveRef.current) return;
      // Only the FIRST load can fail into an error state. A background refetch
      // that fails leaves the existing list on screen — blanking twenty-eight
      // cards because a revalidation timed out is worse than showing data that
      // is a minute old.
      setState((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    load();

    // `visibilitychange`, not `focus`. Focus also fires on returning from a
    // devtools panel or an alert, and on every window activation; the tab
    // actually becoming visible is the event of interest, and it fires once.
    const onVisible = () => {
      if (document.hidden) return;
      if (Date.now() - lastLoadedRef.current < MIN_INTERVAL_MS) return;
      load();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      aliveRef.current = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const categories = useMemo(
    () => new Set(pois.map((p) => p.type).filter(Boolean)).size,
    [pois],
  );

  return { pois, count: pois.length, categories, state, reload: load };
}
