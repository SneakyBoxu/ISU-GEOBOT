import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import TopNavigationBar from '../shared-components/TopNavigationBar.jsx';
import DemoModeNotificationBanner from '../shared-components/DemoModeNotificationBanner.jsx';
import PageFooter from '../shared-components/PageFooter.jsx';

import { useCampusLocations } from '../../custom-react-hooks/useCampusLocations.js';
import LandingSystemArchitecture from './LandingSystemArchitecture.jsx';

// The dock reaches supabase-js through the chat panel — around 58KB gzipped —
// and nobody has asked it a question yet on first paint. Lazy, so the homepage
// does not carry an auth client it may never use. It loads the moment the
// button is pressed, which is well inside the time it takes to read the panel.
const ChatDock = lazy(() => import('../main-assistant/FloatingChatDock.jsx'));
import LandingCinematicBackdrop from './LandingCinematicBackdrop.jsx';
import LandingScrollRail from './LandingScrollRail.jsx';
import LandingHeroCinematic from './LandingHeroCinematic.jsx';
import LandingStudentValue from './LandingStudentValue.jsx';
import LandingAskAssistant from './LandingAskAssistant.jsx';
import LandingCampusDiscovery from './LandingCampusDiscovery.jsx';
import LandingPrivacyPromise from './LandingPrivacyPromise.jsx';
import LandingResearchInstruments from './LandingResearchInstruments.jsx';

/**
 * The landing page.
 *
 * STUDENT FIRST, THESIS SECOND. The order is deliberate: what you can do, how
 * to do it, what is on campus, what stays private — and only then the
 * architecture. Someone looking for the Registrar gets an answer before they
 * are asked to care about embeddings, and a panel reading the same page still
 * finds every technical claim, in one place, further down.
 *
 * THE ASSISTANT IS HERE, not only in the workspace. A homepage that tells you
 * to go somewhere else to try the thing it is describing has wasted the moment
 * of interest. The dock is the same component the workspace uses, so there is
 * one chat implementation rather than a landing-page imitation of one.
 *
 * The stage is a sticky child pulled back over by `-mb-[100vh]`, so the first
 * sections scroll across a campus plan that stays put. `z-10` on the content
 * keeps it above; the scrims inside the backdrop keep it legible.
 *
 * THEMED, NOT DARK-LOCKED. This carried a hardcoded `data-theme="dark"`, an
 * attribute selector that beat the root attribute for everything inside — so
 * the toggle in the nav appeared to do nothing here. The landing now inherits
 * the document theme like every other route.
 */
export default function Landing() {
  const stageRef = useRef(null);
  // One fetch for the page. Every count on it is derived from this.
  const { pois, count, categories } = useCampusLocations();
  const [chatOpen, setChatOpen] = useState(false);
  // The bubble has to be VISIBLE from the start — that is the whole point of a
  // floating assistant — but it must not cost anything on first paint. So it
  // mounts once the browser is idle: off the critical path, and in place long
  // before anyone has finished reading the hero.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback;
    const id = idle
      ? idle(() => setMounted(true), { timeout: 2500 })
      : setTimeout(() => setMounted(true), 1200);
    return () => (idle ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  function openAssistant() {
    setMounted(true);
    setChatOpen(true);
  }

  return (
    <div className="relative min-h-screen bg-bg text-fg">
      <LandingSystemArchitecture />
      <a href="#main" className="skip-link">Skip to content</a>
      <TopNavigationBar />
      <DemoModeNotificationBanner />
      <LandingScrollRail />

      <main id="main">
        <div ref={stageRef} className="relative">
          <div className="-mb-[100vh]">
            <LandingCinematicBackdrop scrollHostRef={stageRef} />
          </div>

          <div className="relative z-10">
            <LandingHeroCinematic onAskAssistant={openAssistant} count={count} categories={categories} />
            <LandingStudentValue />
            <LandingAskAssistant onAskAssistant={openAssistant} />
          </div>
        </div>

        <LandingCampusDiscovery pois={pois} />
        <LandingPrivacyPromise />
        <LandingResearchInstruments count={count} />
      </main>

      <PageFooter />

      {/* Kept mounted once it appears, so the conversation survives closing
          and reopening the panel. */}
      {mounted && (
        <Suspense fallback={null}>
          <ChatDock open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
        </Suspense>
      )}
    </div>
  );
}
