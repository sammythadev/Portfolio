"use client";

/**
 * Playground stage — the three real-time surfaces, loaded on demand.
 *
 * All three are heavy: <WorkstationStage /> is a three.js scene with a
 * Draco-compressed GLB, <DitherCurtain /> is a fragment-shader pipeline, and
 * <GridFloor /> is the ported perspective-grid shader. Each is imported through
 * `next/dynamic` with `ssr: false`, so none of them is in the initial payload
 * and none touches the server render.
 *
 * `ssr: false` is required rather than cosmetic here. All three read `window`
 * and touch WebGL during setup, and rendering them on the server would ship a
 * GPU-adjacent bundle to the first paint — the exact cost this page exists to
 * avoid. Each placeholder is sized to its real child so nothing shifts when the
 * chunk resolves.
 *
 * Attribution
 * ------------
 * The grid-floor effect is ported from github.com/davidhckh/portfolio-2025 by
 * David Heckhoff, licensed CC BY-NC-SA 4.0, which requires that derivative works
 * preserve the credit comments, carry an attribution section, and show a visible
 * reference to the original. The visible credit sits below.
 *
 * It is a rewrite, not a port of their scene: the original is Vue 3 on Vite with
 * a GSAP-driven multi-scene graph, this is React on Next.js with a standalone
 * ogl renderer. The shader maths is the part carried across.
 */

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import {
  BootScreen,
  useNearViewport,
  useResourceProgress,
  type StageId,
} from "@/components/site/boot-screen";
import { usePlaygroundOverlay } from "@/components/site/playground-overlay";

function StageSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center border border-border-line bg-surface-container-lowest font-mono text-[11px] text-text-dim"
      style={{ minHeight: "360px" }}
    >
      {label}
    </div>
  );
}

const WorkstationStage = dynamic(
  () =>
    import("@/components/site/workstation-stage").then((m) => m.WorkstationStage),
  { ssr: false, loading: () => <StageSkeleton label="Reserving GPU context" /> }
);

const DitherCurtain = dynamic(
  () => import("@/components/site/dither-curtain").then((m) => m.DitherCurtain),
  { ssr: false, loading: () => <StageSkeleton label="Compiling shader pipeline" /> }
);

const ScrollSequence = dynamic(
  () => import("@/components/site/scroll-sequence").then((m) => m.ScrollSequence),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300vh]" aria-hidden />
    ),
  }
);

/*
  Substrings matched against Resource Timing entries. The GLB and its Draco
  sidecar dominate the transfer, so they are named explicitly rather than
  matching a wildcard over every request the page makes.
*/
const TRACKED = ["workstation", "dither"];

export function PlaygroundStages({ overlay }: { overlay?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const near = useNearViewport(ref, "360px");

  const { about, progressRef, handleCameraReady } = usePlaygroundOverlay();
  const [booted, setBooted] = useState(false);
  const [sequenceReady, setSequenceReady] = useState(false);
  const [otherReady, setOtherReady] = useState(0);

  /*
    The progress poll is gated on the load itself, not on proximity.

    It used to run whenever the route was merely `near`, which meant it kept
    scanning Resource Timing and re-rendering every frame long after everything
    had loaded — for the rest of the session, competing with the WebGL loop.
    Once the first act is ready there is nothing left to report, so the poll is
    switched off and the bar holds its final value.
  */
  const progress = useResourceProgress(TRACKED, near && !sequenceReady);

  /*
    Only the scroll sequence gates the boot screen.

    It is the act actually on screen when this route opens, and it is the only
    child with no additional gating of its own. The two stages below it sit far
    enough down that their own IntersectionObservers have not fired yet — the
    workstation stage in particular will not load its GLB until it is within
    600px of the viewport. Waiting on all three meant the boot screen sat over a
    working canvas waiting for work that had deliberately not been started, and
    the percentage froze at 92% until the visitor scrolled.

    So the boot screen clears on the first act's genuine first frame, and the
    later stages keep their own in-place loading states, which are already
    sized to avoid layout shift.
  */
  const onSequenceReady = useCallback(() => setSequenceReady(true), []);
  const onChildReady = useCallback(() => setOtherReady((n) => n + 1), []);

  const stage: StageId = !near ? "link" : sequenceReady ? "ready" : "chunk";

  const dismiss = useCallback(() => setBooted(true), []);

  return (
    <div ref={ref}>
      {near ? (
        <div className="space-y-14">
          {/*
            Act one is the scroll sequence and nothing else. It is rendered above
            the stages, out of flow, so scrolling through it happens before any
            other surface is requested — which is the whole point of gating them
            behind it.
          */}
          <ScrollSequence
            about={about}
            onCameraReady={handleCameraReady}
            onReady={onSequenceReady}
            overlay={overlay}
            progressRef={progressRef}
          />

          {/*
            Acts two onward. Rendered after the scroll sequence in document order,
            so they exist by the time the pinned canvas has finished its move.
          */}
          <div className="space-y-14 pt-8">
          <section aria-labelledby="pg-workstation">
            <StageHeading
              id="pg-workstation"
              index="02"
              title="Workstation stage"
              note="three.js inspection stage. Drag to orbit, scroll to zoom, toggle wireframe."
              src="three.js r186 · meshopt"
            />
            <div className="relative overflow-hidden rounded-xl border border-border-line bg-surface-card">
              <WorkstationStage onReady={onChildReady} />
            </div>
          </section>

          <section aria-labelledby="pg-dither">
            <StageHeading
              id="pg-dither"
              index="03"
              title="Ordered dither"
              note="Live fragment pipeline. Move to unveil the source image, click to burst it."
              src="ogl · WebGL fragment"
            />
            <DitherCurtain onReady={onChildReady} />
          </section>
          </div>
        </div>
      ) : (
        <div
          aria-hidden
          className="flex min-h-[320px] items-center justify-center rounded-xl border border-border-line bg-surface-card font-mono text-[11px] text-text-dim"
        >
          Scroll to load the stages
        </div>
      )}

      {near && !booted ? (
        <div className="fixed inset-0 z-40">
          <BootScreen
            done={sequenceReady}
            onDismiss={dismiss}
            progress={progress}
            stage={stage}
          />
        </div>
      ) : null}
    </div>
  );
}

function StageHeading({
  id,
  index,
  title,
  note,
  src,
}: {
  id: string;
  index: string;
  title: string;
  note: string;
  src: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
      <div className="min-w-0">
        <h2
          className="font-headline-md text-[18px] font-semibold tracking-tight text-primary"
          id={id}
        >
          {title}
        </h2>
        <p className="font-body-sm text-[13px] text-text-dim">{note}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 font-label-tag text-[11px] text-text-dim">
        <span className="rounded border border-border-line px-2 py-0.5 font-mono">
          {index}
        </span>
        <span className="hidden font-mono sm:inline">{src}</span>
      </div>
    </div>
  );
}