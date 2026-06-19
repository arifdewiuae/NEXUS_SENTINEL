/**
 * CRT dressing: horizontal scanlines + a vignette, with a faint flicker. Sits
 * above everything, ignores pointer events, and is purely decorative. The
 * flicker is disabled under `prefers-reduced-motion` (see globals.css).
 */
export function CrtOverlay() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 mx-flicker">
      {/* Scanlines — kept faint so they texture without dimming the text. */}
      <div className="absolute inset-0 mx-scanlines" />
      {/* Vignette + green tint — gentle, so edge content (header, feed) stays legible. */}
      <div className="absolute inset-0 mx-vignette" />
    </div>
  );
}
