"use client";

/**
 * The three.js half of the workstation inspection stage.
 *
 * This module is only ever reached through a dynamic `import()` from
 * `workstation-stage.tsx`, so `three`, `GLTFLoader`, the meshopt decoder and
 * `RoomEnvironment` stay out of the initial page bundle and are not parsed
 * until the stage is actually approached. Keep it free of React.
 *
 * The model is `public/models/workstation.glb`, built by
 * `scripts/optimize-models.mjs` from the CC-BY Sketchfab source. It is 239 KB
 * (down from 12.2 MB) and needs the meshopt decoder plus `EXT_texture_webp`,
 * which is why `MeshoptDecoder` is wired in explicitly.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const MODEL_URL = "/models/workstation.glb";

/** Frames the asset inside the 40° frustum regardless of its authored scale. */
const FIT_RADIUS = 3.1;
const FRAME_MARGIN = 1.16;
const CAMERA_DISTANCE = 7.8;
const POINTER_TILT_X = 0.4;
const POINTER_TILT_Y = 0.8;
/** Tames the environment reflection; the asset already ships specular maps. */
const ENV_INTENSITY = 0.45;
/** Decorative scene: 30fps is plenty and halves GPU wake-ups. */
const FRAME_INTERVAL = 1000 / 30;
/** Telemetry is throttled so React re-renders ~4x/s, not per frame. */
const TELEMETRY_INTERVAL = 250;

export type StageStatus = "loading" | "ready" | "error";

export type StageTelemetry = {
  fps: number;
  rotationDeg: number;
};

export type WorkstationStageOptions = {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  initialWireframe?: boolean;
  onProgress?: (fraction: number) => void;
  onStatus?: (status: StageStatus) => void;
  onTelemetry?: (telemetry: StageTelemetry) => void;
};

export type WorkstationStageHandle = {
  setWireframe: (value: boolean) => void;
  resetCamera: () => void;
  dispose: () => void;
};

export function createWorkstationStage(
  options: WorkstationStageOptions,
): WorkstationStageHandle {
  const { canvas, container, onProgress, onStatus, onTelemetry } = options;

  let wireframe = options.initialWireframe ?? false;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40,
    Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
    0.1,
    100,
  );

  const group = new THREE.Group();
  scene.add(group);

  /**
   * Image-based lighting from `RoomEnvironment` (a generated PMREM, no HDR
   * download). Gives the metal/rough materials real specular response — a
   * hand-built box rig lit them flat.
   */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const envTarget = pmrem.fromScene(roomEnvironment, 0.04);
  scene.environment = envTarget.texture;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.9);
  dirLight.position.set(4, 7, 6);
  scene.add(dirLight);

  let materials: THREE.MeshStandardMaterial[] = [];
  let ready = false;
  let disposed = false;

  // --- Interaction --------------------------------------------------------
  const onPointerMove = (event: PointerEvent) => {
    if (!ready) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    group.rotation.y = x * POINTER_TILT_Y;
    group.rotation.x = y * POINTER_TILT_X;
  };
  container.addEventListener("pointermove", onPointerMove);

  const onResize = () => {
    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  // A lost context would otherwise freeze the canvas silently.
  const onContextLost = (event: Event) => {
    event.preventDefault();
    onStatus?.("error");
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  // --- Asset load ---------------------------------------------------------
  const controller = new AbortController();

  const load = async () => {
    onStatus?.("loading");

    // Meshopt's ready promise must settle before compressed buffer views can
    // be decoded.
    await MeshoptDecoder.ready;

    const response = await fetch(MODEL_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${MODEL_URL}`);
    }

    const total = Number(response.headers.get("content-length")) || 0;
    const reader = response.body?.getReader();
    let bytes: Uint8Array;

    if (reader) {
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (total > 0) onProgress?.(Math.min(received / total, 1));
      }
      bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
    } else {
      bytes = new Uint8Array(await response.arrayBuffer());
    }

    if (disposed) return;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    // parse() avoids a second request now that the bytes are already here.
    const gltf = await loader.parseAsync(bytes.buffer as ArrayBuffer, "/models/");

    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }

    const model = gltf.scene;

    // Frame whatever the asset's authored scale is, so the camera never has to
    // be re-tuned if the model is swapped again.
    const initial = new THREE.Box3().setFromObject(model);
    const initialSphere = initial.getBoundingSphere(new THREE.Sphere());
    model.scale.setScalar(initialSphere.radius > 0 ? FIT_RADIUS / initialSphere.radius : 1);

    // Re-measure after scaling and re-centre on the origin.
    const scaled = new THREE.Box3().setFromObject(model);
    model.position.sub(scaled.getCenter(new THREE.Vector3()));

    const framed = new THREE.Box3()
      .setFromObject(model)
      .getBoundingSphere(new THREE.Sphere());
    const distance = Math.max(
      CAMERA_DISTANCE,
      (framed.radius / Math.sin((camera.fov * Math.PI) / 360)) * FRAME_MARGIN,
    );
    camera.position.set(0, distance * 0.28, distance);
    camera.lookAt(0, 0, 0);

    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        if (material instanceof THREE.MeshStandardMaterial) {
          // The source ships specularFactor ~0.16–0.28; at full strength the
          // enclosure blows out under the new environment map.
          material.envMapIntensity = ENV_INTENSITY;
          material.wireframe = wireframe;
          materials.push(material);
        }
      }
    });

    group.add(model);
    ready = true;
    onStatus?.("ready");
  };

  load().catch((error) => {
    if (disposed || (error as Error)?.name === "AbortError") return;
    console.error("[workstation-stage] failed to load model:", error);
    onStatus?.("error");
  });

  // --- Render loop --------------------------------------------------------
  let raf = 0;
  let frames = 0;
  let lastFrameAt = 0;
  let lastFpsAt = performance.now();
  let lastTelemetryAt = 0;
  let isInView = true;

  const render = (now: number) => {
    raf = requestAnimationFrame(render);

    // Skip all GPU work while scrolled out of view. `lastFrameAt` is reset so
    // the first frame after scrolling back renders immediately.
    if (!isInView) {
      lastFrameAt = now;
      lastFpsAt = now;
      frames = 0;
      return;
    }
    if (now - lastFrameAt < FRAME_INTERVAL) return;
    lastFrameAt = now;

    renderer.render(scene, camera);

    frames++;
    if (now - lastFpsAt >= 1000) {
      const fps = Math.round((frames * 1000) / (now - lastFpsAt));
      frames = 0;
      lastFpsAt = now;
      if (now - lastTelemetryAt >= TELEMETRY_INTERVAL) {
        lastTelemetryAt = now;
        onTelemetry?.({ fps, rotationDeg: rotationOf(group) });
      }
    } else if (now - lastTelemetryAt >= TELEMETRY_INTERVAL) {
      // Rotation changes with the pointer, so report it independently of the
      // once-per-second FPS sample.
      lastTelemetryAt = now;
      onTelemetry?.({ fps: -1, rotationDeg: rotationOf(group) });
    }
  };
  raf = requestAnimationFrame(render);

  // Pause rendering entirely while scrolled out of view.
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      isInView = entry.isIntersecting;
      renderer.domElement.style.visibility = isInView ? "visible" : "hidden";
    },
    { rootMargin: "200px" },
  );
  visibilityObserver.observe(container);

  // --- Handle -------------------------------------------------------------
  return {
    setWireframe(value: boolean) {
      wireframe = value;
      for (const material of materials) material.wireframe = value;
    },
    resetCamera() {
      group.rotation.set(0, 0, 0);
      onTelemetry?.({ fps: -1, rotationDeg: 0 });
    },
    dispose() {
      disposed = true;
      controller.abort();

      cancelAnimationFrame(raf);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      container.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("webglcontextlost", onContextLost);

      scene.remove(group);
      disposeObject(group);
      materials = [];
      ready = false;

      scene.environment = null;
      envTarget.dispose();
      roomEnvironment.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

function rotationOf(object: THREE.Object3D): number {
  return Math.round(((object.rotation.y * 180) / Math.PI) * 10) / 10;
}

/** Releases every GPU resource under `root`. */
function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}