/**
 * One reveal, used everywhere.
 *
 * Four sections each had their own: 14px, 22px and 24px of travel, over 600ms,
 * "800ms, 600ms" and "900ms, 700ms". Individually all fine, together a page
 * that animates slightly differently every time you scroll past a boundary —
 * which is felt as incoherence long before it is noticed as inconsistency.
 *
 * 18px and 700ms is the middle of what was already in use, so nothing changes
 * character; it just stops changing per section. The stagger is per item, and
 * capped: a ten-item grid at 90ms each would leave the last one arriving nearly
 * a second after the first, long after the reader has moved on.
 *
 * Not applied to LandingRevealText, whose lines rise out of a mask by a full
 * line-height, or to the masking diagram, whose motion is the content rather
 * than a way of introducing it. Those are devices, not entrances.
 */
const TRAVEL = 18;
const DURATION = 700;
const EASE = 'cubic-bezier(.16,1,.3,1)';
const STAGGER = 90;
const MAX_STAGGER = 450;

/**
 * @param shown  whether the element has entered the viewport
 * @param index  position in its group, for the stagger
 * @param hover  an extra property the element also transitions on hover
 *               (`background-color`, `border-color`). Without this, a card
 *               with a hover state had to hand-roll the whole style object
 *               again just to add one channel, which is how the four variants
 *               appeared in the first place.
 */
export function revealStyle(shown, index = 0, hover = null) {
  const props = ['transform', 'opacity', ...(hover ? [hover] : [])];
  const durations = [`${DURATION}ms`, `${Math.round(DURATION * 0.8)}ms`,
    ...(hover ? ['160ms'] : [])];
  const eases = [EASE, 'ease-out', ...(hover ? ['ease'] : [])];
  return {
    transitionProperty: props.join(', '),
    transitionDuration: durations.join(', '),
    transitionTimingFunction: eases.join(', '),
    transitionDelay: `${Math.min(index * STAGGER, MAX_STAGGER)}ms`,
    transform: shown ? 'none' : `translateY(${TRAVEL}px)`,
    opacity: shown ? 1 : 0,
  };
}
