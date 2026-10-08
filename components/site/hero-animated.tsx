"use client";

/*
 * PRESERVED — NOT RENDERED.
 *
 * This is the scroll-driven ScrollExpand hero exactly as it existed before the
 * hero was reset to a static image + writeup. The animation code itself is
 * untouched and still lives in:
 *   - components/reactbits/ScrollExpand.jsx
 *   - components/site/use-hero-shrink.ts
 *   - components/site/spine-conduit.tsx
 *
 * It is kept here so the scroll choreography can be restored section by section
 * without rewriting it. The exported symbol is renamed so it can never be
 * confused with the live <Hero /> in components/site/hero.tsx.
 */

import ScrollExpand from "@/components/reactbits/ScrollExpand";
import { CopyEmailButton } from "@/components/site/copy-email-button";
import { Icon } from "@/components/site/icon";
import { useHeroShrink } from "@/components/site/use-hero-shrink";
import { siteConfig } from "@/data/site";
import { heroHeadline, heroSubline } from "@/data/stack";

/**
 * Intro hero driven by the React Bits <ScrollExpand /> component.
 *
 * Layout contract — important, because getting this wrong makes the hero media
 * overlap every following section:
 *
 *   - <ScrollExpand /> owns its own scroll geometry. With `useWindowScroll` it
 *     sets its track height to `100vh * (1 + scrollDistance + holdDistance)` and
 *     pins the stage with `position: sticky; top: 0` inside that track. So the
 *     component must NOT be wrapped in an extra fixed-height or sticky box —
 *     doing so double-nests the scroll region and the full-bleed frame ends up
 *     covering the sections below.
 *   - The copy is therefore a *sibling* that is itself `sticky top-0 h-screen`,
 *     placed BEFORE the component in DOM order. Sticky only engages once an
 *     element reaches its threshold, so putting it first is what pins the copy
 *     for the whole intro instead of parking it below the fold.
 *   - Copy must not go in ScrollExpand's `children`: that slot renders inside
 *     `.scroll-expand__overlay`, which the component fades in only past ~68%
 *     scroll progress, leaving the headline invisible on first paint.
 *
 * Pacing: `scrollDistance` is the fraction of a viewport spent expanding and
 * `holdDistance` the full-bleed dwell afterwards. Keep both small — the intro is
 * an intro, not a second page.
 */
export function HeroAnimated() {
  // Breakpoint tuning lives inside the hook (matchMedia, not render-time
  // window reads) so there is no hydration mismatch on mobile.
  useHeroShrink();

  return (
    <div
      id="scroll-hero-trigger"
      className="relative w-full max-w-[1080px] mx-auto border-x border-border-line"
    >
      {/*
        Pinned copy overlay.

        The wrapper is `sticky` with `h-0`: sticky still engages on scroll, but
        the element occupies no flow height, so it cannot push the ScrollExpand
        track down the page (which would leave the hero starting a full viewport
        below the header). The visible panel is absolutely positioned inside it at
        `top-0`, and the wrapper itself sticks at `var(--header-h)` so the panel
        tracks the expanding frame exactly.
      */}
      {/*
          The wrapper sticks at `var(--header-h)`, NOT `top-0`. At scroll 0 the
          wrapper sits at its natural position (immediately below the header);
          once stuck it pins to `var(--header-h)`. Both states therefore resolve
          to the same viewport offset, which is exactly where
          `.scroll-expand__stage` pins — so the copy panel and the expanding
          frame always share one box. Offsetting the *inner* panel instead would
          double-count the header (63 + 57 = 120) and push the CTAs off-screen.
        */}
      <div className="sticky top-[var(--header-h)] z-10 h-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-[calc(100dvh-var(--header-h))]">
          <div className="hero-scrim" aria-hidden="true" />

          {/*
            CLEAN HERO.

            The hero is picture + writeup, nothing else. It previously stacked
            five bands of chrome over the photograph (a bracketed role badge, a
            "fault-tolerant core" status chip, a "SCROLL TO EXPAND ARCHITECTURE"
            prompt, a five-pill capability tag row, and a three-button CTA row),
            which buried the image and read as instrument panel rather than
            introduction. All of that chrome is gone:
              - the role badge duplicated the headline, and the status chip and
                scroll prompt were decoration with no user action behind them
              - the tag row restated the Stack section a few screens below it
              - the CTA row is down to two buttons with distinct intents
            What remains is the headline, the supporting line, and the actions.
          */}
          <div className="relative z-10 w-full h-full flex flex-col justify-end p-6 sm:p-10">
            <div className="space-y-4 sm:space-y-5 max-w-[880px] pointer-events-auto">
              {/*
                `text-balance` is deliberately absent: it optimises for even line
                lengths, which fights the two-line cap this headline needs. 44px
                inside an 880px column is the largest scale at which this
                76-character headline still resolves to exactly two lines; 46px
                tips it to three and pushes the actions down the viewport.
              */}
              <h1 className="font-display text-[30px] sm:text-[36px] lg:text-[44px] font-semibold text-primary tracking-tight leading-[1.1] drop-shadow-md">
                {heroHeadline}
              </h1>
              <p className="font-body-sm sm:font-body-lg text-[14px] sm:text-[16px] text-zinc-300 max-w-[560px] drop-shadow leading-relaxed">
                {heroSubline}
              </p>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
                <a
                  className="px-4 py-2 rounded-lg bg-primary text-black font-body-sm text-[13px] font-semibold hover:bg-white active:scale-[0.97] transition-colors inline-flex items-center gap-1.5"
                  href="#projects"
                >
                  View Work
                  <Icon name="south" className="text-[16px]" />
                </a>
                <CopyEmailButton email={siteConfig.email} compact />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScrollExpand
        src="/me.jpeg"
        alt={`${siteConfig.name} — ${siteConfig.discipline}`}
        useWindowScroll
        /*
          BIG BY DEFAULT.

          <ScrollExpand /> can only interpolate small -> big: its frame width is
          `startWidth + (100 - startWidth) * progress`, so progress 0 is the
          *narrowest* frame and progress 1 is full-bleed. Feeding it the
          reference's 42%/58% start therefore renders a small inset card at rest
          and grows on scroll — the opposite of the intended behaviour.

          So the frame is pinned full-bleed here (startWidth/startHeight 100,
          radius 0), which makes the component's own clip-path a no-op and its
          `mediaZoom` the only thing it animates: 1.22 at rest easing to 1.0.
          The shrink is applied by `useHeroShrink` below, which writes a
          `transform` + `border-radius` onto the same `.scroll-expand__frame`
          element. `transform` and `clip-path` are independent properties, so
          they compose without touching the vendored component.
        */
        startWidth={100}
        startHeight={100}
        startRadius={0}
        endRadius={0}
        mediaZoom={1.22}
        scrollDistance={0.55}
        holdDistance={0.05}
        overlayScrim={0}
        /*
          Exponential follow (`1 - exp(-1/(60*k))` per frame). The upstream
          default of 0.1 trails the scroll position by ~600ms, so the frame kept
          moving after you stopped and lagged badly on the way back up. 0.035
          keeps the easing while tracking the scrollbar closely in BOTH
          directions.
        */
        smoothing={0.035}
      />
    </div>
  );
}
