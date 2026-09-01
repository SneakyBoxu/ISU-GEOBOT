import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, ClipboardCheck, LayoutDashboard, LogOut, Megaphone, ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { currentSession, signOut } from '../../frontend-utilities/supabaseClient.js';
import PortalLogin from '../shared-components/UserRoleLoginModal.jsx';
import TopNavigationBar from '../shared-components/TopNavigationBar.jsx';
import DemoModeNotificationBanner from '../shared-components/DemoModeNotificationBanner.jsx';

// Lazy-loaded panel content — same components the standalone portals use, but
// wired to accept a session prop so the admin only signs in once.
import CampusLocationsPanel from './AdminCampusLocationsPanel.jsx';
import SecurityPresencePanel from './AdminSecurityPresencePanel.jsx';
import FacultyValidationPanel from './AdminFacultyValidationPanel.jsx';

const TABS = [
  {
    id: 'locations',
    label: 'Campus Locations',
    icon: Building2,
    description: 'Add, edit and publish campus buildings and points of interest.',
    color: 'text-blue-400',
    activeBg: 'bg-blue-500/10 border-blue-500/40',
    activeText: 'text-blue-300',
  },
  {
    id: 'presence',
    label: 'Security Presence',
    icon: ShieldCheck,
    description: 'View the live faculty presence roster logged by security guards.',
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-500/10 border-emerald-500/40',
    activeText: 'text-emerald-300',
  },
  {
    id: 'validation',
    label: 'Faculty Validation',
    icon: ClipboardCheck,
    description: 'Review faculty availability estimate validation entries.',
    color: 'text-violet-400',
    activeBg: 'bg-violet-500/10 border-violet-500/40',
    activeText: 'text-violet-300',
  },
];

export default function AdminDashboard() {
  const [session, setSession] = useState(undefined);
  const [activeTab, setActiveTab] = useState('locations');

  useEffect(() => { currentSession().then((s) => setSession(s ?? null)); }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setSession(null);
  }, []);

  if (session === undefined) return null;

  if (!session) {
    return (
      <PortalLogin
        role="admin"
        icon={LayoutDashboard}
        title="Admin Dashboard"
        description="Sign in with your administrator account to manage campus locations, review security presence logs, and view faculty validation entries."
        onSession={setSession}
      />
    );
  }

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const Icon = currentTab.icon;

  return (
    <div className="min-h-screen bg-bg" style={{ fontFamily: 'inherit' }}>
      <TopNavigationBar />
      <DemoModeNotificationBanner />

      <div className="flex min-h-[calc(100vh-3.75rem)]">
        {/* ── Sidebar ── */}
        <aside
          className="sticky top-[3.75rem] flex h-[calc(100vh-3.75rem)] w-64 shrink-0 flex-col border-r border-line bg-surface"
          style={{ backgroundImage: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg-sunken) 100%)' }}
        >
          {/* Sidebar header */}
          <div className="border-b border-line px-5 py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
                <LayoutDashboard className="h-4 w-4 text-accent" strokeWidth={1.75} aria-hidden />
              </div>
              <div>
                <p className="text-label font-semibold text-fg">Admin Dashboard</p>
                <p className="text-label text-fg-subtle">ISU-GeoBot</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin sections">
            <p className="mb-2 px-2 text-label font-semibold uppercase tracking-widest text-fg-subtle opacity-60">
              Management
            </p>
            <ul className="space-y-1">
              {TABS.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 ${
                        isActive
                          ? `${tab.activeBg} ${tab.activeText} font-medium`
                          : 'border-transparent text-fg-muted hover:bg-bg-sunken hover:text-fg'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <TabIcon
                        className={`h-4 w-4 shrink-0 transition-colors ${isActive ? tab.activeText : 'text-fg-subtle group-hover:text-fg'}`}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span className="truncate text-meta">{tab.label}</span>
                    </button>
                  </li>
                );
              })}
              <li>
                <Link
                  to="/upload-announcement"
                  className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-fg-muted transition-all duration-150 hover:bg-bg-sunken hover:text-fg"
                >
                  <Megaphone
                    className="h-4 w-4 shrink-0 text-fg-subtle transition-colors group-hover:text-fg"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="truncate text-meta">Availability Events (OCR)</span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Sign out */}
          <div className="border-t border-line px-3 py-4">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-meta text-fg-muted transition-colors hover:border-line hover:bg-bg-sunken hover:text-fg"
            >
              <LogOut className="h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.75} aria-hidden />
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {/* Content area header */}
          <header className="border-b border-line bg-surface px-8 py-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${currentTab.activeBg}`}>
                <Icon className={`h-5 w-5 ${currentTab.activeText}`} strokeWidth={1.75} aria-hidden />
              </div>
              <div>
                <h1 className="font-serif text-h3 text-fg">{currentTab.label}</h1>
                <p className="mt-0.5 text-label text-fg-muted">{currentTab.description}</p>
              </div>
            </div>
          </header>

          {/* Tab panels */}
          <div className="px-8 py-8">
            {activeTab === 'locations' && <CampusLocationsPanel session={session} />}
            {activeTab === 'presence' && <SecurityPresencePanel session={session} />}
            {activeTab === 'validation' && <FacultyValidationPanel session={session} />}
          </div>
        </main>
      </div>
    </div>
  );
}
