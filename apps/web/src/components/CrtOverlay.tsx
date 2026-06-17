/**
 * CRT dressing: horizontal scanlines + a vignette, with a faint flicker. Sits
 * above everything, ignores pointer events, and is purely decorative. The
 * flicker is disabled under `prefers-reduced-motion` (see globals.css).
 */
export function CrtOverlay() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 mx-flicker">
      {/* Scanlines */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.28) 3px, rgba(0,0,0,0) 4px)',
        }}
      />
      {/* Vignette + green tint */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,40,10,0.05) 0%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </div>
  );
}
