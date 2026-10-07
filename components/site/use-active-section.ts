"use client";

import { useEffect, useState } from "react";

/**
 * Which section the visitor is currently reading.
 *
 * NN/g's menu checklist calls failing to show the current location "probably the
 * single most common mistake we see on website menus", and the header had no
 * answer to it at all: the nav pill sat on whichever item was last clicked, so
 * it kept pointing at Projects while the visitor read the timeline, and on a
 * first visit it claimed "Projects" before anything had been clicked.
 *
 * The rule is: the current section is the last one whose top edge has passed the
 * middle of the viewport. That is what "where am I" means while scrolling — you
 * are in the section you have most recently entered — and it is correct for the
 * cases a fixed band is not:
 *
 *   - A short last section. `#system` is 200px tall and sits at the bottom of a
 *     4,000px page, so once the page is fully scrolled its top is at 628px in a
 *     900px viewport. It can never cross a middle band, which is exactly how the
 *     nav ended up pointing at "Timeline" while the visitor read the section the
 *     nav had just scrolled them to. At the very bottom of the page the last
 *     section therefore wins outright.
 *   - A section taller than the viewport, which is most of them. Every position
 *     inside one resolves to that one, the whole way down.
 *   - Gaps between sections. The answer is the last section entered, not the
 *     nearest element.
 *
 * This is a scroll listener rather than an IntersectionObserver on purpose. An
 * observer reports crossings, so it can only ever answer "which sections are in
 * this box", and every box that works for mid-page sections fails at the end of
 * the page. Six `getBoundingClientRect` calls on a rAF-throttled scroll is
 * cheaper than the logic needed to make crossings mean "you are here".
 *
 * Returns null when nothing matches: above the first section, and on any route
 * that does not contain these ids (the playground, for one).
 */
export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  /*
    Subscribe once per set of ids, not once per render. `ids` is a fresh array
    every render, so it cannot be the dependency directly.
  */
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;

    const order = key.split(",");
    let frame = 0;

    const measure = () => {
      frame = 0;
      const midline = window.innerHeight / 2;
      let current: string | null = null;
      let closest = -Infinity;

      for (const id of order) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        // The latest section whose top has passed the midline. Sections are
        // contiguous and ordered, but the "latest" is found by comparing tops
        // rather than by list order, so a reordered nav cannot break it.
        if (top <= midline && top > closest) {
          closest = top;
          current = id;
        }
      }

      // Nothing was entered: the page has not reached the first section yet.
      if (current === null) {
        setActive(null);
        return;
      }

      // Bottom of the page: the last real section wins, however short it is.
      const atBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) {
        const last = [...order].reverse().find((id) => document.getElementById(id));
        if (last) current = last;
      }

      setActive(current);
    };

    // rAF-throttled: a scroll can fire hundreds of times a second and each pass
    // reads layout, so at most one measurement per frame.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    frame = requestAnimationFrame(measure);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key]);

  /*
    Only ever report an id this hook was asked about, so a section remembered
    from the previous route cannot light up an item on this one.
  */
  return active !== null && ids.includes(active) ? active : null;
}
