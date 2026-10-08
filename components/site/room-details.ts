/*
 * Room details — the sub-objects that live inside the room scene.
 *
 *   https://github.com/davidhckh/portfolio-2025 — original by David Heckhoff.
 *   CC BY-NC-SA 4.0. See README "Attribution" and the visible credit on
 *   /playground. Non-commercial reuse only; the licence requires the credit to
 *   travel with derivative work, which is why it is repeated in this header.
 *
 * `room-stage.ts` loads `room.glb`, assigns its one shared atlas material and
 * owns the group. It deliberately stops there: upstream's room is not one
 * object, it is six (`src/three/objects/room/*`), each of which takes a node out
 * of the loaded scene and gives it its own material, shader or behaviour. This
 * module is that layer. It receives the ALREADY-LOADED gltf, the room group and
 * the room material, attaches the details into the group, and hands back one
 * handle.
 *
 * What is faithfully carried over, because it is what the room *does*:
 *
 *   - the desktops' idle "ghost scroll" (a random depth tween fired every 3-5
 *     seconds, with a one-in-three chance of a double scroll) and the message
 *     beat that shows a notification on the right screen;
 *   - the popup, the heart and the music notes, all drawn from the same
 *     `icon-spritesheet` with the same billboard trick;
 *   - the penguin's hop and wing flutter, with the heart triggered on the same
 *     beat;
 *   - the shadow catcher, a baked occlusion plate that is the only thing making
 *     the furniture read as sitting on the carpet;
 *   - the mouse chasing the avatar's right hand while the visitor is at the desk.
 *
 * Where upstream uses gsap, this module reproduces the behaviour as plain state
 * advanced by the `time` the caller passes in. Nothing here calls gsap,
 * `performance.now()` or any global: upstream's `gsap.delayedCall` and tweens
 * become a time-stamped state machine, and the caller owns the only clock. The
 * three upstream eases that matter are reimplemented by hand (`easePower1Out`,
 * `easePower2Out`, `easePower4Out` — see the note on gsap's naming below), and
 * `gsapYoyo` reproduces `repeat` + `yoyo` including the detail that yoyo runs the
 * ease backwards rather than mirroring its output.
 *
 * What is omitted, and why:
 *
 *   - The sound layer. Upstream plays `mouseWheel`, `notification`, `bird` and a
 *     keyboard loop from these objects. Audio cannot be started from a module
 *     that is constructed on load — a visitor who has not interacted must not be
 *     made to hear anything — and this port has no audio layer at all (see the
 *     same decision in `avatar-stage.ts`). The notes are therefore treated as
 *     "sounds on", which is upstream's post-unlock default for a non-touch
 *     visitor, so `uOpacity` still lerps toward 1 at the faster of the two
 *     upstream speeds.
 *   - The avatar-driven gates on the desktop ghost-scroll (upstream also requires
 *     the `desktop-idle` clip to be at full weight and the avatar not to be
 *     sitting at the left desktop) and the `introWave` flag that switches the
 *     mouse follower off during the intro. Those are avatar/feature states the
 *     caller does not hand us. The scene-weight (`hero`) gate, which is the one
 *     that decides whether the room is on screen at all, IS reproduced.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import {
  desktopsFragmentShader,
  desktopsVertexShader,
  heartFragmentShader,
  heartVertexShader,
  messagePopupFragmentShader,
  messagePopupVertexShader,
  notesFragmentShader,
  notesVertexShader,
  shadowCatcherFragmentShader,
  shadowCatcherVertexShader,
} from "@/components/site/room-detail-shaders";

import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

export interface RoomDetailsHandle {
  /**
   * Renders one frame.
   *
   * `hero` is the scene weight (0 to 1): upstream's `sceneWeights.hero`, which is
   * what every detail here gates on. `visible` is the caller's own decision to
   * hide the room group (upstream sets `group.visible = hero > 0.001`); the
   * simulations keep advancing while it is false, exactly as upstream's ticker
   * does. `time` is absolute seconds from a clock the caller owns — never
   * `performance.now()` — and frame deltas are derived from successive values.
   */
  update(opts: { hero: number; visible: boolean; time: number }): void;
  /**
   * Upstream's "left desktop" beat: the message row of the desktop texture is
   * switched on and fades back out, and the notification sprite rises from the
   * desk. Upstream fires both from one call site (`avatar/left-desktop.ts`), so
   * they share one method here.
   */
  showMessage(): void;
  /** The heart sprite over the penguin, as if the bird had been clicked. */
  showHeart(): void;
  /** Upstream's click on the penguin: the hop, the wing flutter and the heart. */
  jump(): void;
  /** Detaches and disposes everything this module created. */
  dispose(): void;
}

export interface RoomDetailsOptions {
  /** The already-loaded `room.glb` — `room-stage.ts` owns the load. */
  gltf: GLTF;
  /** The room's group. Everything built here is attached to it. */
  group: THREE.Group;
  /** The room's single shared atlas material, assigned to every room mesh. */
  materials: { room: THREE.Material };
  /**
   * Optional accessor for the avatar's right hand in WORLD space, or `null` when
   * there is no hand yet (the avatar may still be loading). When it is absent the
   * mouse simply never moves: upstream gates the follower on its `intro-wave`
   * feature flag, and this is the port's equivalent gate.
   */
  getHandWorldPosition?: () => THREE.Vector3 | null;
}

const DESKTOPS_TEXTURE = "/textures/desktops.webp";
const SHADOW_TEXTURE = "/textures/room-shadow.webp";
const SPRITESHEET_TEXTURE = "/textures/icon-spritesheet.webp";

/**
 * Upstream `notes.ts`: three planes merged into one geometry, staggered by
 * `aIndex`.
 */
const NOTES_PLANE_COUNT = 3;

/**
 * gsap's `deltaRatio(60)` expressed in seconds: one 60fps frame is what upstream
 * calls a delta of 1, so everything upstream multiplies by "frames" is
 * multiplied here by `delta * 60`.
 */
const FRAMES_PER_SECOND = 60;

/**
 * The longest frame delta the state machines will accept.
 *
 * Upstream feeds raw ticker deltas straight into `lerp(uOpacity, target, speed *
 * delta)`. That is safe in a foreground tab but not through a tab switch: a
 * multi-second delta makes the lerp factor exceed 1, which overshoots the target
 * and then diverges. Clamping the step at 100ms costs nothing at any frame rate a
 * visitor can actually see (it only bites below 10fps) and keeps the notes'
 * opacity monotonic.
 */
const MAX_DELTA = 0.1;

/** Upstream's `sceneWeights.hero < 0.95` gate — the room is basically fully in. */
const HERO_READY = 0.95;

/** Upstream's `scroll()` tween duration. */
const SCROLL_DURATION = 1;

/** Upstream `notes.ts`: `speed = 0.02` when fading in, `0.1` when fading out. */
const NOTES_OPACITY_TARGET = 1;
const NOTES_FADE_IN_SPEED = 0.02;
const NOTES_FADE_OUT_SPEED = 0.1;

/** Upstream `message-popup.ts`: `uProgress` 0 -> 1 over 2 seconds. */
const MESSAGE_PROGRESS_DURATION = 2;

/**
 * Upstream `desktops.ts` `showMessage()`:
 * `gsap.fromTo(uMessageIntensity, { value: 1 }, { value: 0, duration: 1, delay: 2 })`.
 */
const DESKTOP_MESSAGE_DELAY = 2;
const DESKTOP_MESSAGE_DURATION = 1;

/** Upstream `penguin.ts` `handleClick` — the whole timeline is 0.8s long. */
const JUMP_DURATION = 0.8;
const JUMP_HALF_DURATION = 0.4;
const JUMP_HEIGHT = 2;
const WING_LEG_DURATION = 0.1;
const WING_REPEATS = 7;
const WING_ROTATION = 0.4;
const WING_LIFT = 0.05;

/** Upstream `penguin.ts` `initHeart` / `handleClick` — 0.8s, power2.out. */
const HEART_DURATION = 0.8;

/** Upstream `mouse.ts`, verbatim. */
const MOUSE_Y_BOUND = 1.8;
const MOUSE_BOUNDS = {
  x: { min: -0.9, max: -0.7 },
  z: { min: -0.6, max: -0.28 },
} as const;

/**
 * gsap's ease names are offset by one from the curve names everyone else uses:
 * `power1` is quadratic, `power2` cubic, `power4` quintic. These three are the
 * only eases upstream's room uses, and they are reimplemented here because the
 * module may not import gsap.
 */

/** gsap `power1.out` — also gsap's DEFAULT ease, so it is what every plain `to()` above uses. */
const easePower1Out = (t: number) => 1 - (1 - t) * (1 - t);
/** gsap `power2.out` — the penguin hop, the wings and the heart. */
const easePower2Out = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
/** gsap `power4.out` — the popup, which snaps up and drifts to a stop. */
const easePower4Out = (t: number) => 1 - Math.pow(1 - t, 5);

/**
 * gsap's `to()` with `repeat` and `yoyo`, evaluated as a pure function of elapsed
 * time instead of being driven by a ticker.
 *
 * The subtle part is the reversed leg. gsap's yoyo does not mirror the value
 * (`1 - ease(u)`), it *runs the ease backwards* (`ease(1 - u)`). For an ease-out
 * those are different curves with the same endpoints: the mirrored one starts the
 * return slowly and ends fast, the real one starts fast and lands slowly. A hop
 * that lands slowly is the whole point of the ease, so the legs are branched
 * explicitly.
 *
 * `repeats` counts REPEATS, not iterations: `repeat: 1` means two legs, which is
 * the penguin's hop and why its total is exactly 0.8s.
 */
const gsapYoyo = (
  elapsed: number,
  legDuration: number,
  repeats: number,
  from: number,
  to: number,
  ease: (t: number) => number,
) => {
  const legs = repeats + 1;
  const total = legDuration * legs;
  const time = Math.min(Math.max(elapsed, 0), total);
  const leg = Math.min(Math.floor(time / legDuration), legs - 1);
  const progress = time / legDuration - leg;
  const eased = ease(leg % 2 === 0 ? progress : 1 - progress);

  return from + (to - from) * eased;
};

export function createRoomDetails({
  gltf,
  group,
  materials,
  getHandWorldPosition,
}: RoomDetailsOptions): RoomDetailsHandle {
  const textureLoader = new THREE.TextureLoader();
  const root = gltf.scene;

  const findMesh = (name: string): THREE.Mesh | null => {
    const found = root.getObjectByName(name);
    return found && (found as THREE.Mesh).isMesh ? (found as THREE.Mesh) : null;
  };

  /*
    The icon spritesheet is shared by the message popup, the music notes and the
    heart, and upstream mutates it from three places with the same values —
    `message-popup.init()` wins only because it runs first. Configuring it ONCE,
    here, before any of its three consumers exists, is the same end state without
    the order dependency.

    `flipY` is deliberately NOT touched: it stays at the loader's default `true`,
    and the popup/notes/heart vertex stages compensate by walking the atlas rows
    bottom-up (`TOTAL_ROWS - 1.0 - FRAME_Y`). Flipping the texture here instead
    would silently turn all three sprites upside down.

    Mipmaps are off because these are 1:1 pixel-art cells that are never minified
    enough to need them, and LinearFilter keeps the cells from bleeding into each
    other at their edges.
  */
  const spritesheet = textureLoader.load(SPRITESHEET_TEXTURE);
  spritesheet.colorSpace = THREE.LinearSRGBColorSpace;
  spritesheet.generateMipmaps = false;
  spritesheet.minFilter = THREE.LinearFilter;
  spritesheet.magFilter = THREE.LinearFilter;

  /* ------------------------------------------------------------------ shadow */

  const shadowTexture = textureLoader.load(SHADOW_TEXTURE);
  shadowTexture.flipY = false;
  /*
    Upstream never sets a colour space on this one, but its resource loader stamps
    `SRGBColorSpace` on every texture it hands out (`utils/resources.ts`), and
    `shadow.ts` only overrides `flipY`. The effective upstream state is therefore
    sRGB-encoded, so that is what is set here.
  */
  shadowTexture.colorSpace = THREE.SRGBColorSpace;

  /*
    `colors.beigeLight.clone().convertLinearToSRGB()` — the background is stored
    as sRGB numbers, while the shadow is a Color parsed from a CSS string and so
    left in the working (linear) space. The two are NOT in the same space, which
    is an upstream quirk and is preserved: the shader is a ShaderMaterial and
    three does not colour-manage arbitrary vec3 uniforms, so the values land in
    the framebuffer exactly as upstream intended them — a beige plate with a
    darker beige occlusion.
  */
  const backgroundColor = new THREE.Color("#f5efe6").convertLinearToSRGB();
  const shadowColor = new THREE.Color("rgb(215, 194, 169)");

  const shadowMaterial = new THREE.ShaderMaterial({
    vertexShader: shadowCatcherVertexShader,
    fragmentShader: shadowCatcherFragmentShader,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTexture: { value: shadowTexture },
      uColorBackground: { value: backgroundColor },
      uColorShadow: { value: shadowColor },
    },
  });

  const shadowCatcher = findMesh("shadow-catcher");
  if (shadowCatcher) {
    shadowCatcher.material = shadowMaterial;
    /*
      Upstream reassigns the texture and both colours on EVERY frame from
      `onBeforeRender`, though none of the three ever changes. The reason is that
      upstream hands out one cached material from `getShadowMaterial()`, so two
      scenes sharing it would each have to rebind on their own draw. This port
      builds its own material and so has no such conflict — the rebind is kept
      anyway, because it is upstream's documented contract for this material and it
      means a future edit that swaps the occlusion texture at runtime still works.
    */
    shadowCatcher.onBeforeRender = () => {
      shadowMaterial.uniforms.uTexture.value = shadowTexture;
      shadowMaterial.uniforms.uColorBackground.value = backgroundColor;
      shadowMaterial.uniforms.uColorShadow.value = shadowColor;
    };
    shadowCatcher.renderOrder = -1000;
    /*
      `room-stage.ts` hides this node, because with the atlas material it is a
      flat rectangle of artwork floating in the room. With the occlusion shader it
      becomes the contact shadow the room is drawn against, so it has to be shown
      again. This is the one place this module deliberately undoes a decision the
      caller made, and `dispose()` puts it back.
    */
    shadowCatcher.visible = true;
  }

  /* ---------------------------------------------------------------- desktops */

  const desktopPlane0 = findMesh("desktop-plane-0");
  const desktopPlane1 = findMesh("desktop-plane-1");

  /*
    `uScrollDepth` is tweened; `uMessageIntensity` is 0 until `showMessage()`.
    Both are shared by the whole merged screen geometry.
  */
  const desktopsUniforms = {
    uScrollDepth: { value: 0 },
    uMessageIntensity: { value: 0 },
  };

  let desktopsTexture: THREE.Texture | null = null;
  let desktopsGeometry: THREE.BufferGeometry | null = null;
  let desktopsMaterial: THREE.ShaderMaterial | null = null;
  let desktopsMesh: THREE.Mesh | null = null;

  if (desktopPlane0 && desktopPlane1) {
    const geometries: THREE.BufferGeometry[] = [];
    const planes = [desktopPlane0, desktopPlane1];

    planes.forEach((plane, index) => {
      /*
        Bake the node's translation into its geometry — upstream does the same
        (`geometry.translate(mesh.position)`) and also ignores the node's rotation
        and scale. In `room.glb` the two desktop nodes are translation-only, so
        baking only translation is exact here rather than merely faithful.

        Both planes are merged into ONE mesh below, so the position has to live in
        the vertices: the merged geometry has no per-plane transform left.
      */
      plane.geometry.translate(plane.position.x, plane.position.y, plane.position.z);

      const vertexCount = plane.geometry.attributes.position.count;

      /*
        Plane identity, baked per vertex. Plane 0 is the always-on desktop and is
        the only one that scrolls; plane 1 carries the message row of the texture
        and is the only one that can show it. Attributes rather than uniforms
        because after the merge there is no longer a per-plane draw call to attach
        a uniform to.
      */
      const scrollIntensity = new Float32Array(vertexCount).fill(index === 0 ? 1 : 0);
      const messageIntensity = new Float32Array(vertexCount).fill(index === 0 ? 0 : 1);
      plane.geometry.setAttribute("scrollIntensity", new THREE.BufferAttribute(scrollIntensity, 1));
      plane.geometry.setAttribute("messageIntensity", new THREE.BufferAttribute(messageIntensity, 1));

      /*
        Upstream never adds these nodes to the room group — the merged mesh
        replaces them. This port is handed the whole loaded scene, so the two
        originals are hidden instead of detached, which keeps them in the caller's
        dispose traversal and makes the takeover reversible. They still carry the
        shared atlas material, so the assignment is a no-op that documents the
        contract.
      */
      plane.material = materials.room;
      plane.visible = false;

      geometries.push(plane.geometry);
    });

    desktopsGeometry = mergeGeometries(geometries);

    desktopsTexture = textureLoader.load(DESKTOPS_TEXTURE);
    /*
      The desktop texture is one of only two room textures that are NOT sRGB (the
      icon spritesheet is the other): it is a strip of UI screenshots the shader
      samples as raw values, and `flipY = false` matches the GLB's UV orientation.
      Both wrap modes repeat because the ghost scroll samples outside 0..1 on
      purpose.
    */
    desktopsTexture.colorSpace = THREE.LinearSRGBColorSpace;
    desktopsTexture.flipY = false;
    desktopsTexture.wrapS = THREE.RepeatWrapping;
    desktopsTexture.wrapT = THREE.RepeatWrapping;

    desktopsMaterial = new THREE.ShaderMaterial({
      vertexShader: desktopsVertexShader,
      fragmentShader: desktopsFragmentShader,
      uniforms: {
        uTexture: { value: desktopsTexture },
        ...desktopsUniforms,
      },
    });

    desktopsMesh = new THREE.Mesh(desktopsGeometry, desktopsMaterial);
    group.add(desktopsMesh);
  }

  /* ----------------------------------------------------------- message popup */

  /*
    One unit plane, shared by the popup and the heart — upstream has a single
    module-level `planeGeometry` in `common/geometries.ts` for exactly this
    reason. It must stay a unit plane at the origin: both vertex stages patch
    `modelViewMatrix` in place and read `uv` directly, so the placement lives
    entirely in the mesh.
  */
  const planeGeometry = new THREE.PlaneGeometry(1, 1);

  const messagePopupMaterial = new THREE.ShaderMaterial({
    vertexShader: messagePopupVertexShader,
    fragmentShader: messagePopupFragmentShader,
    transparent: true,
    uniforms: {
      uTexture: { value: spritesheet },
      uProgress: { value: 0 },
    },
  });

  const messagePopupMesh = new THREE.Mesh(planeGeometry, messagePopupMaterial);
  messagePopupMesh.visible = false;
  messagePopupMesh.position.set(-1, 3.25, 2.5);
  group.add(messagePopupMesh);

  /* ------------------------------------------------------------------ mouse */

  const mouseMesh = findMesh("mouse");
  if (mouseMesh) mouseMesh.material = materials.room;
  /*
    Captured once, at init. Upstream's follower only ever writes x and z from the
    hand and forces y back to this value, so the mouse glides along its authored
    height rather than climbing the avatar's arm.
  */
  const mouseInitialPosition = mouseMesh ? mouseMesh.position.clone() : null;
  /** Scratch vector — `getHandWorldPosition` may return the caller's own. */
  const mouseHandPosition = new THREE.Vector3();

  /* ---------------------------------------------------------------- penguin */

  const penguinMesh = findMesh("penguin");
  const wingLeft = findMesh("penguin-wing-left");
  const wingRight = findMesh("penguin-wing-right");
  const wings = wingLeft && wingRight ? { left: wingLeft, right: wingRight } : null;

  if (penguinMesh) {
    penguinMesh.material = materials.room;

    /*
      Re-parent both wings onto the bird. Upstream's `room/index.ts` hoists every
      named node into the room group — wings included — and `penguin.init()` then
      puts them back, because the flutter has to rotate in the bird's own space to
      follow it around the room. In `room.glb` the wings are already children of
      `penguin`, so this is a no-op; it is kept as the explicit statement of that
      contract, and it is idempotent.
    */
    if (wings) {
      penguinMesh.add(wings.left);
      penguinMesh.add(wings.right);
      wings.left.material = materials.room;
      wings.right.material = materials.room;
    }
  }

  const heartMaterial = new THREE.ShaderMaterial({
    vertexShader: heartVertexShader,
    fragmentShader: heartFragmentShader,
    transparent: true,
    uniforms: {
      uTexture: { value: spritesheet },
      uProgress: { value: 0 },
    },
  });

  const heartMesh = new THREE.Mesh(planeGeometry, heartMaterial);
  if (penguinMesh) {
    /*
      Upstream copies the penguin's own position and nudges it — it does NOT use
      the bounding box, so the heart sits at a fixed offset from the bird's origin
      and rides along when the bird hops. The room group and the gltf root share
      coordinates (the loaded scene root is identity), which is why the local
      position is the right value to copy.
    */
    heartMesh.position.copy(penguinMesh.position);
    heartMesh.position.x += 0.1;
    heartMesh.position.y += 0.4;
    heartMesh.position.z += 0.1;
  }
  heartMesh.visible = false;
  group.add(heartMesh);

  /* --------------------------------------------------- music box and notes */

  const musicMesh = findMesh("music");
  if (musicMesh) musicMesh.material = materials.room;

  const notesUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  };

  let notesGeometry: THREE.BufferGeometry | null = null;
  let notesMaterial: THREE.ShaderMaterial | null = null;
  let notesMesh: THREE.Mesh | null = null;

  if (musicMesh) {
    const geometries: THREE.BufferGeometry[] = [];

    for (let i = 0; i < NOTES_PLANE_COUNT; i++) {
      const plane = new THREE.PlaneGeometry(1, 1);
      const indexValue = i / NOTES_PLANE_COUNT;
      const vertexCount = plane.getAttribute("position").count;
      const aIndex = new Float32Array(vertexCount).fill(indexValue);
      plane.setAttribute("aIndex", new THREE.BufferAttribute(aIndex, 1));
      geometries.push(plane);
    }

    notesGeometry = mergeGeometries(geometries, false);

    notesMaterial = new THREE.ShaderMaterial({
      vertexShader: notesVertexShader,
      fragmentShader: notesFragmentShader,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        uTexture: { value: spritesheet },
        ...notesUniforms,
      },
    });

    notesMesh = new THREE.Mesh(notesGeometry, notesMaterial);
    /*
      The notes are sprites that need to read over the room behind them, so they
      draw early (-1, after the shadow catcher at -1000 and the carpet at -10) with
      depth testing off. That is the only reason the music box never occludes them.
    */
    notesMesh.renderOrder = -1;
    notesMesh.position.set(musicMesh.position.x - 0.4, musicMesh.position.y + 0.4, musicMesh.position.z + 0.2);
    group.add(notesMesh);
  }

  /*
    The clock. `time` is only ever the caller's; the delta is derived from
    successive values so that every simulation above can be written in the units
    upstream's gsap ticker used. `jump()`, `showHeart()` and `showMessage()` are
    synchronous entry points with no time argument, so they stamp themselves
    against the most recent frame — which means the caller should be ticking
    `update()` before wiring up interaction.
  */
  let clock = 0;
  let clockStarted = false;

  /* ------------------------------------------------------------ state */

  /** Upstream's self-rescheduling `scrollInterval` plus its running `gsap.to`. */
  const scrollState = {
    /** Absolute time the next idle scroll fires at; -1 until the first frame. */
    nextAt: -1,
    /** The 33% double scroll, 0.6s behind the first. -1 when not queued. */
    secondAt: -1,
    from: 0,
    to: 0,
    startedAt: 0,
    tweening: false,
  };

  const desktopMessageState = { active: false, startedAt: 0 };
  const popupState = { active: false, startedAt: 0 };
  const heartState = { active: false, startedAt: 0 };

  const jumpState = {
    active: false,
    startedAt: 0,
    baseY: 0,
    leftRotation: 0,
    rightRotation: 0,
    leftY: 0,
    rightY: 0,
  };

  /* ------------------------------------------------------------ updates */

  const startScroll = (time: number) => {
    /*
      Upstream: `Math.random() * (-0.25 - 0.25) + 0.25`, a depth in [-0.25, 0.25).
      Negative samples scroll the desktop up and positive samples scroll it down,
      which is why the ghost scroll does not read as a loop.
    */
    const scrollDepth = Math.random() * (-0.25 - 0.25) + 0.25;

    scrollState.from = desktopsUniforms.uScrollDepth.value;
    scrollState.to = scrollDepth;
    scrollState.startedAt = time;
    scrollState.tweening = true;
    // Upstream plays "mouseWheel" here. No audio layer in this port.
  };

  const updateDesktops = (hero: number, visible: boolean, time: number) => {
    if (!desktopsMesh) return;

    if (scrollState.tweening) {
      /*
        `gsap.to(uScrollDepth, { value, duration: 1 })` with gsap's default ease
        (power1.out — NOT linear, which is the easy thing to get wrong). The tween
        is retargeted from wherever the value currently is, because gsap
        over-writes a running tween on the same property and starts the new one
        from the live value.
      */
      const t = Math.min(Math.max((time - scrollState.startedAt) / SCROLL_DURATION, 0), 1);
      desktopsUniforms.uScrollDepth.value =
        scrollState.from + (scrollState.to - scrollState.from) * easePower1Out(t);
      if (t >= 1) scrollState.tweening = false;
    }

    /*
      The interval. Upstream reschedules itself FIRST and then decides whether to
      scroll, so the beat drifts on and the guard only skips one beat rather than
      stopping the loop. The scheduler also keeps running while the room is off
      screen; only the scroll itself is gated.
    */
    if (scrollState.nextAt < 0) scrollState.nextAt = time + Math.random() * 2 + 3;

    if (time >= scrollState.nextAt) {
      scrollState.nextAt = time + Math.random() * 2 + 3;

      if (visible && hero >= HERO_READY) {
        startScroll(time);

        // Upstream: a one-in-three chance of a second scroll 0.6s later.
        if (Math.random() <= 0.33) scrollState.secondAt = time + 0.6;
      }
    }

    if (scrollState.secondAt >= 0 && time >= scrollState.secondAt) {
      scrollState.secondAt = -1;
      // Upstream's second gate is looser: `hero < 0.2` aborts, anything else fires.
      if (hero >= 0.2) startScroll(time);
    }

    /*
      The message row. `fromTo(..., { value: 1 }, { value: 0, duration: 1, delay: 2 })`
      holds the overlay fully on for two seconds and then eases it out over one —
      a slower beat than the popup beside it, which is why the notification sprite
      is gone before the screen stops showing the message.
    */
    if (desktopMessageState.active) {
      const elapsed = time - desktopMessageState.startedAt;

      if (elapsed < DESKTOP_MESSAGE_DELAY) {
        desktopsUniforms.uMessageIntensity.value = 1;
      } else {
        const t = Math.min((elapsed - DESKTOP_MESSAGE_DELAY) / DESKTOP_MESSAGE_DURATION, 1);
        desktopsUniforms.uMessageIntensity.value = 1 - easePower1Out(t);
        if (t >= 1) desktopMessageState.active = false;
      }
    }
  };

  const updateNotes = (hero: number, delta: number) => {
    if (!notesMesh) return;

    /*
      Upstream gates on the scene weight, not on the group's visible flag, and
      returns before touching either uniform — so the notes freeze rather than
      fade while the room is out of the act. `visible` is therefore not consulted
      here: when it is false the parent group is not drawn anyway.
    */
    if (hero < 0.001) {
      notesMesh.visible = false;
      return;
    }
    notesMesh.visible = true;

    /*
      `gsap.ticker.deltaRatio(60)` in two places: as the frame count for the
      opacity lerp, and divided by 60 for the time advance. Together they mean
      "advance uTime by real seconds and lerp by 2% (or 10%) per 60fps frame".
    */
    const frames = delta * FRAMES_PER_SECOND;
    const opacityTarget = NOTES_OPACITY_TARGET;
    const speed = opacityTarget === 1 ? NOTES_FADE_IN_SPEED : NOTES_FADE_OUT_SPEED;
    notesUniforms.uOpacity.value += (opacityTarget - notesUniforms.uOpacity.value) * speed * frames;

    // The last sliver of opacity is dropped rather than drawn, because a fully
    // transparent sprite still costs a draw call.
    if (notesUniforms.uOpacity.value < 0.01) notesMesh.visible = false;

    notesUniforms.uTime.value += delta;
  };

  const updateMessagePopup = (time: number) => {
    if (!popupState.active) return;

    const t = Math.min((time - popupState.startedAt) / MESSAGE_PROGRESS_DURATION, 1);
    messagePopupMaterial.uniforms.uProgress.value = easePower4Out(t);

    /*
      Upstream's timeline ends with `tl.set(mesh, { visible: false })` at 2s,
      after the tween — the sprite is hidden by the transition ending, not by an
      alpha of zero.
    */
    if (t >= 1) {
      popupState.active = false;
      messagePopupMesh.visible = false;
    }
  };

  const updateHeart = (time: number) => {
    if (!heartState.active) return;

    const t = Math.min((time - heartState.startedAt) / HEART_DURATION, 1);
    heartMaterial.uniforms.uProgress.value = easePower2Out(t);

    /*
      Upstream's `penguin.tick()` visibility rule, verbatim: the heart is shown
      only strictly between 0 and 1, so it is hidden on the frame it is triggered
      and again on the frame it finishes. Because the tween ends AT 1 and the
      timeline does not reset it, the sprite stays hidden after the click instead
      of being left hanging over the bird.
    */
    const progress = heartMaterial.uniforms.uProgress.value;
    heartMesh.visible = progress > 0.001 && progress < 0.999;

    if (t >= 1) heartState.active = false;
  };

  const updateJump = (time: number) => {
    if (!jumpState.active || !penguinMesh || !wings) return;

    const elapsed = time - jumpState.startedAt;

    /*
      Upstream's timeline, four parallel tweens all starting at 0:
        y -> 2,            0.4s, power2.out, yoyo, repeat 1  => 0.8s total
        wings rotation.x,  0.1s, power2.out, yoyo, repeat 7  => 0.8s total
        wings position.y -> 0.05, same shape
      The note targets are ABSOLUTE (0.4, -0.4, 0.05), not relative offsets, and
      because every leg yoyos, the last leg lands back on the captured start
      values — the bird returns to exactly where it took off.
    */
    penguinMesh.position.y = gsapYoyo(
      elapsed,
      JUMP_HALF_DURATION,
      1,
      jumpState.baseY,
      JUMP_HEIGHT,
      easePower2Out,
    );
    wings.left.rotation.x = gsapYoyo(
      elapsed,
      WING_LEG_DURATION,
      WING_REPEATS,
      jumpState.leftRotation,
      WING_ROTATION,
      easePower2Out,
    );
    wings.right.rotation.x = gsapYoyo(
      elapsed,
      WING_LEG_DURATION,
      WING_REPEATS,
      jumpState.rightRotation,
      -WING_ROTATION,
      easePower2Out,
    );
    wings.left.position.y = gsapYoyo(
      elapsed,
      WING_LEG_DURATION,
      WING_REPEATS,
      jumpState.leftY,
      WING_LIFT,
      easePower2Out,
    );
    wings.right.position.y = gsapYoyo(
      elapsed,
      WING_LEG_DURATION,
      WING_REPEATS,
      jumpState.rightY,
      WING_LIFT,
      easePower2Out,
    );

    /*
      0.8s is also when upstream's `tl.add(() => isJumping = false, 0.8)` releases
      the click lock, so the lock and the animation end on the same frame. The
      values are rewritten exactly rather than left to the curve, so repeated
      clicks cannot accumulate float drift in the bird's rest pose.
    */
    if (elapsed >= JUMP_DURATION) {
      jumpState.active = false;
      penguinMesh.position.y = jumpState.baseY;
      wings.left.rotation.x = jumpState.leftRotation;
      wings.right.rotation.x = jumpState.rightRotation;
      wings.left.position.y = jumpState.leftY;
      wings.right.position.y = jumpState.rightY;
    }
  };

  const updateMouse = (hero: number) => {
    /*
      `getHandWorldPosition` is the gate. Upstream instead checks a mutable
      `enabled` flag that starts false while the intro wave plays and is switched
      on 0.3s into the intro timeline; this port has no intro timeline, so the
      caller deciding to pass a hand accessor is the equivalent decision.
    */
    if (!mouseMesh || !mouseInitialPosition || !getHandWorldPosition) return;
    if (hero < HERO_READY) return;

    const hand = getHandWorldPosition();
    if (!hand) return;

    /*
      Copied into scratch rather than mutated in place: the accessor returns the
      caller's vector, and `worldToLocal` would silently corrupt it.

      `worldToLocal` reads `group.matrixWorld`, which is whatever the renderer last
      computed. If the caller ticks this before its render of the same frame, the
      conversion is one frame behind the group's animated transform — upstream has
      exactly the same property, and at 60fps on a slowly moving room the offset is
      sub-pixel.
    */
    mouseHandPosition.copy(hand);
    group.worldToLocal(mouseHandPosition);

    /*
      The bounds are a crude "is the hand at the desk" test. Outside them the mouse
      simply stays where it was — there is no return-to-origin, which is why the
      mouse appears to be abandoned mid-pad when the visitor walks away and picked
      up again when they come back.
    */
    if (mouseHandPosition.y > MOUSE_Y_BOUND) return;
    if (mouseHandPosition.x < MOUSE_BOUNDS.x.min || mouseHandPosition.x > MOUSE_BOUNDS.x.max) return;
    if (mouseHandPosition.z < MOUSE_BOUNDS.z.min || mouseHandPosition.z > MOUSE_BOUNDS.z.max) return;

    mouseMesh.position.copy(mouseHandPosition);
    // Height and forward slip are fixed offsets, not hand-relative.
    mouseMesh.position.y = mouseInitialPosition.y;
    mouseMesh.position.z -= 0.15;
  };

  const update = ({ hero, visible, time }: { hero: number; visible: boolean; time: number }) => {
    /*
      Deltas are derived here so that nothing in this module needs a clock of its
      own. The first frame has no previous sample, so it advances nothing — which
      also keeps a caller that starts its clock at a non-zero value from feeding
      the notes a huge first step.
    */
    const delta = clockStarted ? Math.min(Math.max(time - clock, 0), MAX_DELTA) : 0;
    clock = time;
    clockStarted = true;

    updateDesktops(hero, visible, time);
    updateNotes(hero, delta);
    updateMessagePopup(time);
    updateHeart(time);
    updateJump(time);
    updateMouse(hero);
  };

  const showMessage = () => {
    /*
      Upstream fires both halves from one call site in `avatar/left-desktop.ts`:
      `desktops.showMessage()` (the screen's message row) and
      `messagePopup.show()` (the sprite above the desk). They are one beat for the
      visitor, so they are one method here.
    */
    messagePopupMaterial.uniforms.uProgress.value = 0;
    messagePopupMesh.visible = true;
    popupState.active = true;
    popupState.startedAt = clock;

    desktopsUniforms.uMessageIntensity.value = 1;
    desktopMessageState.active = true;
    desktopMessageState.startedAt = clock;

    /*
      Deliberately NOT resetting `uScrollDepth`: upstream's ghost scroll and its
      message are independent, and a message can land in the middle of one.
    */
    // Upstream plays "notification" here. No audio layer in this port.
  };

  const showHeart = () => {
    heartMaterial.uniforms.uProgress.value = 0;
    heartMesh.visible = true;
    heartState.active = true;
    heartState.startedAt = clock;
  };

  const jump = () => {
    /*
      Upstream ignores the click while `isJumping` is set, which is what stops a
      visitor hammering the bird from stacking hops.
    */
    if (!penguinMesh || !wings || jumpState.active) return;

    jumpState.active = true;
    jumpState.startedAt = clock;
    // Start values are captured at trigger time, exactly as gsap captures them
    // when a tween starts rather than when it is created.
    jumpState.baseY = penguinMesh.position.y;
    jumpState.leftRotation = wings.left.rotation.x;
    jumpState.rightRotation = wings.right.rotation.x;
    jumpState.leftY = wings.left.position.y;
    jumpState.rightY = wings.right.position.y;

    /*
      The heart is part of the same upstream timeline as the hop, so a jump shows
      it. Calling `showHeart()` separately as well is harmless — it only restarts
      the sprite.
    */
    showHeart();
    // Upstream plays "bird" here. No audio layer in this port.
  };

  const dispose = () => {
    if (desktopsMesh) group.remove(desktopsMesh);
    if (notesMesh) group.remove(notesMesh);
    group.remove(messagePopupMesh);
    group.remove(heartMesh);

    desktopsGeometry?.dispose();
    desktopsMaterial?.dispose();
    desktopsTexture?.dispose();
    notesGeometry?.dispose();
    notesMaterial?.dispose();
    messagePopupMaterial.dispose();
    heartMaterial.dispose();
    shadowMaterial.dispose();

    /*
      One spritesheet, three materials — disposed once, after its consumers. The
      shadow texture is separate and is ours too.
    */
    spritesheet.dispose();
    shadowTexture.dispose();
    planeGeometry.dispose();

    /*
      Give the shadow catcher back in the state `room-stage.ts` left it in: the
      shared atlas material, hidden. Leaving it visible with a disposed material
      would draw a corrupted plate over the room.
    */
    if (shadowCatcher) {
      shadowCatcher.onBeforeRender = () => {};
      shadowCatcher.material = materials.room;
      shadowCatcher.visible = false;
    }

    /*
      The two desktop planes stay hidden and their geometries stay translated.
      Upstream's bake is one-way for the same reason: it is applied to the loaded
      geometries in place, so there is no pristine copy left to restore. The
      geometries themselves are NOT disposed here — they belong to the gltf and the
      caller disposes them.
    */
  };

  return { update, showMessage, showHeart, jump, dispose };
}
