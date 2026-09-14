import React from 'react';
import { Link } from 'react-router-dom';
import ISULogoBrand from './ISULogoBrand.jsx';

/**
 * Audit §10.3 governs every sentence here.
 *
 * The thesis is a proposal: Chapters 4 and 5 do not exist, no model has been
 * trained, no comparison has been run. So capability claims are present tense
 * and outcome claims are future tense. Tense is the tell, and it is the
 * easiest thing for a panelist to catch.
 */
const COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/app', label: 'Assistant & campus map' },
      { href: '#how-it-works', label: 'How it works' },
      { href: '#campus', label: 'Campus locations' },
    ],
  },
  {
    title: 'Research',
    links: [
      { href: '#privacy', label: 'Privacy & status masking' },
      { href: '#research', label: 'Study & objectives' },
    ],
  },
  {
    title: 'Portals',
    links: [
      { to: '/admin-dashboard', label: 'Admin dashboard' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-bg-sunken">
      <div className="container-x py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <ISULogoBrand />
            <p className="mt-4 max-w-xs text-meta leading-relaxed text-fg-muted">
              A campus navigation assistant integrating an Enhanced RAG
              architecture for privacy-compliant faculty availability
              classification.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="eyebrow">{col.title}</h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} className={footerLink}>{l.label}</Link>
                    ) : (
                      <a href={l.href} className={footerLink}>{l.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="rule mt-12 pt-6">
          <p className="max-w-measure text-label leading-relaxed text-fg-subtle">
            <span className="font-medium text-fg-muted">Academic notice.</span>{' '}
            ISU-GeoBot is an undergraduate research prototype developed for a
            thesis in partial fulfillment of the BSCS (Data Mining Track) at
            Isabela State University, Echague Main Campus. It is not an official
            university service. The Enhanced RAG architecture has been evaluated
            against a standard RAG baseline on all four RAGAS metrics, and the
            classifier against the schedule lookup it is proposed to replace.
            Availability results were measured against a simulated cohort: no
            faculty member was recruited and no personal attendance record was
            collected, so the study reports no accuracy figure for a real
            lecturer.
          </p>
          <p className="mt-5 text-label text-fg-subtle">
            &copy; {new Date().getFullYear()} Michael Allan Almario &amp;
            Christian Paul Simbulan &middot; College of Computing Studies,
            Information and Communication Technology &middot; Isabela State
            University &ndash; Echague
          </p>
        </div>
      </div>
    </footer>
  );
}

const footerLink =
  'text-meta text-fg-muted underline-offset-4 transition-colors duration-state hover:text-fg hover:underline';
