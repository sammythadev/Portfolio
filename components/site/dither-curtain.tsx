"use client";

import { useEffect, useRef, useState } from "react";

import DitherVeil from "@/components/reactbits/DitherVeil";
import { Icon } from "@/components/site/icon";
import { DITHER_SOURCE } from "@/components/site/dither-source";

const PATTERNS = [
  { id: "floyd", label: "Floyd" },
  { id: "atkinson", label: "Atkinson" },
  { id: "bayer", label: "Bayer" },
  { id: "noise", label: "Noise" },
  { id: "lines", label: "Lines" },
] as const;

type PatternId = (typeof PATTERNS)[number]["id"];

/**
 * Interactive dither curtain driven by the React Bits <DitherVeil /> component.
 *
 * Replaces the reference's hand-rolled 2D-canvas dither loop: the pattern
 * buttons now control the real component's `pattern` prop instead of a local
 * draw routine.
 */
export function DitherCurtain({
  /**
   * Fires once the veil has actually drawn. The Playground boot screen waits on
   * this so the bar cannot reach "Scene ready" while the curtain is still an
   * empty canvas waiting on its fragment program to compile.
   */
  onReady,
}: {
  onReady?: () => void;
} = {}) {
  const [pattern, setPattern] = useState<PatternId>("floyd");
  const [enabled, setEnabled] = useState(true);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  /*
    Readiness is observed rather than assumed: wait for the real canvas to have
    non-zero pixels. A fragment shader can take a while to compile on first use,
    and on a software rasteriser the first painted frame arrives well after the
    component mounts, so a mount-time callback would have been a lie.

    <DitherVeil /> appends its canvas into its own wrapper rather than exposing
    a ref, so the canvas is located through that wrapper's class. The check
    allows three frames because the first can land before the container has been
    measured and still be 0x0.
  */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frames = 0;
    let raf = 0;

    const check = () => {
      frames += 1;
      const canvas = root.querySelector("canvas");
      if (canvas && canvas.width > 0 && canvas.height > 0 && frames > 3) {
        onReadyRef.current?.();
        return;
      }
      raf = requestAnimationFrame(check);
    };

    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="rounded-xl border border-border-line bg-surface-card overflow-hidden relative"
      ref={rootRef}
    >
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-border-line bg-surface-card/95 font-label-code text-[12px] gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon name="blur_on" className="text-[15px] text-signal-fault shrink-0" />
          <span className="text-primary font-semibold tracking-tight truncate">
            Ordered Dither Playground
          </span>
          <span className="hidden md:inline text-text-dim text-[11px]">
            live WebGL pattern
          </span>
        </div>

        <div className="flex items-center gap-2 font-label-tag text-[11px]">
          <button
            type="button"
            onClick={() => setEnabled((prev) => !prev)}
            aria-pressed={enabled}
            className="px-2.5 py-1 rounded border border-border-line bg-surface-container hover:bg-surface-hover text-primary flex items-center gap-1.5 transition-colors"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: enabled ? "#ff4d1c" : "#6b6b6b" }}
            />
            <span>{enabled ? "Veil Active" : "Veil Bypassed"}</span>
          </button>

          <div
            className="hidden sm:flex items-center gap-1 bg-surface-container-lowest p-0.5 rounded border border-border-line"
            role="group"
            aria-label="Dither pattern"
          >
            {PATTERNS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPattern(option.id)}
                aria-pressed={pattern === option.id}
                className={`px-2 py-0.5 rounded font-mono text-[10px] transition-colors ${
                  pattern === option.id
                    ? "bg-surface-container text-primary"
                    : "text-text-dim hover:text-on-surface"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative h-[300px] sm:h-[380px] bg-background">
        {enabled ? (
          <DitherVeil
            src={DITHER_SOURCE}
            fit="cover"
            pattern={pattern}
            pixelSize={2}
            levels={2}
            palette="duotone"
            inkColor="#050505"
            paperColor="#ededed"
            contrast={1.15}
            revealRadius={200}
            softness={0.6}
            clickBurst
            wander
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,#151515_0%,#080808_80%,#000000_100%)]" />
        )}

        <div className="absolute bottom-3 left-4 pointer-events-none z-10 flex items-center gap-2 font-label-tag text-[10px] text-text-dim bg-black/70 backdrop-blur px-2.5 py-1 rounded-md border border-white/10">
          <Icon name="touch_app" className="text-[13px] text-primary" />
          <span>Move to unveil · Click to burst</span>
        </div>
      </div>

      <div className="px-4 py-2 bg-surface-container-lowest border-t border-border-line flex flex-wrap items-center justify-between text-[11px] font-label-code text-text-dim gap-2">
        <span className="hidden sm:inline">SRC: ogl · WebGL fragment pipeline</span>
        <span className="text-primary font-mono">
          &lt;DitherVeil pattern={pattern} pixelSize=2 softness=0.6 /&gt;
        </span>
      </div>
    </div>
  );
}