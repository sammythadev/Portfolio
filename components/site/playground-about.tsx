"use client";

import { useEffect, useRef } from "react";

import { ProjectedElement } from "@/components/site/projected-element";
import {
  ABOUT_REVEAL,
  DESCRIPTION_POINT,
  DETAILS_POINT,
  SERVICES_POINT,
  aboutDetails,
  aboutServices,
  aboutTagline,
} from "@/data/playground-about";

import type { PerspectiveCamera } from "three";

/**
 * The write-ups that appear over the character during the Playground's act.
 *
 * Ported from davidhckh/portfolio-2025
 * (`features/home/components/About.vue` and its four child blocks).
 *
 *   https://github.com/davidhckh/portfolio-2025 — original by David Heckhoff.
 *   CC BY-NC-SA 4.0. See README "Attribution" and the visible credit on
 *   /playground. Commercial reuse of the original work is not permitted.
 *
 * Upstream's construction, reproduced:
 *
 *   - Three blocks — a name plate, a tagline and a service list — are pinned to
 *     three fixed world-space points beside the character and track the camera
 *     every frame via `ProjectedElement`.
 *   - They reveal in sequence at 0, 0.4 and 0.8 of the act, each fading in over
 *     0.15s on `power1.out`, so they arrive one after another rather than as a
 *     group.
 *   - They are landscape-only. Upstream gates the whole apparatus on
 *     `mixins.landscape`; portrait gets a different, simpler layout which has no
 *     equivalent here because this route has no portrait-only content.
 *
 * The reveal is driven by scroll rather than a timeline: upstream plays a paused
 * GSAP timeline, but scroll progress already is the timeline in this port, so the
 * same three thresholds are read straight off it. That keeps one source of truth
 * for the act's timing instead of two that can drift apart.
 */

export interface PlaygroundAboutProps {
  /** Live camera and viewport size, read each frame by the projected blocks. */
  getCamera: () => { camera: PerspectiveCamera; width: number; height: number } | null;
  /**
   * Live scroll progress through the room-and-character act, read as a ref.
   *
   * A ref rather than a value because the reveal is evaluated every frame: taking
   * it as a prop would re-render this subtree on every scroll event for a change
   * that only ever writes an opacity string.
   */
  progressRef: React.RefObject<number>;
  /** Whether the act is on screen at all. */
  active: boolean;
  /** Upstream shows these in landscape only. */
  landscape: boolean;
}

export function PlaygroundAbout({ getCamera, progressRef, active, landscape }: PlaygroundAboutProps) {
  const detailsRef = useRef<HTMLDivElement | null>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const servicesRef = useRef<HTMLDivElement | null>(null);

  /*
    Upstream fades each block in from opacity 0 over 0.15s. Expressed as a
    progress window so it can be evaluated from scroll without a timeline:
    a block is fully hidden at its start threshold and fully shown 0.06 later,
    which is the 0.15s fade mapped onto a scroll ramp.
  */
  /*
    The reveal runs in its own frame loop, reading progress from the ref rather
    than from props.

    Upstream fades each block in from opacity 0 over 0.15s. Expressed as a
    progress window so it can be evaluated from scroll without a timeline: a block
    is hidden at its threshold and fully shown 0.06 later, which is upstream's
    0.15s fade mapped onto the scroll ramp (its three thresholds are 0, 0.4 and
    0.8 of the act).
  */
  useEffect(() => {
    let raf = 0;
    const last = [NaN, NaN, NaN];

    const apply = (index: number, node: HTMLDivElement | null, opacity: number) => {
      if (!node) return;
      // Skip identical writes: the opacity is static for most frames, and each
      // write invalidates style for that subtree.
      if (last[index] === opacity) return;
      last[index] = opacity;
      node.style.opacity = opacity.toFixed(3);
    };

    const step = (delay: number) => {
      const start = delay;
      const end = delay + 0.06;
      const p = progressRef.current;
      if (p <= start) return 0;
      if (p >= end) return 1;
      return (p - start) / (end - start);
    };

    const update = () => {
      raf = requestAnimationFrame(update);

      /*
        Upstream's blocks start hidden and only appear once the act's own timeline
        runs. Keeping them at zero until then means the room act, which shares
        this layer, never shows stray text.
      */
      const visible = active && landscape;
      apply(0, detailsRef.current, visible ? step(ABOUT_REVEAL.detailsDelay) : 0);
      apply(1, descriptionRef.current, visible ? step(ABOUT_REVEAL.descriptionDelay) : 0);
      apply(2, servicesRef.current, visible ? step(ABOUT_REVEAL.servicesDelay) : 0);
    };

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [active, landscape, progressRef]);

  const view = getCamera;

  return (
    <div className="playground-about" aria-hidden={!active || !landscape}>
      {/* Upstream `BoxDetails.vue` — name plate, revealed first. */}
      <ProjectedElement
        active={active}
        className="projected-element about-details"
        getCamera={view}
        landscape={landscape}
        point={DETAILS_POINT.point}
      >
        <div className="about-block" ref={detailsRef} style={{ opacity: 0 }}>
          <p className="about-block__name">{aboutDetails.name}</p>
          <p className="about-block__meta">
            <span className="about-block__pin" aria-hidden>
              ◦
            </span>
            {aboutDetails.location} · {aboutDetails.role}
          </p>
        </div>
      </ProjectedElement>

      {/* Upstream `BoxDescription.vue` — tagline, second. */}
      <ProjectedElement
        active={active}
        className="projected-element about-description"
        getCamera={view}
        landscape={landscape}
        point={DESCRIPTION_POINT.point}
      >
        <div className="about-block" ref={descriptionRef} style={{ opacity: 0 }}>
          <p className="about-block__name">{aboutDetails.name}</p>
          <div className="about-block__rule" />
          <p className="about-block__copy">{aboutTagline}</p>
        </div>
      </ProjectedElement>

      {/* Upstream `BoxServices.vue` — capability list, last. */}
      <ProjectedElement
        active={active}
        className="projected-element about-services"
        getCamera={view}
        landscape={landscape}
        point={SERVICES_POINT.point}
      >
        <div className="about-block" ref={servicesRef} style={{ opacity: 0 }}>
          <p className="about-block__title">Services</p>
          <ul className="about-block__list">
            {aboutServices.map((service) => (
              <li key={service} className="about-block__item">
                {service}
              </li>
            ))}
          </ul>
        </div>
      </ProjectedElement>
    </div>
  );
}
