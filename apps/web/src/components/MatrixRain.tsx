'use client';

import { useEffect, useRef } from 'react';

// Half-width katakana + digits + a few latin glyphs — the classic rain alphabet.
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ0123456789ABCDEFZ:.=*+<>';
const FONT_SIZE = 16;
const FRAME_MS = 55; // ~18fps — plenty for rain, easy on the GPU.

function glyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? '0';
}

/**
 * Full-screen "digital rain" backdrop. One canvas, capped frame rate, DPR-aware.
 * Pauses when the tab is hidden and freezes to a single static frame under
 * `prefers-reduced-motion` — decorative only (`aria-hidden`).
 */
export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let drops: number[] = [];
    let raf = 0;
    let last = 0;
    let width = 0;
    let height = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${FONT_SIZE}px var(--font-jbmono, monospace)`;
      const columns = Math.ceil(width / FONT_SIZE);
      drops = Array.from({ length: columns }, () =>
        Math.floor((Math.random() * height) / FONT_SIZE),
      );
    };

    const drawColumns = (fade: boolean) => {
      if (fade) {
        ctx.fillStyle = 'rgba(5, 8, 5, 0.09)';
        ctx.fillRect(0, 0, width, height);
      }
      for (let i = 0; i < drops.length; i++) {
        const y = (drops[i] ?? 0) * FONT_SIZE;
        const x = i * FONT_SIZE;
        // Leading glyph is bright; trail is dim phosphor green.
        ctx.fillStyle = Math.random() > 0.975 ? '#c8ffd4' : '#00ff41';
        ctx.fillText(glyph(), x, y);
        if (y > height && Math.random() > 0.975) drops[i] = 0;
        else drops[i] = (drops[i] ?? 0) + 1;
      }
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < FRAME_MS) return;
      last = t;
      drawColumns(true);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced) return; // static frame only
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    };

    resize();
    // Paint an initial frame so reduced-motion users still see the effect.
    ctx.fillStyle = 'rgba(5, 8, 5, 1)';
    ctx.fillRect(0, 0, width, height);
    drawColumns(false);
    start();

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-20"
    />
  );
}
