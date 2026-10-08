"use client";

import { useEffect } from "react";

/**
 * Single delegated behaviour layer for the whole page.
 *
 * Every section stays a Server Component; this one tiny client island attaches
 * the two document-wide behaviours that the single-file reference ran inline:
 *   - cinematic scroll reveal  (.cinematic-section -> .is-revealed)
 *   - cursor spotlight tracking (.spotlight-card -> --mouse-x / --mouse-y)
 *
 * Delegation is used instead of per-card hooks so the client bundle stays flat.
 */
export function MotionLayer() {
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(".cinematic-section"),
    );

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );

    for (const section of sections) revealObserver.observe(section);

    const onPointerMove = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest?.(
        ".spotlight-card",
      ) as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
      target.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
    };

    document.addEventListener("mousemove", onPointerMove, { passive: true });

    return () => {
      revealObserver.disconnect();
      document.removeEventListener("mousemove", onPointerMove);
    };
  }, []);

  return null;
}