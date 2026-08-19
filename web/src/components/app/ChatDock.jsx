import { useEffect, useRef } from 'react';
import { MessageSquare, X } from 'lucide-react';
import ChatInterface from './ChatInterface.jsx';

/**
 * The assistant, docked.
 *
 * The map is the page. The assistant is a thing you call on and dismiss, which
 * is why it is a bubble and a panel rather than half the window: a campus map
 * permanently sharing the screen with an empty chat column spends fifty percent
 * of a 1920px display on a text box nobody has typed in yet.
 *
 * ChatInterface stays MOUNTED when the dock is closed. That is the whole reason
 * this wrapper exists rather than a conditional render — unmounting would throw
 * away the conversation, and a chat that forgets what you asked the moment you
 * look at the map is not a chat. Closed means translated, faded and inert, not
 * gone.
 *
 * The bubble sits clear of the map's own furniture. Leaflet's attribution gets
 * right-hand padding on this screen (see `[data-dock]` in index.css) so the
 * dock never lands on top of a legal notice it is obliged to display, and the
 * panel's height is capped against the viewport rather than fixed, so on a
 * 768px laptop it stops short of the map toolbar instead of covering the zoom
 * controls. A control another control can hide is not a control.
 */
export default function ChatDock({ open, onToggle, onPoiFocus, draft, unread }) {
  const panelRef = useRef(null);

  // Escape closes the dock — but only when focus is inside it, so pressing
  // Escape to clear a selected marker does not also dismiss the assistant.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (panelRef.current?.contains(document.activeElement)) onToggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onToggle]);

  return (
    <>
      <div
        ref={panelRef}
        id="assistant-dock"
        aria-hidden={!open}
        className={`fixed bottom-[5.25rem] right-3 z-[900] flex h-[min(32rem,calc(100dvh-11rem))] w-[min(23rem,calc(100vw-1.5rem))] origin-bottom-right flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg transition-[opacity,transform,visibility] duration-dialog ease-in sm:right-4 sm:bottom-[5.5rem] sm:w-[23rem] lg:h-[min(34rem,calc(100dvh-14.5rem))] ${
          open
            ? 'visible translate-y-0 scale-100 opacity-100'
            : 'invisible pointer-events-none translate-y-3 scale-[0.98] opacity-0'
        }`}
      >
        <ChatInterface
          compact
          onClose={onToggle}
          onPoiFocus={onPoiFocus}
          draft={draft}
        />
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="assistant-dock"
        aria-label={open ? 'Close the campus assistant' : 'Open the campus assistant'}
        className="group fixed bottom-4 right-3 z-[900] grid h-14 w-14 place-items-center rounded-pill border border-accent bg-accent text-accent-contrast shadow-lg transition-[transform,background-color] duration-state hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-95 sm:right-4"
      >
        {/* Both glyphs are mounted and cross-faded, so the button never changes
            size mid-press and the swap reads as one control changing state. */}
        <MessageSquare
          className={`absolute h-5 w-5 transition-[opacity,transform] duration-menu ${
            open ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'
          }`}
          aria-hidden
        />
        <X
          className={`absolute h-5 w-5 transition-[opacity,transform] duration-menu ${
            open ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'
          }`}
          aria-hidden
        />

        {unread && !open && (
          <span
            aria-hidden
            className="absolute right-3 top-3 h-2.5 w-2.5 rounded-pill border-2 border-accent bg-warning"
          />
        )}
      </button>
    </>
  );
}
