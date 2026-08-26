import React from 'react';
import TopNavigationBar from '../shared-components/TopNavigationBar.jsx';
import DemoModeNotificationBanner from '../shared-components/DemoModeNotificationBanner.jsx';
import Button from '../ui-primitives/ActionButton.jsx';

/**
 * The frame every operational portal sits in.
 *
 * Portals share one frame so they read as one product; each carries a single
 * line of contextual identity (icon, name, purpose) so a user knows which room
 * they are standing in. That is the whole difference — not three visual
 * languages, one language and three labels.
 */
export default function PortalShell({
  icon: Icon,
  title,
  subtitle,
  actions,
  width = 'container-x',
  children,
}) {
  return (
    <div className="min-h-screen bg-bg">
      <a href="#portal-main" className="skip-link">Skip to content</a>
      <TopNavigationBar />
      <DemoModeNotificationBanner />

      <header className="border-b border-line bg-surface">
        <div className={`${width} flex flex-wrap items-end justify-between gap-4 py-7`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-fg-muted">
              {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              <span className="eyebrow">Portal</span>
            </div>
            <h1 className="mt-2 font-serif text-h2 text-fg">{title}</h1>
            {subtitle && <p className="lede mt-2 text-body">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>

      <main id="portal-main" className={`${width} py-8`}>{children}</main>
    </div>
  );
}

export function SignOutButton({ onSignOut }) {
  return <Button variant="text" onClick={onSignOut}>Sign out</Button>;
}
