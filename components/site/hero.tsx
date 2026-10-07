import { CopyEmailButton } from "@/components/site/copy-email-button";
import { HeroMedia } from "@/components/site/hero-media";
import { Icon } from "@/components/site/icon";
import { siteConfig } from "@/data/site";
import { heroHeadline, heroSubline } from "@/data/stack";

/**
 * Static intro hero: the photograph, with the writeup set over it.
 *
 * This was a scroll-driven <ScrollExpand /> frame (full-bleed at rest, shrinking
 * and padding on scroll) with a pinned copy overlay and two compositor-level
 * effects behind it. That stack was replaced with this plain block for a reason:
 *
 *   1. Compositing. The scroll setup put four independently composited layers on
 *      top of each other (a `will-change: clip-path` frame, a `will-change:
 *      transform` media layer, a fixed full-viewport WebGL canvas, and a fixed
 *      full-bleed scrim). A hard-edged black rectangle was being composited near
 *      the top edge of the frame, at a position that exists in no source asset —
 *      it did not appear in me.jpeg, and it persisted with the spine canvas,
 *      the scrim, and each `will-change` individually disabled. Removing the
 *      scroll machinery removes the whole class of problem.
 *   2. It is an introduction, not a second page. The copy now scrolls with the
 *      page instead of being pinned for a viewport and a half of scroll.
 *
 * The animation code is NOT deleted — components/site/hero-animated.tsx keeps
 * the previous <HeroAnimated /> intact, along with reactbits/ScrollExpand.jsx,
 * use-hero-shrink.ts and spine-conduit.tsx, so the choreography can be brought
 * back one section at a time.
 *
 * Layout: the media is the section background (`absolute inset-0`), so the box
 * height is whatever the copy needs above a floor — no fixed viewport height, no
 * sticky wrapper, nothing that can overlap the sections below.
 *
 * The photograph is a bare <img>, not a next/image, and deliberately so. It is
 * stretched by `object-fit: cover` into a box whose height is decided by the
 * copy, and next/image would want `fill` inside its own positioned wrapper to do
 * that — an extra element for no benefit when there is no src-set negotiation to
 * win here. The clip lives in public/ and the page makes no third-party image
 * request at all, so the responsive-image machinery has nothing to do.
 *
 * A video of the same frame in motion now sits over it (components/site/
 * hero-media.tsx). It is gated on the visitor's connection, is never mounted
 * until that gate passes, and never replaces the photograph underneath it.
 */
export function Hero() {
  return (
    <section
      id="scroll-hero-trigger"
      className="relative w-full max-w-[1080px] mx-auto border-x border-border-line overflow-hidden"
    >
      {/*
        Media layer. <HeroMedia /> renders the photograph and, only if the
        visitor's connection and consent say so, the same frame in motion.

        The section stays a Server Component: HeroMedia is a small client island
        holding just the two media layers, so the copy below still ships as
        server-rendered HTML with no JavaScript of its own.
      */}
      <HeroMedia
        imageSrc="/me.jpeg"
        alt={`${siteConfig.name}, ${siteConfig.discipline}`}
      />

      {/*
        Legibility scrim. Weighted to the bottom where the copy sits, so the
        upper part of the photograph is left alone. This is a plain static
        background gradient — no fixed positioning, no `will-change`, no separate
        composited layer.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent"
      />

      {/*
        Copy. Sits in normal flow and defines the section height: padding gives
        the photograph room to breathe above the headline, and the text block
        sits at the bottom over the heaviest part of the scrim.
      */}
      <div className="relative z-10 flex min-h-[68vh] sm:min-h-[78vh] flex-col justify-end p-6 pt-[46vh] sm:p-10 sm:pt-[40vh]">
        <div className="max-w-[880px] space-y-4 sm:space-y-5">
          {/*
            The headline size is a fluid clamp rather than `sm:`/`lg:` steps.
            With discrete breakpoints the type jumps 30 to 36 to 44px in three
            visible jumps as the window resizes, which reads as three different
            layouts rather than one responsive headline. Clamp interpolates
            continuously between the same endpoints, so the scale stays smooth
            at every width without adding a new breakpoint.
          */}
          <h1 className="font-display text-[clamp(30px,2.8vw+18px,44px)] font-semibold text-primary tracking-tight leading-[1.1] drop-shadow-md">
            {heroHeadline}
          </h1>
          <p className="max-w-[560px] font-body-sm text-[clamp(14px,0.4vw+13px,16px)] leading-relaxed text-zinc-300 drop-shadow sm:font-body-lg">
            {heroSubline}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 sm:gap-3">
            <a
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body-sm text-[13px] font-semibold text-black transition-colors hover:bg-white active:scale-[0.97]"
              href="#projects"
            >
              View Work
              <Icon name="south" className="text-[16px]" />
            </a>
            <CopyEmailButton email={siteConfig.email} compact />
          </div>
        </div>
      </div>
    </section>
  );
}