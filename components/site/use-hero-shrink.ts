"use client";

import { useEffect } from "react";

type Options = {
  /** Viewport heights of scroll over which the frame shrinks. */
  distance?: number;
  /** Smallest scale the frame reaches. */
  minScale?: number;
  /** Corner radius at full shrink, in px. */
  minRadius?: number;
};

/**
 * Per-breakpoint tuning. A 390px phone cannot afford as much travel or as much
 * shrink as a 1440px desktop — the frame ends up tiny, and the headline behind
 * it stops reading — so narrow viewports get a shorter distance and a gentler
 * floor. Read via `matchMedia` inside the effect, never during render.
 */
const NARROW = "(max-width: 639px)";

const RESPONSIVE = {
  narrow: { distance: 0.4, minScale: 0.84, minRadius: 12 },
  wide: { distance: 0.55, minScale: 0.72, minRadius: 20 },
} as const;

/**
 * Shrinks the hero frame as the page scrolls down, and restores it on scroll up.
 *
 * Why this exists: the vendored <ScrollExpand /> can only interpolate
 * small -> big (its width is `startWidth + (100 - startWidth) * progress`), so
 * a "big at rest, reduces on scroll" hero is not expressible through its props.
 * The frame is therefore configured full-bleed (clip-path no-op) and this hook
 * writes `transform` + `border-radius` onto `.scroll-expand__frame` instead.
 * Those are independent of `clip-path`, so the component stays untouched.
 *
 * Values are written straight to the DOM inside a rAF-throttled scroll handler
 * — no React state, so scrolling never re-renders the tree.
 */
export function useHeroShrink(options: Options = {}) {
  useEffect(() => {
    const frame = document.querySelector<HTMLElement>(".scroll-expand__frame");
    const track = document.querySelector<HTMLElement>(".scroll-expand__track");
    if (!frame || !track) return;

    const narrowQuery = window.matchMedia(NARROW);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const settings = () => {
      const preset = narrowQuery.matches ? RESPONSIVE.narrow : RESPONSIVE.wide;
      return {
        distance: options.distance ?? preset.distance,
        minScale: options.minScale ?? preset.minScale,
        minRadius: options.minRadius ?? preset.minRadius,
      };
    };

    let cfg = settings();

    let raf = 0;
    let current = 0;
    let target = 0;
    let running = false;

    const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

    const paint = () => {
      const scale = 1 - (1 - cfg.minScale) * current;
      const radius = cfg.minRadius * current;
      frame.style.transform = `scale(${scale.toFixed(4)})`;
      frame.style.borderRadius = `${radius.toFixed(2)}px`;
    };

    const render = () => {
      // Exponential follow, mirroring the component's own easing feel.
      current += (target - current) * 0.3;
      if (Math.abs(target - current) < 0.0005) {
        current = target;
        running = false;
      }

      paint();

      raf = running ? requestAnimationFrame(render) : 0;
    };

    const kick = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(render);
    };

    const reset = () => {
      current = 0;
      target = 0;
      paint();
    };

    const update = () => {
      if (reduceMotion.matches) {
        reset();
        return;
      }
      const span = Math.max(1, window.innerHeight * cfg.distance);
      const travelled = -track.getBoundingClientRect().top;
      target = clamp01(travelled / span);
      kick();
    };

    const onScroll = () => {
      // NOTE: `raf` must be cleared before scheduling. Assigning the handle
      // here and then calling update() *inside* that callback leaves `raf`
      // holding an already-consumed id, so kick()'s `if (!raf)` guard fails,
      // `running` is set true, and no frame is ever queued — the animation
      // silently stops after the first settle.
      raf = 0;
      raf = requestAnimationFrame(update);
    };

    // Re-read the preset on breakpoint changes so a resize mid-scroll settles
    // to the correct scale rather than stranding the old one.
    const onBreakpoint = () => {
      cfg = settings();
      update();
    };

    cfg = settings();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    narrowQuery.addEventListener("change", onBreakpoint);
    reduceMotion.addEventListener("change", onBreakpoint);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      narrowQuery.removeEventListener("change", onBreakpoint);
      reduceMotion.removeEventListener("change", onBreakpoint);
    };
  }, [options.distance, options.minScale, options.minRadius]);
}