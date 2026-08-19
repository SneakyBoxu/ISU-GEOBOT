import Nav from '../shared/Nav.jsx';
import DemoBanner from '../shared/DemoBanner.jsx';
import Footer from '../shared/Footer.jsx';
import Environment from './Environment.jsx';
import Hero from './Hero.jsx';
import Problem from './Problem.jsx';
import Solution from './Solution.jsx';
import HowItWorks from './HowItWorks.jsx';
import Comparison from './Comparison.jsx';
import CampusIndex from './CampusIndex.jsx';
import Privacy from './Privacy.jsx';
import Research from './Research.jsx';
import FinalCta from './FinalCta.jsx';

/**
 * Narrative order: why this exists, what it does, how it works, what it looks
 * like in practice, how it protects people, what is being studied, and then
 * the ask. Each section earns the next; none of them is a feature grid.
 */
export default function Landing() {
  return (
    <div className="relative min-h-screen">
      <Environment />
      <a href="#main" className="skip-link">Skip to content</a>
      <Nav />
      <DemoBanner />
      <main id="main">
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Comparison />
        <CampusIndex />
        <Privacy />
        <Research />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
