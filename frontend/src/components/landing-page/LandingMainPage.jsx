import { useRef } from 'react';
import TopNavigationBar from '../shared-components/TopNavigationBar.jsx';
import DemoModeNotificationBanner from '../shared-components/DemoModeNotificationBanner.jsx';
import PageFooter from '../shared-components/PageFooter.jsx';
import LandingSystemArchitecture from './LandingSystemArchitecture.jsx';
import LandingCinematicBackdrop from './LandingCinematicBackdrop.jsx';
import LandingScrollRail from './LandingScrollRail.jsx';
import LandingHeroCinematic from './LandingHeroCinematic.jsx';
import { LandingProblemOverStage, LandingPrivacyVeil } from './LandingStageStatements.jsx';
import LandingPipelineStepper from './LandingPipelineStepper.jsx';
import LandingTrackMarquee from './LandingTrackMarquee.jsx';
import LandingScriptedDemo from './LandingScriptedDemo.jsx';
import LandingResearchInstruments from './LandingResearchInstruments.jsx';

/**
 * The landing page.
 *
 * TWO HALVES. The first is written over a moving stage: one particle field that
 * morphs through three shapes as you scroll — the campus, then a retrieval
 * constellation, then a flat veil. Each shape is one of the thesis's three
 * claims, and the section that argues it lands as the shape completes. The
 * second half releases the stage and sets the evidence on ordinary ground,
 * because a marquee, a demo and a table of parameters all want to be read
 * rather than flown over.
 *
 * The stage is a sticky child pulled back over by `-mb-[100vh]`, so the sections
 * scroll across a canvas that stays put. `z-10` on the content keeps it above
 * the field; the scrims inside the backdrop keep it legible.
 *
 * Dark-only, by decision. `data-theme` is an ATTRIBUTE selector in tokens.css,
 * not a `:root` rule — so scoping it to this element gives the whole page the
 * night palette without touching the global preference. The toggle in the nav
 * still governs the app and the portals, and a visitor who prefers light does
 * not lose it everywhere.
 */
export default function Landing() {
  const stageRef = useRef(null);

  return (
    <div data-theme="dark" className="relative min-h-screen bg-bg text-fg">
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
            <LandingHeroCinematic />
            <LandingProblemOverStage />
            <LandingPipelineStepper />
            <LandingPrivacyVeil />
          </div>
        </div>

        <LandingTrackMarquee />
        <LandingScriptedDemo />
        <LandingResearchInstruments />
      </main>

      <PageFooter />
    </div>
  );
}
