import { Diagnostics } from "@/components/site/diagnostics";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { Projects } from "@/components/site/projects";
import { Stack } from "@/components/site/stack";
import { System } from "@/components/site/system";
import { Timeline } from "@/components/site/timeline";
import { Toast } from "@/components/site/toast";

/**
 * Page composition, de-animated.
 *
 * Three document-wide effect layers were removed from the render tree while their
 * code is kept on disk, so the page can be rebuilt section by section from a
 * clean, fully visible baseline:
 *
 *   - <SpineConduit /> (components/site/spine-conduit.tsx) — the fixed,
 *     full-viewport WebGL tracer. It was the moving background artifact behind
 *     the hero and the single most expensive thing on the page.
 *   - <MotionLayer /> (components/site/motion-layer.tsx) — the delegated
 *     IntersectionObserver that flipped `.cinematic-section` to `.is-revealed`
 *     and tracked the cursor spotlight. With it gone the sections must not rely
 *     on a reveal class to become visible, so globals.css now paints
 *     `.cinematic-section` at full opacity with no transform.
 *   - <CometTelemetry /> — removed for the same reason, see the note beside its
 *     call site below.
 *
 * None of these files were deleted — re-import them here to reintroduce the
 * effects one section at a time.
 */
export default function HomePage() {
  return (
    <>
      <div id="top" />
      <Header />
      <Hero />

      <main className="site-main w-full max-w-[1080px] mx-auto border-x border-border-line flex-1 px-6 py-8 space-y-12">
        <Diagnostics />
        <Projects />
        <Stack />
        <Timeline />
        <System />
      </main>

      <Footer />

      {/*
        <CometTelemetry /> is unmounted. It was a fixed, bottom-anchored HUD
        showing scroll-depth percentage and the current section. Because it is
        `position: fixed`, it overlaid whatever happened to be at the bottom of
        the viewport at every scroll position: measured at 1440x900 it covered
        the first two timeline milestone paragraphs and a year label. Moving it
        to the right gutter only relocated the collision onto other copy, so it
        was removed rather than nudged around.

        It also contradicted the rest of the page on its own terms. It re-derived
        section names and scroll progress the header and page structure already
        express, ran a rAF-throttled scroll listener plus a permanently looping
        `animate-pulse` dot, and it was the last remaining decorative overlay on
        a page whose brief is "keep it as clean as possible".

        components/site/comet-telemetry.tsx is kept on disk, along with
        components/site/comet-dial.tsx if present. Re-import the component here
        to bring the HUD back.
      */}
      <Toast />
    </>
  );
}