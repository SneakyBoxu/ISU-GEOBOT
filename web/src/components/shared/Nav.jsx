import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ClipboardCheck, Menu, Settings2, ShieldCheck, X } from 'lucide-react';
import Brand from './Brand.jsx';
import Button from '../ui/Button.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';

/**
 * Portals are reachable from every page, but they are not marketing links.
 *
 * Only `/validate` is something a person outside the research team goes
 * looking for. `/guard` and `/admin` are operational surfaces for one or two
 * people each: in the menu so nobody needs to be told a URL, out of the top
 * bar so the navigation does not imply a general-purpose audience.
 *
 * Nothing here is access control. Every portal enforces auth and role
 * server-side and RLS enforces it again at the database. Hiding a link is
 * presentation, never protection.
 */
const PORTALS = [
  { to: '/validate', label: 'Faculty Portal', hint: 'Validation checklist and privacy controls', icon: ClipboardCheck, primary: true },
  { to: '/guard', label: 'Security Presence', hint: 'Log faculty arrivals and departures', icon: ShieldCheck },
  { to: '/admin', label: 'Campus Locations', hint: 'Add or correct buildings on the map', icon: Settings2 },
];

const SECTIONS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#campus', label: 'Campus' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#research', label: 'Research' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [portalsOpen, setPortalsOpen] = useState(false);
  const { pathname } = useLocation();
  const portalsRef = useRef(null);

  useEffect(() => {
    if (!portalsOpen) return;
    const onDown = (e) => {
      if (portalsRef.current && !portalsRef.current.contains(e.target)) setPortalsOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setPortalsOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [portalsOpen]);

  useEffect(() => { setPortalsOpen(false); setOpen(false); }, [pathname]);

  // The mobile sheet covers the viewport; leaving the page scrollable behind
  // it is the classic way a menu feels broken on a phone.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const onPortal = PORTALS.some((p) => p.to === pathname);
  const isHome = pathname === '/';
  // The landing page is a document and keeps its centred measure. Everything
  // else is an application surface, where the brand belongs against the left
  // edge of the window rather than floating in from it.
  const appChrome = !isHome;

  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-bg">
      <nav className={`flex h-[3.75rem] items-center justify-between gap-4 ${
        appChrome ? 'container-app' : 'container-x'
      }`}>
        <Brand />

        <div className="hidden items-center gap-1 lg:flex">
          {isHome && SECTIONS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded px-2.5 py-2 text-meta text-fg-muted transition-colors duration-state hover:text-fg"
            >
              {l.label}
            </a>
          ))}

          <div ref={portalsRef} className="relative ml-1">
            <button
              type="button"
              onClick={() => setPortalsOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={portalsOpen}
              className={`flex items-center gap-1 rounded px-2.5 py-2 text-meta transition-colors duration-state ${
                portalsOpen || onPortal ? 'text-fg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              Portals
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-menu ${portalsOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {portalsOpen && (
              <div
                role="menu"
                aria-label="Portals"
                className="absolute right-0 top-full z-20 mt-1.5 w-[19rem] animate-pop border border-line bg-surface-raised shadow-md"
              >
                {PORTALS.map((p) => (
                  <Link
                    key={p.to}
                    to={p.to}
                    role="menuitem"
                    aria-current={pathname === p.to ? 'page' : undefined}
                    className={`flex items-start gap-3 border-b border-line px-4 py-3 transition-colors duration-state last:border-b-0 ${
                      pathname === p.to ? 'bg-accent-subtle' : 'hover:bg-bg-sunken'
                    }`}
                  >
                    <p.icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${p.primary ? 'text-accent' : 'text-fg-subtle'}`}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-meta font-medium text-fg">{p.label}</span>
                      <span className="mt-0.5 block text-label leading-snug text-fg-subtle">{p.hint}</span>
                    </span>
                  </Link>
                ))}
                <p className="bg-bg-sunken px-4 py-2.5 text-label leading-relaxed text-fg-subtle">
                  Sign-in required. Accounts are issued by the researchers.
                </p>
              </div>
            )}
          </div>

          <span className="mx-1.5 h-5 w-px bg-line" aria-hidden />
          <ThemeToggle />
          <Button as={Link} to="/app" variant="primary" size="sm" className="ml-1.5 whitespace-nowrap">
            Launch Assistant
          </Button>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-icon"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-x-0 top-[3.75rem] bottom-0 z-[999] overflow-y-auto border-t border-line bg-bg lg:hidden">
          <div className="container-x py-6">
            {isHome && (
              <MobileGroup title="Product">
                {SECTIONS.map((l) => (
                  <a key={l.href} href={l.href} onClick={() => setOpen(false)} className={mobileItem}>
                    {l.label}
                  </a>
                ))}
              </MobileGroup>
            )}

            <MobileGroup title="Portals">
              {PORTALS.map((p) => (
                <Link
                  key={p.to}
                  to={p.to}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === p.to ? 'page' : undefined}
                  className={`${mobileItem} flex items-center gap-3`}
                >
                  <p.icon
                    className={`h-4 w-4 shrink-0 ${p.primary ? 'text-accent' : 'text-fg-subtle'}`}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {p.label}
                </Link>
              ))}
            </MobileGroup>

            <Button as={Link} to="/app" variant="primary" size="lg" className="mt-7 w-full"
                    onClick={() => setOpen(false)}>
              Launch Assistant
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

const mobileItem =
  'block border-b border-line py-3.5 text-body text-fg transition-colors duration-state active:text-accent';

function MobileGroup({ title, children }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}
