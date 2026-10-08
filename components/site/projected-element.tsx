"use client";

import { useEffect, useRef } from "react";
import { Vector3 } from "three";

import type { PerspectiveCamera } from "three";

/**
 * Pins an HTML block to a point in the 3D scene.
 *
 * Ported from davidhckh/portfolio-2025 (`components/ProjectedElement.vue`).
 *
 *   https://github.com/davidhckh/portfolio-2025 — original by David Heckhoff.
 *   CC BY-NC-SA 4.0. See README "Attribution" and the visible credit on
 *   /playground. Commercial reuse of the original work is not permitted.
 *
 * This is how upstream puts real, selectable HTML text into a WebGL scene
 * without a second DOM-rendering path: the copy lives in normal markup and a
 * per-frame transform moves its wrapper to wherever a world-space point lands on
 * screen. The text stays crisp and accessible, and it can be styled with the
 * site's own CSS rather than rebuilt as geometry.
 *
 * Two details are upstream's and both matter:
 *
 *   - The transform is written to `style.transform` directly rather than through
 *     React state. A state update per frame would re-render the tree sixty times
 *     a second; this writes one string to one node.
 *   - The string is compared against the last value before being written. The
 *     camera is often static for several frames at a time, and skipping the
 *     identical write avoids a pointless style invalidation each time.
 *
 * Upstream suppresses the element entirely outside the about act
 * (`in === 0` or `out === 1`); here that becomes an explicit `active` flag, since
 * this port drives its acts from a single scroll value rather than GSAP weights.
 */

export interface ProjectedElementProps {
  /** World-space point to project, matching upstream's `new Vector3(...)` args. */
  point: readonly [number, number, number];
  /**
   * Read the live camera and viewport each frame. Returning null hides the
   * element. The size is passed with the camera because the projection needs it
   * and a camera in three.js has no reference to the canvas it renders to.
   */
  getCamera: () => { camera: PerspectiveCamera; width: number; height: number } | null;
  /** Whether the owning act is on screen. False hides the element. */
  active: boolean;
  /** Project only in landscape, as upstream does. */
  landscape: boolean;
  className?: string;
  children: React.ReactNode;
}

export function ProjectedElement({
  point,
  getCamera,
  active,
  landscape,
  className,
  children,
}: ProjectedElementProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let lastTransform = "";
    let lastVisible: boolean | null = null;

    const scratch = new Vector3();

    const update = () => {
      raf = requestAnimationFrame(update);
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      /*
        Upstream hides the element outside the about act rather than leaving it
        parked off-screen, so the copy never appears over the room or the footer.
      */
      const visible = active && landscape;
      if (visible !== lastVisible) {
        wrapper.style.visibility = visible ? "visible" : "hidden";
        lastVisible = visible;
      }
      if (!visible) return;

      const view = getCamera();
      if (!view) return;
      const { camera, width, height } = view;

      /*
        A single reused Vector3, projected with three's own `project`.

        An earlier version multiplied the matrices by hand to avoid the
        allocation, and got it wrong — the clip-space W divide was applied to
        already-divided coordinates, so the offsets came out in the tens of
        thousands of pixels. Upstream simply calls `point.clone().project(camera)`
        (`core/camera.ts`), and one reused vector gives the same allocation-free
        result without reimplementing the maths.
      */
      scratch.set(point[0], point[1], point[2]).project(camera);

      /*
        Upstream's `project` returns offsets from the viewport centre, matching
        the `top: 50%; left: 50%` origin the projected wrappers are positioned
        with. Y is negated because clip space is Y-up and screen space is Y-down.
      */
      const screenX = scratch.x * width * 0.5;
      const screenY = -scratch.y * height * 0.5;

      const transform = `translate(${screenX.toFixed(2)}px, ${screenY.toFixed(2)}px)`;
      if (transform !== lastTransform) {
        wrapper.style.transform = transform;
        lastTransform = transform;
      }
    };

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [point, getCamera, active, landscape]);

  return (
    <div ref={wrapperRef} className={className} style={{ visibility: "hidden" }}>
      {children}
    </div>
  );
}
