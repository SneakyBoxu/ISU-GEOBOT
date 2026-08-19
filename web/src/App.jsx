import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Landing from './components/landing/Landing.jsx';
import Loading from './components/shared/Loading.jsx';

// Audit F-12 / W4: the guard dashboard is lazy-loaded so its code and query
// shapes are not shipped inside the bundle every anonymous visitor downloads.
const Workspace = lazy(() => import('./components/app/Workspace.jsx'));
const GuardDashboard = lazy(() => import('./components/guard/GuardDashboard.jsx'));
const ValidationChecklist = lazy(() => import('./components/validate/ValidationChecklist.jsx'));
const LocationManager = lazy(() => import('./components/admin/LocationManager.jsx'));

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Workspace />} />
        <Route path="/guard" element={<GuardDashboard />} />
        <Route path="/validate" element={<ValidationChecklist />} />
        <Route path="/admin" element={<LocationManager />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </Suspense>
  );
}
