"use client";

/**
 * Boot screen for the lazily-loaded Playground.
 *
 * Design intent: this is not a decorative spinner. The Playground holds the two
 * heaviest things on the page — a WebGL scene with a Draco-compressed GLB and a
 * fragment-shader dither curtain — so the screen exists to cover a real gap
 * while those chunks and their GPU work arrive. It reports real progress from
 * the Resource Timing API and real stage transitions, and it never claims to be
 * finished before it is.
 *
 * Attribution: the staggered reveal choreography is modelled on the interactive
 * portfolio pattern in davidhckh/portfolio-2025 (CC BY-NC-SA 4.0, see
 * components/site/playground.tsx for the required visible credit).
 */

import { useEffect, useMemo, useRef, useState } from "react";

/** Ordered boot stages. `done` marks the point each is considered complete. */
const STAGES = [
  { id: "link", label: "Establishing link" },
  { id: "chunk", label: "Streaming playground chunks" },
  { id: "gpu", label: "Initialising GPU context" },
  { id: "ready", label: "Scene ready" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export function BootScreen({
  /** 0..1 fraction of the tracked assets that have finished. */
  progress,
  stage,
  /** Set once the playground has reported usable content. */
  done,
  onDismiss,
}: {
  progress: number;
  stage: StageId;
  done: boolean;
  onDismiss: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  /*
    The exit is 520ms while the boot itself is capped by progress, so the
    dismissal reads as a deliberate handoff rather than a pop. `onDismiss` is
    deferred to a timer rather than fired immediately so the scene is already
    visible underneath when the screen lifts.
  */
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setLeaving(true), 420);
    const t2 = window.setTimeout(onDismiss, 980);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [done, onDismiss]);

  const pct = useMemo(
    () => Math.max(0, Math.min(100, Math.round(progress * 100))),
    [progress]
  );

  const activeIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <div
      // `aria-hidden` once leaving: the screen is decorative chrome and should
      // not be announced again while it fades.
      aria-hidden={leaving || undefined}
      className={`boot-screen ${leaving ? "is-leaving" : ""} ${
        mounted ? "is-mounted" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      {/* Blueprint substrate, matching the site's grid language. */}
      <div aria-hidden className="boot-screen__grid" />

      <div className="boot-screen__inner">
        {/* The packet: a stack of hairlines that resolves into the bar as the
            load completes. Pure transform/opacity, so it stays on the
            compositor for the whole animation. */}
        <div aria-hidden className="boot-screen__scope">
          <span className="boot-screen__packet boot-screen__packet--1" />
          <span className="boot-screen__packet boot-screen__packet--2" />
          <span className="boot-screen__packet boot-screen__packet--3" />
          <span className="boot-screen__packet boot-screen__packet--4" />
        </div>

        <p className="boot-screen__label font-label-tag text-[11px] text-text-dim">
          PLAYGROUND · BOOT
        </p>

        {/* Bar track. `role="progressbar"` with the real values so assistive tech
            reports genuine state rather than an indeterminate wait. */}
        <div
          aria-label="Playground load progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={pct}
          className="boot-screen__track"
          role="progressbar"
        >
          <span
            className="boot-screen__fill"
            style={{ transform: `scaleX(${Math.max(0.02, progress)})` }}
          />
        </div>

        <div className="boot-screen__row">
          <span className="boot-screen__stage font-mono text-[11px] text-on-surface-variant">
            {STAGES[activeIndex]?.label ?? STAGES[0].label}
          </span>
          <span className="boot-screen__pct font-mono text-[11px] text-text-dim tabular-nums">
            {pct}%
          </span>
        </div>

        {/* Stage log. Each line reveals when its stage is reached and stays, so
            the visitor can see what happened rather than staring at a bar. */}
        <ol aria-hidden className="boot-screen__log">
          {STAGES.map((s, i) => {
            const reached = activeIndex >= i;
            return (
              <li
                className={`boot-screen__logline font-mono text-[10px] ${
                  reached ? "is-reached" : ""
                }`}
                key={s.id}
              >
                <span className="boot-screen__tick" />
                {s.label}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/**
 * Real progress from the Resource Timing API.
 *
 * Tracks every transfer the playground triggers — the JS chunks for the dynamic
 * imports, the GLB, and its Draco sidecar — and reports the share of their
 * bytes that have finished. Falls back to a slow crawl if Resource Timing is
 * unavailable or the entries never settle, so the bar is never frozen at a
 * value the load has not actually reached.
 */
export function useResourceProgress(keys: string[], active: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let tick = 0;

    const measure = () => {
      if (cancelled) return;

      /*
        `getEntriesByType` is typed as returning the base `PerformanceEntry`,
        but every entry it actually yields is a `PerformanceResourceTiming`,
        which is where `transferSize` and `responseEnd` live. The cast is
        localized here rather than widening the global DOM lib, because only
        this function needs the resource-specific fields.
      */
      let entries: PerformanceResourceTiming[] = [];
      if (typeof performance !== "undefined" && performance.getEntriesByType) {
        entries = performance
          .getEntriesByType("resource")
          .filter((e) => keys.some((k) => e.name.includes(k))) as PerformanceResourceTiming[];
      }

      if (entries.length) {
        const total = entries.reduce((a, e) => a + (e.transferSize || 0), 0);
        /*
          An entry only contributes once it has finished. `responseEnd` is 0 for
          an in-flight request, so counting its bytes early would let the bar
          claim progress it has not actually made.
        */
        const done = entries.reduce(
          (a, e) => a + (e.responseEnd > 0 ? e.transferSize || 0 : 0),
          0
        );
        const ratio = total > 0 ? done / total : 0;
        if (!cancelled) setProgress((p) => Math.max(p, Math.min(0.92, ratio)));
      } else {
        // No timing data yet. Creep toward, but never reach, 92% — the stage
        // change to "ready" is what actually completes the bar, so a
        // fabricated 100% can never happen.
        tick += 1;
        if (!cancelled) {
          setProgress((p) => Math.min(0.9, p + 0.02 + tick * 0.004));
        }
      }
      raf = requestAnimationFrame(measure);
    };

    let raf = requestAnimationFrame(measure);

    /*
      The poll stops once the boot screen is no longer needed.

      `measure` reschedules itself unconditionally, so this loop ran for the
      entire life of the route: scanning the whole Resource Timing buffer and
      calling `setProgress` every single frame, which re-rendered the stage tree
      at 60fps forever. That is invisible on a fast machine and ruinous on a slow
      one, and it was competing with the WebGL frame loop for the same budget —
      the largest single contributor to scroll stutter.

      Once `active` goes false there is nothing left to measure, so the caller's
      cleanup cancels it outright rather than letting it idle.
    */
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // Keys are a static list at the call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, keys.join("|")]);

  return progress;
}

/** Tracks whether `ref` has come within `margin` of the viewport. */
export function useNearViewport(
  ref: React.RefObject<HTMLElement | null>,
  margin = "320px"
) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);

  return near;
}