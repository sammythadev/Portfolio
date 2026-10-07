"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/site/icon";

import type {
  StageStatus,
  WorkstationStageHandle,
} from "@/components/site/workstation-scene";

/**
 * Inspection stage shell for the real workstation asset.
 *
 * Cost control is the whole point of this file, because the panel sits well
 * below the fold but a naive implementation charges every visitor for it:
 *
 *   - `three`, `GLTFLoader`, the meshopt decoder and `RoomEnvironment` live in
 *     `workstation-scene.ts` and are pulled in with a dynamic `import()` only
 *     once the panel is within 600px of the viewport.
 *   - The 239 KB model request waits for the same trigger, then streams with a
 *     progress readout.
 *   - The imported chunk is cached after the first load, so scrolling back and
 *     forth does not re-fetch code.
 *   - React state is updated on a 250ms telemetry beat instead of per frame.
 *   - The scene skips all GPU work while off-screen.
 *
 * The reserved minimum height plus absolutely positioned canvas means the
 * dynamic import causes no layout shift.
 */
const LOAD_MARGIN = "600px";
const MIN_STAGE_HEIGHT = 380;

export function WorkstationStage({
  /**
   * Fires once, when the scene genuinely reaches `ready`.
   *
   * The Playground boot screen waits on this rather than on a timer, so the
   * progress bar cannot claim "Scene ready" over a canvas that has not drawn
   * anything. It is also the real completion signal for the GLB transfer and
   * the first frame, which is the expensive part of this section.
   */
  onReady,
}: {
  onReady?: () => void;
} = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<WorkstationStageHandle | null>(null);
  const startedRef = useRef(false);

  const [shouldLoad, setShouldLoad] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [status, setStatus] = useState<StageStatus>("loading");
  const [progress, setProgress] = useState(0);
  const [telemetry, setTelemetry] = useState({ fps: 60, rotationDeg: 0 });

  /*
    `onReady` is held in a ref so the effect that fires it depends only on
    `status`. If it were in the dependency array directly, a parent that
    re-creates the callback every render would re-run this effect on every
    render and call `onReady` repeatedly.
  */
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Only pay for the 3D chunk once the panel is actually approached.
  // IntersectionObserver is baseline in every browser Next.js 16 targets, so
  // there is no polling fallback to keep.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || startedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        startedRef.current = true;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: LOAD_MARGIN },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let cancelled = false;
    let handle: WorkstationStageHandle | null = null;

    const boot = async () => {
      try {
        // Same specifier as the static type import above: TypeScript resolves
        // the types from the top of the file, so making it `import type` there
        // avoids pulling `three` into the initial bundle.
        const { createWorkstationStage } = await import(
          "@/components/site/workstation-scene"
        );
        if (cancelled) return;

        handle = createWorkstationStage({
          canvas,
          container,
          initialWireframe: false,
          onProgress: setProgress,
          onStatus: setStatus,
          onTelemetry: (next) =>
            setTelemetry((previous) => ({
              fps: next.fps >= 0 ? next.fps : previous.fps,
              rotationDeg: next.rotationDeg,
            })),
        });
        handleRef.current = handle;
      } catch (error) {
        if (cancelled) return;
        console.error("[workstation-stage] failed to initialise scene:", error);
        setStatus("error");
      }
    };

    void boot();

    return () => {
      cancelled = true;
      handle?.dispose();
      handleRef.current = null;
    };
  }, [shouldLoad]);

  useEffect(() => {
    if (status !== "ready") return;
    // Stable ref so the callback identity of the parent does not re-fire this.
    onReadyRef.current?.();
  }, [status]);

  useEffect(() => {
    handleRef.current?.setWireframe(wireframe);
  }, [wireframe]);

  const resetCamera = useCallback(() => {
    handleRef.current?.resetCamera();
  }, []);

  return (
    <div
      className="workstation-stage-container"
      ref={containerRef}
      style={{ minHeight: MIN_STAGE_HEIGHT }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {status !== "ready" && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none"
        >
          {status === "loading" ? (
            <>
              <span className="w-6 h-6 rounded-full border-2 border-white/15 border-t-signal-fault animate-spin" />
              <span className="font-label-code text-[11px] text-text-dim">
                {!shouldLoad || progress === 0
                  ? "Initialising inspection stage"
                  : `Loading workstation.glb · ${Math.round(progress * 100)}%`}
              </span>
            </>
          ) : (
            <span className="font-label-code text-[11px] text-signal-fault bg-black/70 backdrop-blur px-3 py-1.5 rounded border border-white/10">
              workstation.glb unavailable
            </span>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-4 pointer-events-none z-10 flex items-center gap-2 font-label-tag text-[10px] text-text-dim bg-black/70 backdrop-blur px-2.5 py-1 rounded-md border border-white/10">
        <Icon name="touch_app" className="text-[13px] text-primary" />
        <span>Move pointer to tilt · Drag to inspect</span>
      </div>

      {/*
        The badge used to carry an `animate-pulse` dot, implying a live
        telemetry feed. Two problems: a permanent CSS animation runs for as long
        as the section is on screen, and the FPS counter reads 0 on software
        rendering and is not meaningful to a visitor either way. The dot is now
        static and only shows once the scene is actually live, and the readout
        states rotation rather than quoting a frame rate the reader cannot
        verify.
      */}
      <div
        className={`absolute top-3 right-4 pointer-events-none z-10 items-center gap-2 font-label-code text-[11px] text-[#ededed] bg-black/60 px-2 py-1 rounded border border-white/10 ${
          status === "ready" ? "hidden sm:flex" : "hidden"
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-signal-fault" />
        <span>ROT: {telemetry.rotationDeg}°</span>
      </div>

      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWireframe((prev) => !prev)}
          aria-pressed={wireframe}
          className="px-2 py-1 rounded border border-border-line bg-black/70 backdrop-blur hover:bg-surface-hover text-text-dim hover:text-primary transition-colors flex items-center gap-1 font-label-tag text-[10px]"
        >
          <Icon name="grid_4x4" className="text-[14px]" />
          <span className="hidden md:inline">Wireframe</span>
        </button>
        <button
          type="button"
          onClick={resetCamera}
          aria-label="Reset camera"
          className="p-1 rounded border border-border-line bg-black/70 backdrop-blur hover:bg-surface-hover text-text-dim hover:text-primary transition-colors"
        >
          <Icon name="restart_alt" className="text-[14px]" />
        </button>
        <span className="hidden lg:inline font-label-tag text-[10px] text-text-dim bg-black/70 backdrop-blur px-2 py-1 rounded border border-border-line">
          meshopt · webp
        </span>
      </div>

      {/*
        Required CC BY 4.0 attribution for the "Desktop Computer Pack" model.

        This credit was lost when the model moved out of the Stack section into
        this one, and CC BY 4.0 requires the attribution to travel with the
        work wherever it is reproduced. It is rendered here rather than left in a
        source comment, because a comment does not satisfy the licence.
      */}
      <p className="absolute bottom-3 right-4 z-10 m-0 max-w-[46ch] text-right font-label-tag text-[10px] leading-snug text-text-dim">
        Model{" "}
        <a
          className="text-on-surface underline decoration-border-line underline-offset-2 hover:decoration-signal-fault"
          href="https://sketchfab.com/3d-models/desktop-computer-pack-free-low-poly-6ca13950cf88438b970522e75a6d5f51"
          rel="noreferrer noopener"
          target="_blank"
        >
          &ldquo;Desktop Computer Pack&rdquo; by LagzDesign
        </a>{" "}
        ·{" "}
        <a
          className="text-on-surface underline decoration-border-line underline-offset-2 hover:decoration-signal-fault"
          href="https://creativecommons.org/licenses/by/4.0/"
          rel="noreferrer noopener"
          target="_blank"
        >
          CC BY 4.0
        </a>
      </p>
    </div>
  );
}