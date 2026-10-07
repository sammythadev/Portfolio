"use client";

import { HERO_VIDEO_SRC, useHeroVideo } from "@/components/site/use-hero-video";

/**
 * The hero's media layer, and the only reason the hero is a client island.
 *
 * This exists purely so `hero.tsx` can stay a Server Component. All of the
 * hero's copy, its scrim and its layout render on the server and ship zero
 * JavaScript; only the two media layers are client-side, and only because the
 * clip needs a decision that cannot be made in markup.
 *
 * Both media layers are absolutely positioned inside one wrapper and share
 * identical geometry classes, so they register pixel-for-pixel and the dissolve
 * between them has nothing to slide across — which is what makes the handover
 * in either direction read as one image changing rather than two images
 * swapping. The transition is on `opacity` only, at 900 ms on the curve the rest
 * of the page uses for fades, and it runs identically in and out.
 */
export function HeroMedia({ imageSrc, alt }: { imageSrc: string; alt: string }) {
  const { containerRef, videoRef, mounted, revealed } = useHeroVideo(imageSrc);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/*
        The photograph. Unconditional, high priority, and never removed — this is
        the LCP element, and it is also the fallback for every way the clip can
        decline to play. `fetchPriority` and `decoding` are attributes rather
        than behaviour so they apply before hydration.

        It is also the resting state: after the clip's four passes this is what
        the hero shows again, and it is what a hover replay dissolves back to
        when the pointer leaves.
      */}
      <img
        src={imageSrc}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
        draggable={false}
        fetchPriority="high"
        decoding="async"
      />

      {/*
        The motion. Rendered only once `useHeroVideo` has decided the visitor's
        connection and preferences allow it, and from that moment it is left
        alone to download behind the photograph.

        The source is in the markup, which is the important part. Setting
        `video.src` and then calling `video.load()` from an effect runs the media
        element's resource selection algorithm twice in a single tick: the first
        request is aborted and re-issued, which is the `net::ERR_ABORTED` next to
        the clip in DevTools on every load. Here the element is born with its
        source, `preload="auto"` lets the browser stream it in the background,
        and nothing ever calls `load()`.

        `loop` is not set here. The clip plays a counted number of passes and
        then hands back to the photograph, and a looping element never fires
        `ended` — so the loop is turned on by useHeroVideo for the duration of a
        hover replay and off again on the way out.

        Deliberately no `will-change`: hero.tsx documents a hard-edged black
        rectangle that came from four stacked `will-change` composited layers,
        and a video layer is the last thing that needs to join that pile.

        Reduced motion needs no rule here. useHeroVideo refuses to mount the
        element at all under `prefers-reduced-motion`, so on such a device this
        branch never renders and the photograph is the only thing that ever
        paints. globals.css separately collapses transitions to 0.01ms under the
        same query, which only matters if the OS setting is toggled while the
        page is already open.
      */}
      {mounted ? (
        <video
          ref={videoRef}
          src={HERO_VIDEO_SRC}
          preload="auto"
          muted
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          tabIndex={-1}
          data-shown={revealed || undefined}
          className="absolute inset-0 w-full h-full object-cover object-[38%_center] opacity-0 transition-opacity duration-[900ms] ease-[cubic-bezier(0.23,1,0.32,1)] data-[shown]:opacity-100"
        />
      ) : null}
    </div>
  );
}
