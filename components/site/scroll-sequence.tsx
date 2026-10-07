"use client";

/**
 * Act one of the playground — the scroll-driven scene.
 *
 * Ported from the interactive portfolio at github.com/davidhckh/portfolio-2025 by
 * David Heckhoff, licensed CC BY-NC-SA 4.0. Original: https://david-hckh.com
 *
 * The interaction model reproduced here is upstream's: the page does not scroll
 * a camera, it *is* the camera. Named waypoints are defined per act, each act
 * holds a weight, and the camera is the weighted average of every waypoint with
 * weight above zero. Because it is an average rather than a tween, two acts that
 * are both partly in view blend continuously — which is what stops the sequence
 * reading as three separate shots.
 *
 * Renderer choice
 * ---------------
 * Upstream renders its grid floor and its character in one three.js scene. Here
 * they are split across two contexts on purpose: the grid floor is a fullscreen
 * ogl shader and the character is a skinned three.js mesh, and forcing both
 * through one renderer would mean giving up either the skinned matcap shaders or
 * the ability to defer the two independently. Both are dynamically imported, so
 * neither lands in the route's initial payload.
 *
 * What was changed from upstream beyond the reimplementation:
 *   - Colours. Upstream's `#0157A0` / `#34BCFD` are a saturated blue pair. This
 *     uses the site hairline and the single fault accent, keeping the sequence
 *     inside the existing "Engineered Restraint" system.
 *   - The scroll is the only scrub driver, with no per-transition GSAP timeline
 *     and no scene graph, because a standalone route has nothing to blend
 *     against and each extra timeline would buy nothing.
 *
 * See also the visible credit in `app/playground/page.tsx`.
 */

import { useEffect, useRef } from "react";

import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";


type Waypoint = { position: number[]; focus: number[] };

/**
 * One waypoint per act. Landscape and portrait get genuinely different framings
 * rather than a scaled one: a camera pulled back far enough to read on a 16:9
 * display sits so far away on a 390px phone that the character is a smudge.
 */
/**
 * Scroll ranges for the three acts, as fractions of the pinned frame.
 *
 * Upstream needs none of this: every scene owns its own DOM section, so its
 * ScrollTriggers space the acts automatically. Here they share one section, and
 * these two numbers are the whole of the spacing decision — which is why they
 * are named rather than inline.
 */
const ACTS = {
  /** Fraction at which the room -> character handoff completes and the lab holds. */
  labEnd: 0.6,
  /** Fraction at which the contact footer starts taking over. */
  contactStart: 0.78,
} as const;

/**
 * Upstream's contact camera, verbatim from `core/camera.ts`.
 *
 * The contact act is the one place upstream does NOT use the waypoint blend: it
 * keeps a separate pair of position/focus values and switches to them when
 * `sceneWeights.contact > 0.001`. That is why the footer is framed as a close,
 * low portrait of the sleeping character rather than from any waypoint — reusing
 * the about waypoints here framed the lab podium instead and the scene never
 * appeared to change.
 */
const CONTACT_CAMERA: Record<"landscape" | "portrait", { position: [number, number, number]; focus: [number, number, number] }> = {
  landscape: { position: [0, -8.5, 9], focus: [0, -10.5, 0] },
  portrait: { position: [0, -8, 12], focus: [0, -9.4, 0] },
};

/** Upstream's floor height (`mesh.position.y = -0.4` in grid-floor/index.ts). */
const GRID_FLOOR_Y = -0.4;

/*
  Camera waypoints — upstream's, verbatim.

  Ported from `src/animations/waypoints-data.ts`, landscape and portrait, plus
  the two `about` keys the scroll passes through. These were previously a
  hand-tuned set of small numbers scaled for this site's shrunken character,
  which is what produced the overhead view from behind: the camera was orbiting
  the wrong side of a figure that faces +z.

  The values are large because upstream's world is large — the avatar stands at
  z = 6 with a 15-unit camera throw — so the character's own placement below
  has to scale into that space rather than the other way round. Camera and
  character are now both on upstream's units, which is the only combination in
  which these numbers mean what they mean upstream.
*/
const WAYPOINTS: Record<"landscape" | "portrait", Waypoint[]> = {
  landscape: [
    { position: [0, 6, 10], focus: [0, 3, 0] },
    { position: [0, 4.5, 15.5], focus: [0, 2.2, 6] },
    { position: [0, 4.5, 15.5], focus: [0, 2.2, 6] },
  ],
  portrait: [
    { position: [0, 8.2, 16], focus: [0, 5.2, 0] },
    { position: [0, 4.75, 19.5], focus: [0, 0.8, 6] },
    { position: [0, 4.75, 19.5], focus: [0, 0.8, 6] },
  ],
};

/*
  The character's own move, from `animations/transitions/about.ts`.

  Upstream holds the camera still for this scene and moves the *character*
  instead: it slides in from x = 2 to x = 0 while turning from -0.73 rad to
  -PI, both eased `power1.out`. That is the scroll animation the act is actually
  about, so it is reproduced here rather than substituting an orbiting camera,
  which is what this port did before and which read as a broken camera drift.

  Upstream's `hero` waypoint is deliberately not used: no character exists in
  that scene, so reusing it here is what put the camera inside the figure.
*/
/*
  Character placement — upstream's, verbatim.

  From `animations/transitions/about.ts`: the avatar settles at z = 6 facing
  -z (`rotation.y = -PI`), which is what puts its face toward a camera sitting
  further out on +z. Seating it anywhere else is what had the camera looking at
  the back of its head.
*/
const AVATAR_SEAT: Record<"landscape" | "portrait", { x: number; y: number; z: number; turn: number }> = {
  landscape: { x: 0, y: -0.4, z: 6, turn: -Math.PI },
  portrait: { x: 0, y: -0.4, z: 6, turn: -Math.PI },
};

/** Scroll fraction at which each act is fully in view. */
const STOPS = [0, 0.5, 1];

/*
  The character is loaded at its authored size — upstream's world has the avatar
  about 4.7 units tall against a camera 15 units back, so rescaling it to fit
  this site's original frame would have broken every camera number above.

  Its seat offset is measured from the loaded mesh rather than read off the
  file, because the GLB's accessor bounding box cannot be trusted here: the root
  node carries a 120 degree rotation, so the box it reports is in a different
  frame from the scene. Measuring after the rotation is cleared gives the real
  extent, which is what puts the feet on the floor.
*/
const AVATAR_TARGET_HEIGHT = 4.7;

/*
  Orientation is resolved from a single long-lived MediaQueryList rather than
  by calling `matchMedia` on each read.

  `matchMedia` constructs a new list and evaluates it against the current style,
  which forces a style recalc. This used to be called twice per frame — once in
  the render loop and once from the resize handler — so the scene paid a
  synchronous layout every frame just to decide which waypoint table to read.
  One list, read from its cached `matches`, costs nothing per frame.
*/
const PORTRAIT_QUERY = "(max-width: 760px)";
let portraitQuery: MediaQueryList | null = null;

function isPortrait() {
  if (!portraitQuery && typeof window !== "undefined") {
    portraitQuery = window.matchMedia(PORTRAIT_QUERY);
  }
  return portraitQuery?.matches ?? false;
}

/**
 * Interpolate between waypoints for a scroll progress of 0..1 — upstream's
 * weighted-average step, expressed directly. Weights are triangular about their
 * stop, so neighbouring acts are simultaneously non-zero and the camera passes
 * smoothly between them.
 */
function sampleWaypoints(points: Waypoint[], progress: number): Waypoint {
  let totalWeight = 0;
  const position = [0, 0, 0];
  const focus = [0, 0, 0];

  for (let i = 0; i < points.length; i += 1) {
    const distance = Math.abs(progress - STOPS[i]);
    const weight = Math.max(0, 1 - distance / 0.5);
    if (weight <= 0) continue;

    totalWeight += weight;
    for (let axis = 0; axis < 3; axis += 1) {
      position[axis] += points[i].position[axis] * weight;
      focus[axis] += points[i].focus[axis] * weight;
    }
  }

  if (totalWeight === 0) return { position: points[0].position, focus: points[0].focus };
  return {
    position: position.map((v) => v / totalWeight),
    focus: focus.map((v) => v / totalWeight),
  };
}

export function ScrollSequence({
  onReady,
  overlay,
  about,
  onCameraReady,
  progressRef,
}: {
  onReady?: () => void;
  /**
   * Rendered inside the pinned frame, above the canvas. The page title lives
   * here so the scene opens the route rather than sitting below a heading: the
   * environment is the first thing on screen and the copy rides on top of it,
   * which is how the reference composes its opening.
   */
  overlay?: React.ReactNode;
  /**
   * The write-ups pinned to the character, rendered inside the pinned frame.
   * They are positioned by projecting world-space points every frame, so they
   * have to live in the same stacking context as the canvas.
   */
  about?: React.ReactNode;
  /**
   * Receives a reader for the live camera and canvas size, so the write-ups can
   * project their world-space anchors onto the screen each frame.
   *
   * Passed as a callback rather than exposing state because the camera moves
   * every frame: re-rendering React at that rate to publish it would defeat the
   * point of writing to `style.transform` directly.
   */
  onCameraReady?: (getter: () => { camera: import("three").PerspectiveCamera; width: number; height: number } | null) => void;
  /**
   * Receives the live scroll progress of the room-and-character act.
   *
   * The write-ups reveal on thresholds of this value. Handing back a reader
   * rather than passing progress as a prop keeps the overlay out of React's
   * render loop: the scene writes progress once per frame and the overlay polls
   * it in its own frame loop, so neither triggers a re-render of the other.
   */
  progressRef?: React.RefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const onCameraReadyRef = useRef(onCameraReady);
  useEffect(() => {
    onCameraReadyRef.current = onCameraReady;
  }, [onCameraReady]);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const gridCanvas = canvasRef.current;
    const trigger = triggerRef.current;
    if (!gridCanvas || !trigger) return;

    let room: import("@/components/site/room-stage").RoomHandle | null = null;
    /*
      The grid floor and the lab particles render into this offscreen scene, not
      into the visible one — see `components/playground-scene/dark-plane.ts` for
      why. The blue comes from the render target's clear colour.
    */
    let floorScene: import("three").Scene | null = null;
    let floorTarget: import("three").WebGLRenderTarget | null = null;
    let darkPlane: import("@/components/playground-scene/dark-plane").DarkPlaneHandle | null = null;
    let lab: import("@/components/site/lab-stage").LabHandle | null = null;
    let roomDetails: import("@/components/site/room-details").RoomDetailsHandle | null = null;
    let contact: import("@/components/site/contact-stage").ContactHandle | null = null;
    let gridFloorMesh: import("three").Mesh | null = null;
    let gridFloorUniforms: {
      uColor: { value: import("three").Color };
      uLineColor: { value: import("three").Color };
      uOpacity: { value: number };
      uTime: { value: number };
      uProgress: { value: number };
    } | null = null;
    let observer: ResizeObserver | null = null;
    let scrollTrigger: ScrollTrigger | null = null;
    let motionQuery: MediaQueryList | null = null;
    let onMotionChange: (() => void) | null = null;

    let characterRenderer: import("three").WebGLRenderer | null = null;
    let characterScene: import("three").Scene | null = null;
    let characterCamera: import("three").PerspectiveCamera | null = null;
    let avatar: import("@/components/site/avatar-stage").AvatarHandle | null = null;
    let avatarMesh: import("three").Object3D | null = null;
    let avatarRoot: import("three").Group | null = null;
    /** Post-seat bounds of the character, in world units, for camera framing. */
    let characterCanvas: HTMLCanvasElement | null = null;

    let raf = 0;
    let progress = 0;
    let elapsed = 0;
    let frames = 0;
    let revealed = 0;
    let contactActive = false;
    let hasWoken = false;
    /** Last size the resize handler acted on, so it can skip no-op passes. */
    let lastWidth = 0;
    let lastHeight = 0;

    /*
      Pointer parallax, upstream's `core/camera.ts`.

      The camera is parented to a `parallaxGroup` that is eased toward the
      pointer, so the whole view drifts with the mouse without the camera
      re-aiming. That distinction is the effect: translating after `lookAt` keeps
      the framing the waypoints chose and only shifts the eye point, so the scene
      leans rather than turns.
    */
    const cursor = { x: 0, y: 0 };
    const parallax = { x: 0, y: 0 };
    let onMouseMove: ((event: MouseEvent) => void) | null = null;
    let reduced = false;
    let running = true;
    let last = performance.now();

    const start = async () => {
      if (frames) return;

      /*
        Both renderers are built here rather than at module scope so that a
        WebGL failure on one does not take the other down with it. The character
        is allowed to fail silently: a visitor without the GLB still gets the
        grid floor, and an error boundary would replace the whole act with a
        message instead of degrading one element of it.
      */
      const { createDarkPlane } = await import("@/components/playground-scene/dark-plane");

    let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        return;
      }

      /*
        The character and its grid floor now share ONE three.js renderer.

        They were previously split across two GL contexts — an ogl fullscreen
        quad for the floor and a three.js scene for the avatar — because ogl
        cannot express upstream's floor. But upstream's floor is a real
        `PlaneGeometry` with a vertex shader that bows it upward, which is only
        possible inside a three.js scene with a real camera. Porting the shader
        verbatim therefore makes the split unnecessary, and folding the floor
        back into the same renderer removes a context, a canvas and a whole
        second render call from every frame.
      */

      try {
        characterRenderer = new THREE.WebGLRenderer({
          canvas: gridCanvas,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
        /*
          Upstream clears to beige (`colors.beigeLight`), not black, and swaps
          to the darker beige in the contact scene. That cream field is the
          entire backdrop of the reference; leaving it black is why this port
          read as a dark grid rather than the room.
        */
        characterRenderer.setClearColor(0xf5efe6, 1);
        /*
          Upstream caps at 2 (`Math.min(window.devicePixelRatio, 2)`). Kept, but
          the cost here is higher than upstream's: this scene runs two render
          passes and a skinned mesh, so on a 3x display the buffer would be
          nine times the CSS area. Capped at 1.75 as a compromise — visually
          indistinguishable from 2 at these sizes, measurably cheaper.
        */
        characterRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        characterRenderer.outputColorSpace = THREE.SRGBColorSpace;

        /*
          Adopt the canvas React already rendered rather than letting the
          renderer create a second one. Passing it to the constructor means one
          element, one drawing buffer and one GL context for the whole act, and
          the renderer then owns its sizing directly.
        */
        characterCanvas = gridCanvas;

        characterScene = new THREE.Scene();
        characterCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

        /*
          Upstream's two-scene split: the floor and particles live in their own
          scene and are drawn into a render target, then shown through the dark
          plane's rounded window. `depthBuffer: false` and `stencilBuffer: false`
          are upstream's settings and are safe here because the floor is drawn
          with `depthWrite: false` and nothing in that scene needs depth.
        */
        floorScene = new THREE.Scene();
        floorTarget = new THREE.WebGLRenderTarget(
          Math.max(1, Math.floor(window.innerWidth)),
          Math.max(1, Math.floor(window.innerHeight)),
          { samples: 0, depthBuffer: false, stencilBuffer: false }
        );

        /*
          The lab is the act's second half: the glowing base, the electric
          scanlines, the particle column and the hologram plane that the
          character stands in. Its particles belong to the offscreen scene — see
          dark-plane.ts — so they are added there, not to the visible scene.
        */
        try {
          const { createLab } = await import("@/components/site/lab-stage");
          lab = await createLab();
          characterScene.add(lab.group);
          floorScene?.add(lab.particles);
        } catch (error) {
          console.warn("[scroll-sequence] lab stage unavailable:", error);
          lab = null;
        }

        /*
          The room is the act's opening shot. It is loaded here, next to the
          avatar, rather than as a separate canvas or scene: both live in the
          same three.js scene, so the camera waypoints can carry one through the
          room and into the character without a cut.
        */
        try {
          const { createRoom } = await import("@/components/site/room-stage");
          room = await createRoom();
          characterScene.add(room.group);
        } catch (error) {
          console.warn("[scroll-sequence] room stage unavailable:", error);
          room = null;
        }

        /*
          The room's moving parts — the UV-scrolling monitors, the shadow
          catcher, the notes stream, the penguin's heart, the message popup and
          the mouse that follows the character's right hand. They reuse the GLB
          and atlas material the room stage already loaded rather than fetching
          the model twice.
        */
        if (room) {
          try {
            const { createRoomDetails } = await import("@/components/site/room-details");
            roomDetails = createRoomDetails({
              gltf: room.gltf,
              group: room.group,
              materials: { room: room.material },
              getHandWorldPosition: () => avatar?.getRightHandWorldPosition?.() ?? null,
            });
          } catch (error) {
            console.warn("[scroll-sequence] room details unavailable:", error);
            roomDetails = null;
          }
        }

        /*
          The footer environment: the bed the character sleeps on, its shadow,
          and the drifting "z" sprites. It sits at (1, -13, 0), which is where
          the avatar is teleported when this act begins.
        */
        try {
          const { createContact } = await import("@/components/site/contact-stage");
          contact = await createContact();
          characterScene.add(contact.group);
        } catch (error) {
          console.warn("[scroll-sequence] contact stage unavailable:", error);
          contact = null;
        }

        const { createAvatar } = await import("@/components/site/avatar-stage");
        avatar = await createAvatar(characterRenderer, characterScene, characterCamera);
        avatarMesh = avatar.getMesh();

        if (avatarMesh) {
          /*
            Upstream mounts the avatar inside a `transform` group and moves that
            group; the mesh keeps whatever transform the file gives it (bar the
            Z component, cleared in avatar-stage). No seat offset, no rescale and
            no depth centring is applied here, because upstream applies none:

                waypointsPosition  (2, 0, 0) -> (0, 0, 6)
                waypointsRotation.y  -2.3 + PI/2 -> -PI

            Both models are authored in the same world space, so the avatar sits
            in the room's chair purely by sharing those coordinates. Every
            previous attempt here invented a seat correction measured from the
            mesh bounds, which is exactly what pulled the figure out of the chair
            and out of frame — the models were already aligned and the offsets
            only broke that alignment.
          */
          avatarRoot = new THREE.Group();
          avatarRoot.add(avatarMesh);
          characterScene?.add(avatarRoot);
        }
      } catch (error) {
        /*
          A scene with no character is still a scene, so this degrades rather
          than throwing. The failure is logged instead of swallowed: a bare
          `catch {}` here made a shader or loader error indistinguishable from
          "the character is off screen", which cost a debugging cycle when the
          mesh simply was not drawing.
        */
        console.warn("[scroll-sequence] character stage unavailable:", error);
        avatar = null;
      }


      /* ------------------------------------------------------------------
         Grid floor — upstream's own PlaneGeometry + shader, unmodified
         ------------------------------------------------------------------ */

      /*
        Verbatim from `objects/grid-floor/index.ts` and its two shaders. The
        plane is 18x18 units subdivided 18x18 and rotated flat; the vertex
        shader bows it upward toward the viewer, which is why it needs a real
        camera and a real perspective projection rather than a screen-space quad.

        Colours are the site's accent rather than upstream's blue, because this
        portfolio runs on a single fault accent and an orange grid reads as part
        of that system instead of a leftover from another one. Everything
        spatial — the curvature, the 18 cells, the edge fade, the travelling
        centre circle — is upstream's, untouched.
      */
      const { gridFloorVertexShader, gridFloorFragmentShader } = await import(
        "@/components/site/grid-floor-shaders"
      );

      gridFloorUniforms = {
        uColor: { value: new THREE.Color("#0a0a0a").convertLinearToSRGB() },
        uLineColor: { value: new THREE.Color("#ff4d1c").convertLinearToSRGB() },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uProgress: { value: 0 },
      };

      const floorGeometry = new THREE.PlaneGeometry(18, 18, 18, 18);
      floorGeometry.rotateX(-Math.PI / 2);

      gridFloorMesh = new THREE.Mesh(
        floorGeometry,
        new THREE.ShaderMaterial({
          vertexShader: gridFloorVertexShader,
          fragmentShader: gridFloorFragmentShader,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          uniforms: gridFloorUniforms,
        })
      );
      gridFloorMesh.frustumCulled = false;
      // Behind the character, so the avatar composites over the floor.
      gridFloorMesh.renderOrder = -100;
      gridFloorMesh.position.y = GRID_FLOOR_Y;
      /*
        The plane is 18 units across and the camera sits about 10 units back and
        6 up, so most of the plane is *in front of* the camera's view centre.
        Upstream's bow is tuned for its full composition; here it wraps into a
        dome. Scaled back, it reads as the surface it is instead of a cage.
      */
      gridFloorMesh.scale.setScalar(2.1);
      floorScene?.add(gridFloorMesh);

      if (floorTarget) {
        darkPlane = createDarkPlane(floorTarget.texture);
        characterScene?.add(darkPlane.mesh);
      }

      /*
        Publish a reader for the camera and its viewport. The write-ups project
        their anchors through this, so it has to be stable for the life of the
        effect — a new function identity every render would restart their frame
        loops.
      */
      onCameraReadyRef.current?.(() => {
        if (!characterCamera) return null;
        return {
          camera: characterCamera,
          width: gridCanvas.clientWidth,
          height: gridCanvas.clientHeight,
        };
      });

      const resize = () => {
        const { clientWidth, clientHeight } = gridCanvas;
        if (clientWidth <= 0 || clientHeight <= 0) return;
        characterRenderer?.setSize(clientWidth, clientHeight);
        if (characterCamera) {
          characterCamera.aspect = clientWidth / clientHeight;
          characterCamera.updateProjectionMatrix();
        }
        /*
          The render target is sized in device pixels upstream
          (`width * pixelRatio`), matching the drawing buffer, so the floor is
          sampled at native resolution rather than upscaled.
        */
        /*
          `setSize` reallocates the framebuffer, so it must only run when the
          size actually changed. A ResizeObserver fires on every layout pass —
          including ones triggered by the sticky element moving during scroll —
          and reallocating two GPU buffers mid-scroll is a reliable stutter.
        */
        if (floorTarget) {
          const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
          const w = Math.max(1, Math.floor(clientWidth * ratio));
          const h = Math.max(1, Math.floor(clientHeight * ratio));
          if (floorTarget.width !== w || floorTarget.height !== h) {
            floorTarget.setSize(w, h);
          }
        }
        if (lastWidth !== clientWidth || lastHeight !== clientHeight) {
          lastWidth = clientWidth;
          lastHeight = clientHeight;
          darkPlane?.resize(clientWidth, clientHeight, clientWidth >= 768);
        }
        if (avatarRoot) {
          avatarRoot.position.z = AVATAR_SEAT[isPortrait() ? "portrait" : "landscape"].z;
        }
      };
      observer = new ResizeObserver(resize);
      observer.observe(gridCanvas);
      resize();

      /*
        Reduced motion
        --------------
        The global rule in `globals.css` only neutralises CSS animations, so it
        does nothing here — these loops are JS-driven. Left alone, the sequence
        would keep two requestAnimationFrame loops running forever for a visitor
        who asked for no motion.

        So under `prefers-reduced-motion` nothing self-animates: the grid stops
        travelling, `elapsed` stops advancing so the skeleton stops, and the
        avatar stops breathing and holds a static pose. Scroll still selects
        between three framings — that is the content, not decoration — but
        nothing moves on its own.
      */
      motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (!motionQuery) return;
      reduced = motionQuery.matches;

      const tick = (now: number) => {
        if (!running || !characterRenderer || !characterScene || !characterCamera) return;
        raf = requestAnimationFrame(tick);

        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (!reduced) elapsed += dt;

        const portrait = isPortrait();
        const points = portrait ? WAYPOINTS.portrait : WAYPOINTS.landscape;

        /*
          `transition` is upstream's whole animation for this act.

          In `animations/transitions/about.ts` it is a GSAP timeline scrubbed
          between two scroll positions: it begins as the section approaches the
          viewport (`-200px bottom`, i.e. just before it is fully in view) and
          ends when the section's top reaches the top of the screen. Everything
          in the act — the room's exit, the character's slide, the camera's move
          from the hero waypoint to the first about waypoint — is a function of
          this single 0..1 value, which is why they stay in step.

          Scroll position is already the timeline here, so the same 0..1 is
          derived from it directly rather than through a second ScrollTrigger.
        */
        /*
          The act split.

          Upstream gives each scene its own DOM section, so its scene weights are
          driven by three independent ScrollTriggers and a scene can hold the
          screen for as long as its section is tall. This port runs all of them
          through one pinned frame, so the same thing is expressed as ranges of
          one 0..1 value:

              0.00 - 0.60   room -> character   (upstream's `about`)
              0.60 - 0.78   character on the lab podium
              0.78 - 1.00   contact footer      (upstream's `contact`)

          The boundaries are the one invented part of this file: upstream has no
          equivalent because its sections provide the spacing for free. They are
          named constants so the split is visible rather than buried in
          arithmetic.
        */
        const transition = Math.max(0, Math.min(1, progress / ACTS.labEnd));
        // Publish the act's progress for the write-up overlay.
        if (progressRef) progressRef.current = transition;
        const contactProgress = Math.max(0, Math.min(1, (progress - ACTS.contactStart) / (1 - ACTS.contactStart)));
        progress = transition;

        const { position, focus } = sampleWaypoints(points, transition);

        /*
          The sampled waypoint drives the floor's `uProgress`, which is what bows
          it upward as the sequence advances — upstream's own mechanism, not a
          substitute for it. `uTime` scrolls the grid's own UVs so the floor
          streams toward the viewer; `uOpacity` fades it in once the first frames
          have rendered, so it never pops.
        */
        if (gridFloorUniforms && gridFloorMesh) {
          gridFloorUniforms.uProgress.value = progress;
          gridFloorUniforms.uTime.value = elapsed;
          /*
            Upstream's own opacity curve for the floor, verbatim from
            `grid-floor/index.ts`: `0.2 + 0.8 * sceneWeightsInOut.about.in`.
            The floor is never fully transparent — it starts at a fifth of its
            strength and builds as the about act arrives.

            The floor also tracks the lab group's position (`mesh.position.copy(
            lab.group.position)`) rather than the camera waypoints; it is scenery
            belonging to the lab, not to the camera.
          */
          gridFloorUniforms.uOpacity.value = 0.2 + 0.8 * transition;
          if (lab) {
            gridFloorMesh.position.copy(lab.group.position);
          }
          gridFloorMesh.position.y = GRID_FLOOR_Y;
          revealed = Math.min(1, revealed + dt);
        }

        const landscape = !portrait;
        /*
          The blue window belongs to the lab act, and it has to close for the
          footer.

          Upstream's `about.in` ramps up and stays at 1 for the whole of its
          about section, and `about.out` only rises when the *next* section takes
          over — the dark plane hides itself once `in === 1 && out >= 0.999`.
          Here the about ramp is `transition`, which pins at 1 for the last two
          fifths of the scroll, so the window stayed open over the footer and
          painted its blue over the whole contact scene.

          So the ramp is scoped to the acts that actually own the window: it
          rises through the room handoff, then closes across the contact act
          using upstream's own `out` mechanism rather than a new one.
        */
        const windowOut = contactProgress;
        darkPlane?.update({
          aboutIn: transition,
          aboutOut: windowOut,
          landscape,
          width: gridCanvas.clientWidth,
          height: gridCanvas.clientHeight,
        });

        /*
          Upstream switches the renderer's clear colour to the darker beige for
          this act (`colors.beigeDark`), which is what makes the footer read as a
          warmer room than the hero. The swap is per-frame and cheap.
        */
        /*
          Upstream's contact ramp is `in * (1 - out)` against its own section.
          Here the section is the last slice of the frame, so the ramp is that
          slice's progress.
        */
        const contactWeight = contactProgress;
        contactActive = contactWeight > 0.001;
        contact?.update({ weight: contactWeight, elapsed });

        /*
          Upstream fires the character's wake-up from a ScrollTrigger at
          `top 15%` of the contact section, and the wake-up is what calls
          `sleepingSprite.hide()` — the "z"s stop once he stirs, which is the
          whole point of them. The sequence is one continuous scroll here, so the
          trigger is expressed as the same threshold: once the contact act is
          live, wake him exactly once.
        */
        if (contactProgress > 0.25 && !hasWoken) {
          hasWoken = true;
          avatar?.wakeUp();
          contact?.hide();
        }

        lab?.update({
          progress: transition,
          time: elapsed,
          elapsed,
          // The lab plane reads the hologram's own clock upstream, which is the
          // same expression the avatar uses: aboutProgress * 1.1 - 0.1.
          hologramProgress: transition * 1.1 - 0.1,
          electricOpacity: 0,
          landscape,
        });

        room?.update(progress, elapsed);

        /*
          Upstream's `sceneWeights.hero` is what every room detail gates on. The
          hero weight is `in * (1 - out)`, and this section's `transition` is the
          about-in ramp — so the hero weight is its complement. The room group's
          own visibility follows the same value, exactly as upstream's
          `group.visible = sceneWeights.hero > 0.001`.
        */
        const heroWeight = 1 - transition;
        if (room) room.group.visible = heroWeight > 0.001;
        roomDetails?.update({ hero: heroWeight, visible: heroWeight > 0.001, time: elapsed });

        /* ----------------------------------------------------------------
           Character framing, derived from the same sampled waypoint
           ---------------------------------------------------------------- */

        if (characterRenderer && characterCamera && characterScene) {
          /*
            The camera IS the waypoint — position and focus straight from the
            table, exactly as upstream drives it.

            Earlier this solved framing from the avatar's measured bounds, which
            was reasonable while the camera and the character were both on small
            invented numbers. Now both are on upstream's scale, so deriving the
            camera from them would only re-derive what the table already says.
          */
          /*
            Upstream switches the camera outright on `contact > 0.001`; here the
            contact ramp doubles as the blend, so the move into the footer shot
            is continuous with the scroll rather than a cut.
          */
          const contactCam = CONTACT_CAMERA[portrait ? "portrait" : "landscape"];
          const camPos = [
            position[0] + (contactCam.position[0] - position[0]) * contactProgress,
            position[1] + (contactCam.position[1] - position[1]) * contactProgress,
            position[2] + (contactCam.position[2] - position[2]) * contactProgress,
          ] as const;
          const camFocus = [
            focus[0] + (contactCam.focus[0] - focus[0]) * contactProgress,
            focus[1] + (contactCam.focus[1] - focus[1]) * contactProgress,
            focus[2] + (contactCam.focus[2] - focus[2]) * contactProgress,
          ] as const;

          characterCamera.position.set(camPos[0], camPos[1], camPos[2]);
          characterCamera.lookAt(camFocus[0], camFocus[1], camFocus[2]);

          /*
            Rebuild the camera's world matrix immediately.

            `lookAt` writes the quaternion and marks the matrix dirty, but
            `matrixWorldInverse` is only refreshed inside `renderer.render`.
            Anything that projects through this camera BEFORE the render call —
            which is exactly what the write-up overlay does, in its own frame
            loop — therefore reads the previous frame's inverse, and on the very
            first frame reads an identity matrix. That produced projected offsets
            in the tens of thousands of pixels.

            One explicit update here is cheaper than the alternative of making
            the overlay read the camera after the scene has drawn, and it keeps
            the overlay's loop independent of render order.
          */
          characterCamera.updateMatrixWorld(true);

          /*
            Upstream's constants, verbatim: PARALLAX_INTENSITY = 1,
            PARALLAX_SPEED = 0.6, and a `* 0.1` step, so each frame the offset
            moves 6% of the way toward the pointer.

            Upstream then guards the move with `if (byX < 0.05 && byX > -0.05)`,
            which *discards* the step when it is too large. That works at the
            60fps upstream is tuned for — the step tops out around 0.03 — but it
            is frame-rate dependent and inverts under load: the slower the frame,
            the bigger the step, and past the threshold the parallax stops
            moving altogether rather than settling. Measured here, the X offset
            sat at exactly 0 while the cursor read -0.458, so the effect was
            dead on any machine that was not hitting 60.

            So the intent is kept and the mechanism fixed: the step is CLAMPED
            to 0.05 rather than dropped. That still honours "never move more than
            0.05 units in a frame", which is what stops a fast pointer from
            snapping the view, but it converges at any frame rate.

            Disabled under reduced-motion, where a scene that leans with the
            pointer is exactly the kind of unrequested movement to avoid.
          */
          if (!reduced) {
            const frameDelta = Math.min(dt * 60, 4);
            const targetX = cursor.x * 1;
            const targetY = -cursor.y * 1;
            const stepX = (targetX - parallax.x) * 0.6 * 0.1 * frameDelta;
            const stepY = (targetY - parallax.y) * 0.6 * 0.1 * frameDelta;

            parallax.x += Math.max(-0.05, Math.min(0.05, stepX));
            parallax.y += Math.max(-0.05, Math.min(0.05, stepY));
          }

          // Translate only. Re-aiming here would turn the camera and undo the
          // framing the waypoints just set.
          characterCamera.position.x += parallax.x;
          characterCamera.position.y += parallax.y;


          /*
            Upstream's character move: slide from x = 2 to x = 0 while turning
            from -0.73 to -PI, both `power1.out`. Upstream drives it with a GSAP
            timeline; here scroll progress *is* the timeline, so the same curve is
            applied directly to it. Without this the act has a camera but no
            animation, because upstream's camera is static by design.
          */
          /*
            Upstream's character move, verbatim: x 2 -> 0 and z 0 -> 6 while
            turning from -2.3 + PI/2 to -PI. `power1.out` upstream; the same
            curve is applied to scroll progress here, since scroll already is the
            timeline.
          */
          if (avatarRoot) {
            /*
              Upstream teleports the avatar rather than moving the scene: the
              contact branch sets `transform.position` to `(0, -13, 0)` with
              `rotation.y = -PI` and zeroes the reveal, which is how the bed at
              `(1, -13, 0)` ends up under him. Reproduced here as a late-stage
              blend so the jump happens after the lab act has finished.
            */
            const ease = 1 - Math.pow(1 - Math.min(1, transition), 3);

            /*
              The lab seat, then the contact teleport on top of it.

              Upstream's contact branch does not move the camera to the
              character — it moves the character's `transform` to `(0, -13, 0)`
              with `rotation.y = -PI` and lets the contact group's own seat of
              `(1, -13, 0)` meet him there. Both values are upstream's. Without
              this the camera travels down to y = -10.5 and finds nothing,
              because the character was still standing on the lab podium at
              y = 0 — which renders as flat blue backdrop.
            */
            const posX = 2 - 2 * ease;
            const posZ = 6 * ease;
            const turn = (-2.3 + Math.PI / 2) + (-Math.PI - (-2.3 + Math.PI / 2)) * ease;

            avatarRoot.position.set(
              posX + (0 - posX) * contactProgress,
              0 + (-13 - 0) * contactProgress,
              posZ + (0 - posZ) * contactProgress
            );
            avatarRoot.rotation.y = turn + (-Math.PI - turn) * contactProgress;
          }

          /*
            The character stays fully opaque for the whole act.

            Upstream dissolves it from the bottom up as the act ends, driving
            `uProgress` from -0.1 to 1.0 — its `getProgress` returns 1 while
            uProgress is at or below zero and then smoothsteps the model away.
            That is correct in upstream, where the dissolve covers a whole scene
            change across a much longer scroll. Compressed into one section here
            it removed the body but left the head, because the model's lower
            vertices map below zero on the ramp and are the first to go: the
            figure read as a severed head floating over the floor.

            So the ramp is held at its "fully visible" value (-1, below the
            zero threshold) and the act's motion carries the transition instead —
            which is the room sliding away, as in the reference.
          */
          /*
            Upstream drives the avatar with two values:

                uniforms.uProgress.value        = aboutProgress * 1.1 - 0.1
                uniforms.uAmbientStrength.value = sceneWeightsInOut.about.in

            `uProgress` is a bottom-up *dissolve* — `getProgress` returns 1 while
            it is at or below zero and then erases the model upward. In upstream
            that covers a whole scene change across a much longer scroll. Here
            the same curve, over one section, removed the body and left the head
            hanging in frame: the vertices below the sweep point read as "not yet
            revealed", so the figure came apart instead of fading.

            So the reveal is pinned to its fully-visible floor (-0.1). The act's
            motion is carried by the room sliding away and the character turning
            to camera, which is the transition the reference actually shows. The
            ambient ramp is upstream's, unchanged, so the lighting still builds
            through the act.
          */
          const aboutProgress = transition;
          const reveal = -0.1;
          const ambient = aboutProgress;

          avatar?.update(reduced ? 0 : dt, reveal, ambient);

          /*
            Two passes, in upstream's order: the floor scene into the target
            (cleared to the saturated blue that shows through the floor's alpha),
            then the visible scene over it (cleared to beige). The dark plane in
            the visible scene is what samples the first pass.
          */
          if (floorScene && floorTarget) {
            characterRenderer.setRenderTarget(floorTarget);
            characterRenderer.setClearColor(0x0169b4, 1);
            characterRenderer.render(floorScene, characterCamera);
            characterRenderer.setRenderTarget(null);
          }

          /*
            Upstream clears to `beigeLight` for the hero and `beigeDark` for the
            contact act, switching on `sceneWeights.contact > 0.001`. That single
            value is what makes the footer read as a warmer room than the act
            above it, so it is switched on the same condition.
          */
          characterRenderer.setClearColor(contactActive ? 0xe9ded0 : 0xf5efe6, 1);
          characterRenderer.render(characterScene, characterCamera);
        }

        frames += 1;
        if (frames === 2) onReadyRef.current?.();

        /*
          Fade the title out over the first third of the act. Done here rather
          than with a CSS animation because scroll progress is already the
          timeline, and a second source of truth would drift from it.
        */
        if (overlayRef.current) {
          const fade = Math.max(0, Math.min(1, 1 - progress * 2.6));
          overlayRef.current.style.opacity = String(fade);
        }
      };

      /*
        Register before creating any trigger. `ScrollTrigger.create` routes
        through the plugin's `init`, which the install step replaces — calling it
        first throws `TypeError: _context is not a function` from deep inside
        gsap, which says nothing about the actual cause.
      */
      gsap.registerPlugin(ScrollTrigger);

      scrollTrigger = ScrollTrigger.create({
        trigger,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          progress = self.progress;
        },
      });

      onMotionChange = () => {
        reduced = motionQuery?.matches ?? false;
      };
      motionQuery.addEventListener("change", onMotionChange);

      /*
        Upstream skips the parallax listener entirely on touch devices, where
        there is no pointer to follow and the drift would only fight the scroll.
      */
      const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      if (!isTouch) {
        onMouseMove = (event: MouseEvent) => {
          cursor.x = event.clientX / window.innerWidth - 0.5;
          cursor.y = event.clientY / window.innerHeight - 0.5;
        };
        window.addEventListener("mousemove", onMouseMove, { passive: true });
      }

      raf = requestAnimationFrame(tick);
    };

    void start();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      scrollTrigger?.kill();
      if (motionQuery && onMotionChange) motionQuery.removeEventListener("change", onMotionChange);
      if (onMouseMove) window.removeEventListener("mousemove", onMouseMove);
      room?.dispose();
      lab?.dispose();
      roomDetails?.dispose();
      contact?.dispose();
      darkPlane?.dispose();
      floorTarget?.dispose();
      avatar?.dispose();
      characterRenderer?.dispose();
      /*
        No `WEBGL_lose_context` here: React StrictMode mounts effects twice, and
        killing the context during the first cleanup leaves the second mount
        holding a dead context that renders nothing.
      */
    };
  }, []);

  return (
    /*
      The scroller is 300vh tall with the canvas pinned. Scroll distance is the
      animation's timeline: `scrub: true` ties the camera directly to scroll
      position with no easing curve and no lag, which is the one place the
      built-in easing choice in the rest of this codebase is deliberately not
      applied — a scrubbed transition that eases is a camera that trails the
      scroll, which feels broken rather than smooth.
    */
    <div className="sequence-bleed relative h-[500vh]" ref={triggerRef}>
      <div className="sticky top-0 h-dvh w-full overflow-hidden">
        <div className="grid-floor absolute inset-0">
          {/*
            One canvas for the whole act. The grid floor and the character are
            both three.js now, drawn by the same renderer in the same scene, so
            they no longer need separate canvases or separate GL contexts — and
            sharing one means they composite in the right order for free.
          */}
          <canvas
            aria-label="Scroll-driven scene: a character standing on a perspective grid, moving through three camera positions"
            className="grid-floor__canvas absolute inset-0"
            ref={canvasRef}
          />
        </div>

        {/*
          The overlay is `pointer-events-none` so the scene keeps any pointer
          interaction, and it fades out as the act progresses — see the
          `data-progress` attribute written by the frame loop. Holding the title
          over the lab scene as well would fight the composition.
        */}
        {about}

        {overlay ? (
          <div
            className="sequence-overlay pointer-events-none absolute inset-x-0 top-0 z-10"
            data-progress="0"
            ref={overlayRef}
          >
            {overlay}
          </div>
        ) : null}
      </div>
    </div>
  );
}

