import React, { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import LandingMainPage from './components/landing-page/LandingMainPage.jsx';
import LoadingSpinnerOverlay from './components/shared-components/LoadingSpinnerOverlay.jsx';

// Audit F-12 / W4: the guard dashboard is lazy-loaded so its code and query
// shapes are not shipped inside the bundle every anonymous visitor downloads.
const MainAssistantWorkspace = lazy(() => import('./components/main-assistant/MainAssistantWorkspace.jsx'));
const SecurityGuardAttendanceDashboard = lazy(() => import('./components/security-guard-portal/SecurityGuardAttendanceDashboard.jsx'));
const FacultyAnswerValidationList = lazy(() => import('./components/faculty-validation-portal/FacultyAnswerValidationList.jsx'));
const CampusLocationManager = lazy(() => import('./components/admin-portal/CampusLocationManager.jsx'));
const AdminDashboard = lazy(() => import('./components/admin-portal/AdminDashboard.jsx'));
const UploadAnnouncementPage = lazy(() => import('./components/announcements/UploadAnnouncementPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinnerOverlay />}>
      <Routes>
        <Route path="/" element={<LandingMainPage />} />
        <Route path="/app" element={<MainAssistantWorkspace />} />
        <Route path="/guard" element={<SecurityGuardAttendanceDashboard />} />
        <Route path="/validate" element={<FacultyAnswerValidationList />} />
        <Route path="/admin" element={<CampusLocationManager />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/upload-announcement" element={<UploadAnnouncementPage />} />
        <Route path="*" element={<LandingMainPage />} />
      </Routes>
    </Suspense>
  );
}
