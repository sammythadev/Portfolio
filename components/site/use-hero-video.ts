"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero motion, in the order the visitor experiences it.
 *
 * The photograph is the page. It is server-rendered, it is the LCP element, and
 * it is never taken out of the DOM — every decision below only decides whether
 * the clip is allowed to sit *on top* of it, and the clip failing in any way is
 * always survivable because the still is already there.
 *
 * The clip's life, in four steps:
 *
 *   1. Consent. Reduced motion, Save-Data, an effective type of 2g/3g, or a
 *      device reporting under 2 GB of RAM means no element is ever created and
 *      no request is ever made. These are the only four signals available that
 *      are actually about the visitor.
 *   2. Background download. Once the poster has loaded — so the clip never
 *      competes with the LCP image — the element is mounted with its `src`
 *      already in the markup and `preload="auto"`. The browser streams the clip
 *      behind the still, at whatever speed the connection allows, and nobody is
 *      waiting on it.
 *   3. Instant playback. The moment the browser reports that it holds enough
 *      data to play the clip through (`HAVE_ENOUGH_DATA`, or a buffered range
 *      covering the whole clip) the layer dissolves in and playback starts. It
 *      cannot begin mid-buffer, so it can never stall, and it never waits on a
 *      timer of ours.
 *   4. Four passes, then the photograph, then hover. The clip plays
 *      AUTOPLAY_PASSES times on its own and then dissolves back to the still for
 *      good; from that point the hover is the only thing that plays it, and
 *      leaving the hero dissolves it back to the photograph again. The dissolve
 *      is the same 900 ms opacity transition in both directions (see
 *      hero-media.tsx), so arrival and departure are the same motion.
 *
 * Why the previous version failed, and why each piece is now gone:
 *
 *   - `preload="none"`. MDN, on `load()`: "The amount of media data that is
 *     prefetched is determined by the value of the element's preload
 *     attribute." The one attribute whose job was to prevent the download was
 *     also disabling the background download the design depended on, and WebKit
 *     honours it strictly — there, `loadeddata` never fired, so the reveal it
 *     gated never ran.
 *   - Setting `video.src` and then calling `video.load()` in the same tick. Both
 *     run the media element's resource selection algorithm, so the element
 *     aborted one request and immediately issued another: a `206`, a failed
 *     request (`net::ERR_ABORTED`), then a re-request, on every page load. The
 *     source now lives in the markup and nothing calls `load()`.
 *   - The throughput gate. It read the poster JPEG's own
 *     `PerformanceResourceTiming` entry and used bytes-over-time as a hard veto.
 *     One 300 KB image measured from `requestStart` includes DNS, TCP setup and
 *     slow start, so it systematically under-reports the link: it rejected the
 *     clip on a throttled-but-ordinary 4 Mbps connection in testing, and it is
 *     least accurate on a cold first visit, which is the commonest case there
 *     is. Consent asks the visitor; a measurement this noisy has no business
 *     overriding them.
 *   - The 2.5 s watchdog that unmounted the element mid-download. Cancelling an
 *     in-flight request achieves nothing (the still is the fallback either way)
 *     and throws away every byte already received.
 *   - The 2 s dwell. It held a fully-buffered 730 KB clip off screen for two
 *     seconds (measured: data complete at 1370 ms, visible at 3357 ms) for no
 *     reason the visitor could perceive.
 */

/** The re-encoded clip. See the asset note in README; 747,899 B / 598 kbps. */
export const HERO_VIDEO_SRC = "/me-hero-v1.mp4";

/**
 * How many times the clip plays unprompted before it hands over to hover.
 * With the 10.005 s clip that is 40 s of ambient motion, which is about a
 * visitor's first read of the hero and the section beneath it.
 */
const AUTOPLAY_PASSES = 4;

/**
 * The consent gate. Deliberately only statements: things the visitor has asked
 * for, or set, or is running on.
 *
 * `3g` is NOT in this list, and that is a measured decision rather than a
 * tolerant one. `navigator.connection.effectiveType` is not a fact about the
 * link — it is Chrome's continuously re-evaluated estimate from a sliding
 * window of recent requests, and the reading taken during a page load is the
 * least settled one there is. Measured on loopback, with the 305 KB poster
 * arriving in 26-128 ms, it reported `3g` on four of six consecutive loads and
 * `4g` on the other two, and it moved *after* the gate had already run. As a
 * one-shot veto that silently removed the clip from most visitors on a fast
 * connection — the same failure mode as the throughput probe below, one layer
 * down.
 *
 * Blocking it there is also the wrong trade on the merits. The clip is 748 KB
 * and it only reveals once the browser can play it through, so a 3g visitor
 * waits a few seconds on the photograph and then gets a playback that cannot
 * stall. `slow-2g` and `2g` stay blocked, where the same file is a minute of
 * someone's data, and Save-Data — a setting the visitor actually chose — covers
 * the rest.
 */
const CONSENT = {
  blockedEffectiveTypes: ["slow-2g", "2g"],
  minDeviceMemoryGb: 2,
} as const;

/** `HTMLMediaElement.HAVE_ENOUGH_DATA` — playback can reach the end unaided. */
const HAVE_ENOUGH_DATA = 4;

/**
 * Slack when checking "the whole clip is buffered". The final frame is not
 * always reported inside the buffered range, so an exact comparison can sit one
 * tick short forever and hold the reveal back for no reason.
 */
const FULLY_BUFFERED_SLACK_S = 0.25;

/** `navigator.connection` and `navigator.deviceMemory` are not in the DOM lib. */
type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithNetwork = Navigator & {
  connection?: NetworkInformation;
  deviceMemory?: number;
};

/**
 * Gate 1, and the only gate. Everything the visitor has explicitly told us
 * about their setup or their preference.
 */
function consentAllowsVideo(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

  const nav = navigator as NavigatorWithNetwork;
  const conn = nav.connection;

  if (conn?.saveData) return false;
  if (
    conn?.effectiveType &&
    (CONSENT.blockedEffectiveTypes as readonly string[]).includes(conn.effectiveType)
  ) {
    return false;
  }
  // iOS and macOS Low Power Mode, and Chrome's "reduce data", both report here.
  if (window.matchMedia("(update: slow)").matches) return false;
  if (
    typeof nav.deviceMemory === "number" &&
    nav.deviceMemory < CONSENT.minDeviceMemoryGb
  ) {
    return false;
  }

  return true;
}

/**
 * Has the browser buffered enough to play the clip through without stopping?
 *
 * `readyState` is the browser's own answer and is preferred. The buffered-range
 * check is the backstop for the one case it under-reports: a clip that is fully
 * in the buffer but whose `readyState` has not yet been raised, which is common
 * for a source served as a single response.
 */
function hasEnoughData(video: HTMLVideoElement): boolean {
  if (video.readyState >= HAVE_ENOUGH_DATA) return true;
  if (!Number.isFinite(video.duration) || video.duration <= 0) return false;
  if (!video.buffered.length) return false;
  const end = video.buffered.end(video.buffered.length - 1);
  return end >= video.duration - FULLY_BUFFERED_SLACK_S;
}

/** Media events that can each be the one that makes the clip ready. */
const READINESS_EVENTS = [
  "loadedmetadata",
  "loadeddata",
  "canplay",
  "canplaythrough",
  "progress",
  "durationchange",
] as const;

/** Hover is only a control on a device that has one. */
function hasFinePointer(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

/**
 * `requestIdleCallback` with a timeout, so a busy main thread delays the mount
 * rather than starving it. Safari only shipped the API recently; the timeout is
 * the fallback everywhere else.
 */
function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: 400 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(callback, 0);
  return () => window.clearTimeout(handle);
}

export type HeroVideoState = {
  /** Attach to the wrapper holding both media layers. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the `<video>`; it is only rendered while `mounted` is true. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** The element exists and its background download is running. */
  mounted: boolean;
  /** The clip owns the layer right now; this drives the dissolve. */
  revealed: boolean;
};

export function useHeroVideo(imageSrc: string): HeroVideoState {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /** The element exists and is downloading. Never un-mounted to "save" bytes. */
  const [mounted, setMounted] = useState(false);
  /** Enough buffered to play through — the reveal, and the play, key off this. */
  const [ready, setReady] = useState(false);
  /** The four unprompted passes are done; from here, only hover plays it. */
  const [autoplaySpent, setAutoplaySpent] = useState(false);
  /** Pointer is over the hero, on a device that has one. */
  const [hovering, setHovering] = useState(false);

  /**
   * Both default to visible and both are corrected by their observers on the
   * first callback. Defaulting to visible is the honest default: this hook only
   * ever runs on a page where the hero is the first thing rendered.
   */
  const [heroInView, setHeroInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState !== "hidden"
  );

  // Mount, once consent allows it and the poster is on screen. Mounting is what
  // starts the download, so the order matters: the photograph has already been
  // requested with `fetchPriority="high"` from the server HTML by the time any
  // of this runs, and waiting for its `load` keeps the clip from competing with
  // the LCP image for the first few hundred milliseconds of the connection.
  useEffect(() => {
    const container = containerRef.current;
    const image = container?.querySelector("img");
    if (!container || !image) return;
    if (!consentAllowsVideo()) return;

    let cancelled = false;
    let armed = false;
    let cancelIdle = () => {};

    const arm = () => {
      if (cancelled || armed) return;
      armed = true;
      cancelIdle = whenIdle(() => {
        if (!cancelled) setMounted(true);
      });
    };

    const armIfLoaded = () => {
      if (cancelled) return;
      if (image.complete && image.naturalWidth > 0) arm();
    };

    image.addEventListener("load", armIfLoaded, { once: true });
    /*
      Re-read the condition after the listener exists, and again on the next
      event-loop turn.

      The check above and this listener are not atomic: an image that finishes
      decoding in the microseconds between them fires `load` with nobody
      listening, and this effect — which runs exactly once — never arms. The
      clip then never mounts, which is indistinguishable from "the visitor's
      connection declined", and it is why the phone viewport showed the clip in
      one run and not the next. Re-checking is the standard guard for it.
    */
    armIfLoaded();

    return () => {
      cancelled = true;
      cancelIdle();
      image.removeEventListener("load", armIfLoaded);
    };
  }, [imageSrc]);

  // Readiness. Any one of these events can be the one that finds the clip
  // buffered, so `hasEnoughData` is asked on all of them rather than the state
  // being inferred from a single "the download finished" event that browsers do
  // not reliably send for a small file served in one response.
  useEffect(() => {
    const video = videoRef.current;
    if (!mounted || !video) return;

    let cancelled = false;

    const check = () => {
      if (cancelled) return;
      if (!hasEnoughData(video)) return;
      setReady(true);
    };

    for (const name of READINESS_EVENTS) video.addEventListener(name, check);
    // An `error` here means the browser cannot decode or cannot fetch the clip.
    // Unmounting leaves the photograph, which is the correct outcome and the
    // only case where removing the element is right.
    const onError = () => {
      if (cancelled) return;
      setMounted(false);
    };
    video.addEventListener("error", onError);
    check();

    return () => {
      cancelled = true;
      for (const name of READINESS_EVENTS) video.removeEventListener(name, check);
      video.removeEventListener("error", onError);
    };
  }, [mounted]);

  /*
    The four passes.

    `loop` is deliberately NOT set on the element: a looping video never fires
    `ended`, so there would be nothing to count the passes with and nothing to
    hand the layer back to the photograph on. Each pass therefore ends, and the
    next one is started here — which also makes the end of the fourth an event
    this hook can act on rather than a state nobody observes.
  */
  useEffect(() => {
    const video = videoRef.current;
    if (!mounted || !video) return;

    let passes = 0;
    let cancelled = false;

    const onEnded = () => {
      if (cancelled) return;
      // A hover replay loops, so an `ended` while hovering cannot arrive; if
      // one ever does, it is the end of a hover pass and hands back to the
      // photograph like any other.
      if (!hovering) {
        passes += 1;
        if (passes < AUTOPLAY_PASSES) {
          video.currentTime = 0;
          const started = video.play();
          if (started) started.catch(() => setAutoplaySpent(true));
          return;
        }
      }
      setAutoplaySpent(true);
    };

    video.addEventListener("ended", onEnded);
    return () => {
      cancelled = true;
      video.removeEventListener("ended", onEnded);
    };
  }, [mounted, hovering]);

  /*
    Hover. Only meaningful once the four passes are spent — before that the clip
    is already playing and a pointer arriving or leaving must not interrupt a
    pass or reset the count. On a coarse pointer there is no hover to give, so
    the clip parks on the photograph after its four passes and that is the end
    of it.
  */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mounted) return;

    /*
      Listen on the hero SECTION, not on the media wrapper inside it.

      The wrapper is `absolute inset-0` and it is not the topmost element under
      the pointer anywhere in the hero: the legibility scrim is an absolute
      sibling painted after it, and the copy block sits above both. Browsers fire
      `pointerenter` for the hit element and its ancestors, and a sibling is not
      an ancestor — measured, the wrapper got no pointerenter at all while the
      section got one. So the hover replay this hook documents had never once run
      for a real visitor; the clip played its passes and the hover did nothing.
    */
    const hoverTarget = container.closest("section") ?? container;

    const onEnter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !hasFinePointer()) return;
      if (!autoplaySpent) return;
      const video = videoRef.current;
      if (!video) return;
      // Loop while the pointer stays: this is a replay, not a fifth pass, so it
      // is not counted and it is not capped.
      video.loop = true;
      video.currentTime = 0;
      setHovering(true);
    };

    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !hasFinePointer()) return;
      if (!hovering) return;
      const video = videoRef.current;
      if (video) video.loop = false;
      setHovering(false);
    };

    hoverTarget.addEventListener("pointerenter", onEnter);
    hoverTarget.addEventListener("pointerleave", onLeave);
    return () => {
      hoverTarget.removeEventListener("pointerenter", onEnter);
      hoverTarget.removeEventListener("pointerleave", onLeave);
    };
  }, [mounted, autoplaySpent, hovering]);

  // Observability, installed once. These are low-frequency signals — a tab
  // switch, a scroll past the hero — so plain state is cheap and keeps the
  // play/pause decision below in one readable place.
  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === "function" && containerRef.current) {
      observer = new IntersectionObserver((entries) => {
        const latest = entries[entries.length - 1];
        setHeroInView(latest.isIntersecting && latest.intersectionRatio >= 0.25);
      });
      observer.observe(containerRef.current);
    }
    // Without IntersectionObserver the default stands, which is the correct
    // fallback: nothing will ever report the hero out of view.

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, []);

  /*
    Who owns the layer. Two independent questions:

      - Is the clip on screen at all? Yes until the four passes are spent, and
        after that only while the pointer is on the hero. This is what the
        dissolve follows, so the photograph and the clip cross-fade in both
        directions rather than one of them popping.
      - Should it be moving? Only while it is on screen *and* the tab is visible
        *and* the hero is at least partly in view. Scrolling away pauses it where
        it stands and scrolling back resumes it, with nothing to re-download.
  */
  const revealed = ready && (!autoplaySpent || hovering);
  const shouldPlay = revealed && tabVisible && heroInView;

  // The single authority on playback. Everything else expresses intent; this is
  // the one place that touches the media element, so the rules cannot disagree.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mounted) return;

    if (shouldPlay) {
      if (video.paused) {
        const started = video.play();
        // A refused play — an autoplay policy, or a browser that will not
        // autoplay at all — is treated as a real answer: the clip hands over to
        // the photograph rather than retrying in a loop.
        if (started) started.catch(() => setAutoplaySpent(true));
      }
      return;
    }

    if (!video.paused) video.pause();
  }, [shouldPlay, mounted]);

  return { containerRef, videoRef, mounted, revealed };
}
