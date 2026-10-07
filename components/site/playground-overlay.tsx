"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PlaygroundAbout } from "@/components/site/playground-about";

import type { PerspectiveCamera } from "three";

/**
 * Binds the Playground's scroll-driven write-ups to the scene.
 *
 * The point of this file is to keep the copy out of React's render loop. A naive
 * wiring would hold scroll progress in state and re-render the overlay every
 * frame, which is exactly the cost this whole scene avoids elsewhere. Instead the
 * scene publishes a camera reader once and writes progress into a ref; the
 * overlay polls both in its own frame loop and writes opacity straight to the
 * DOM.
 *
 * The only state here is `landscape`, which changes rarely and legitimately needs
 * a re-render when it does.
 */

type CameraGetter = () => { camera: PerspectiveCamera; width: number; height: number } | null;

export function usePlaygroundOverlay() {
  const progressRef = useRef(0);
  const cameraGetterRef = useRef<CameraGetter | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * Upstream gates the write-ups on a landscape media query
   * (`mixins.landscape`) and lays them out differently in portrait. Read from one
   * long-lived MediaQueryList so the check costs nothing per frame.
   */
  const [landscape, setLandscape] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(min-aspect-ratio: 1)");
    const sync = () => setLandscape(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const handleCameraReady = useCallback((getter: CameraGetter) => {
    cameraGetterRef.current = getter;
    setReady(true);
  }, []);

  const getCamera = useCallback<CameraGetter>(() => cameraGetterRef.current?.() ?? null, []);

  /**
   * The element to render inside the sequence. Passing this as `about` is what
   * puts the copy in the same stacking context as the canvas, which the
   * projection requires.
   */
  const about = (
    <PlaygroundAbout
      active={ready}
      getCamera={getCamera}
      landscape={landscape}
      progressRef={progressRef}
    />
  );

  return { progressRef, handleCameraReady, about };
}
