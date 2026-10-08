"use client";

import { useEffect, useState } from "react";

import CometDial from "@/components/reactbits/CometDial";

const TRACKED_SECTIONS = ["projects", "stack", "timeline", "system"] as const;

/**
 * Bottom-left telemetry HUD driven by the React Bits <CometDial /> component.
 *
 * The reference drew an equivalent SVG dial by hand and wired it to scroll
 * position; here the vendored component is used directly as a read-only depth
 * gauge (`disabled`), with the active-section and pixel readouts alongside it.
 */
export function CometTelemetry() {
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("HERO");
  const [readout, setReadout] = useState("0 / 0 px");
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    let raf = 0;
    let lastProgress = -1;
    let lastSection = "";
    let lastReadout = "";
    let lastPastHero = false;

    const update = () => {
      raf = 0;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const ratio = Math.min(Math.max(scrollY / maxScroll, 0), 1);
      const rounded = Math.round(ratio * 100);

      /*
        Every value is compared before being written. The old version called
        four `setState`s on every scroll frame unconditionally, so React
        re-rendered this component (and re-measured the SVG dial) 60 times a
        second during a scroll sweep for values that change at most once a
        second in practice.
      */
      if (rounded !== lastProgress) {
        lastProgress = rounded;
        setProgress(rounded);
      }

      const nextReadout = `${Math.round(scrollY)} / ${Math.round(maxScroll)} px`;
      if (nextReadout !== lastReadout) {
        lastReadout = nextReadout;
        setReadout(nextReadout);
      }

      let active = "HERO";
      for (const id of TRACKED_SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.45) {
          active = id.toUpperCase();
        }
      }
      if (active !== lastSection) {
        lastSection = active;
        setActiveSection(active);
      }

      const nextPastHero = scrollY > window.innerHeight * 0.9;
      if (nextPastHero !== lastPastHero) {
        lastPastHero = nextPastHero;
        setPastHero(nextPastHero);
      }
    };

    /*
      The old guard re-assigned `raf` inside the callback before running the
      update, and `update` then cleared a different handle — so `raf` held a
      consumed id, the `if (!raf)` guard failed, and the handler stopped
      scheduling after the first frame. Clearing `raf` at the top of `update`
      (as below) keeps the guard honest.
    */
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    /*
      Pinned bottom-RIGHT. It was bottom-left, which put it directly over the
      timeline's own copy: at 1440x900 the 230x110 box occupied x 24-254,
      y 766-876 and measurably overlapped the milestone title, its detail
      paragraph and the rail node marker. Every section on this page is
      left-aligned, so the right gutter is the only side that stays clear.
      `bottom-6 right-6` also keeps it inside the hero's bottom-left CTA row at
      that width, which is the other place it used to steal clicks. The HUD is
      hidden until the user has scrolled past the hero and only then fades in.
      `hidden sm:flex` still keeps it off phones entirely.
    */
    <div
      className={`comet-telemetry fixed bottom-6 right-6 z-50 hidden sm:flex items-center gap-3 bg-surface-card/92 border border-border-line rounded-xl p-3 select-none transition-opacity duration-300 ${
        pastHero ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!pastHero}
    >
      {/* `label` on CometDial is only exposed as an ARIA label, so the visible
          DEPTH caption from the reference design is rendered alongside it. */}
      <div className="relative shrink-0">
        <CometDial
          value={progress}
          min={0}
          max={100}
          unit="%"
          label="Scroll depth"
          accent="#ff4d1c"
          ink="#ededed"
          size={76}
          sweep={300}
          thickness={5}
          disabled
          onChange={() => {}}
          onChangeEnd={() => {}}
        />
        <span className="absolute left-1/2 -bottom-0.5 -translate-x-1/2 font-label-tag text-[9px] text-text-dim tracking-wider whitespace-nowrap">
          DEPTH
        </span>
      </div>

      <div className="flex flex-col justify-center pr-2 font-label-tag border-l border-border-line pl-2.5 space-y-0.5">
        <div className="flex items-center gap-1.5 text-[10px] text-text-dim font-mono tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-signal-fault animate-pulse" />
          <span>SYS_TELEMETRY</span>
        </div>
        <div className="flex items-center gap-1 font-label-code text-[11px] text-on-surface">
          <span className="text-text-dim">NODE:</span>
          <span className="text-primary font-semibold tracking-wide">
            {activeSection}
          </span>
        </div>
        <div className="text-[9px] text-text-dim font-mono tracking-tight">
          {readout}
        </div>
      </div>
    </div>
  );
}