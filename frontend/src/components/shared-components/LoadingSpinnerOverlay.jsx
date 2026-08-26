import React from 'react';
import { Mark } from './ISULogoBrand.jsx';

export default function Loading({ label = 'Loading ISU-GeoBot' }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <span className="text-fg-subtle"><Mark className="h-7 w-7 animate-pulse" /></span>
        <p className="text-meta text-fg-muted">{label}</p>
      </div>
    </div>
  );
}
