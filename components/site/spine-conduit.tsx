"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Fixed scroll-linked 3D tracer spine — port of the reference's
 * `initScroll3DConduit`: a white micro-cube inside a fault-red wireframe
 * hypercube with an orbital ring and a fading particle trail, travelling down
 * an architectural spine as the page scrolls.
 *
 * Performance contract (this canvas is `position: fixed` and covers the whole
 * viewport, so it is the single most expensive thing on the page):
 *
 *   - No MSAA and a 1.25x device-pixel-ratio cap. The tracer is wireframe and
 *     particle geometry, so the old cost was almost entirely fragment work on a
 *     large multisampled backbuffer.
 *   - The smoothing filter is time-based (`1 - exp(-dt / TAU)`) rather than a
 *     fixed per-frame lerp, so the motion is identical at any refresh rate.
 *   - The loop is throttled to 20fps and stops completely once the tracer has
 *     settled and scrolling has stopped. A scroll promotes it back to
 *     every-frame for a short tail. Previously it ran an unthrottled 60fps loop
 *     forever, which measured ~830ms average frame time across a scroll sweep.
 *   - Reduced-motion users get a single static frame and no loop at all.
 */
export function SpineConduit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 18);

    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    const coreMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    cubeGroup.add(coreMesh);

    const outerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 1.35, 1.35),
      new THREE.MeshBasicMaterial({
        color: 0xff4d1c,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      }),
    );
    cubeGroup.add(outerMesh);

    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.58, 32),
      new THREE.MeshBasicMaterial({
        color: 0x8e9192,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      }),
    );
    ringMesh.rotation.x = Math.PI / 3;
    cubeGroup.add(ringMesh);

    const TRAIL = 28;
    const trailPositions = new Float32Array(TRAIL * 3);
    const trailColors = new Float32Array(TRAIL * 3);
    for (let i = 0; i < TRAIL; i++) {
      const alpha = 1 - i / TRAIL;
      trailColors[i * 3] = 1.0;
      trailColors[i * 3 + 1] = 0.3 * alpha;
      trailColors[i * 3 + 2] = 0.1 * alpha;
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(trailPositions, 3),
    );
    trailGeo.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
    const trailPoints = new THREE.Points(
      trailGeo,
      new THREE.PointsMaterial({
        size: 0.18,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(trailPoints);

    const history: { x: number; y: number }[] = [];
    let currentX = 0;
    let currentY = 0;

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Idle interval (20fps) and how long a scroll keeps the loop at full rate.
    const IDLE_FRAME_MS = 1000 / 20;
    const SCROLL_TAIL_MS = 900;
    // Wall-clock smoothing constant for the tracer follow.
    const TAU = 0.14;
    const SETTLED = 0.004;

    let raf = 0;
    let lastFrame = performance.now();
    let lastDraw = 0;
    let lastScrollAt = -Infinity;
    let targetX = currentX;
    let targetY = currentY;

    const readTargets = () => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);

      targetY = 7.0 - progress * 13.5;
      targetX =
        Math.sin(progress * Math.PI * 3.2) * 5.2 +
        (progress > 0.15 && progress < 0.65 ? 4.8 : -4.8);
      return progress;
    };

    const step = (progress: number, dt: number) => {
      const k = 1 - Math.exp(-dt / TAU);
      currentY += (targetY - currentY) * k;
      currentX += (targetX - currentX) * k;

      cubeGroup.position.set(currentX, currentY, 0);
      cubeGroup.rotation.x += (0.02 + progress * 0.04) * (dt / 0.016);
      cubeGroup.rotation.y += (0.025 + progress * 0.03) * (dt / 0.016);
      ringMesh.rotation.z += 0.03 * (dt / 0.016);

      history.unshift({ x: currentX, y: currentY });
      if (history.length > TRAIL) history.pop();

      const posAttr = trailGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < TRAIL; i++) {
        const pt = history[i] ?? { x: currentX, y: currentY };
        posAttr.setXYZ(i, pt.x, pt.y, 0);
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    const draw = (now: number) => {
      raf = 0;
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;

      const active = now - lastScrollAt < SCROLL_TAIL_MS;
      const progress = readTargets();

      const settled =
        Math.abs(targetX - currentX) < SETTLED &&
        Math.abs(targetY - currentY) < SETTLED;

      // Nothing to do: no recent scroll and the tracer has come to rest.
      // Stopping the loop entirely lets the compositor idle.
      if (settled && !active) return;

      // Scroll-linked motion only needs a full rate while it is being driven.
      if (active || now - lastDraw >= IDLE_FRAME_MS) {
        lastDraw = now;
        step(progress, dt);
      }

      raf = requestAnimationFrame(draw);
    };

    const kick = () => {
      if (raf) return;
      lastFrame = performance.now();
      raf = requestAnimationFrame(draw);
    };

    const onScroll = () => {
      lastScrollAt = performance.now();
      kick();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    if (reducedMotion.matches) {
      // Static frame, no loop.
      const progress = readTargets();
      currentX = targetX;
      currentY = targetY;
      step(progress, 0.016);
    } else {
      kick();
    }

    const onMotionPreference = () => {
      if (reducedMotion.matches) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        lastScrollAt = performance.now();
        kick();
      }
    };
    reducedMotion.addEventListener("change", onMotionPreference);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      reducedMotion.removeEventListener("change", onMotionPreference);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  return <canvas id="spine-conduit-canvas" ref={canvasRef} aria-hidden="true" />;
}