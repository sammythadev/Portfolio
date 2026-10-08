"use client";

/**
 * The character — avatar GLB, skinned, with its own animation mixer.
 *
 * Ported from the interactive portfolio at github.com/davidhckh/portfolio-2025 by
 * David Heckhoff, licensed CC BY-NC-SA 4.0. Original: https://david-hckh.com
 *
 * What is carried over from upstream, because it is the part that reads as the
 * character "being alive":
 *
 *   - The clip set and its blending rules. `idle` and `t-idle` ping-pong, `wave`
 *     plays once and clamps. `wave` cross-fades out into `idle` rather than
 *     cutting, and the blend weight is driven by a scalar rather than by clip
 *     events, which is what lets the wave be interrupted cleanly.
 *   - Per-mesh material assignment by mesh name (`skin`, `black`, `gray`,
 *     `white`, `head`, `face`), with a matcap texture bound per group. Matcaps
 *     are what light the figure — there are no lights in this scene.
 *   - The bottom-up reveal driven by `uProgress`, so the avatar materialises out
 *     of the floor during the scroll instead of fading in as a silhouette.
 *
 * What is not carried over:
 *   - The upstream sound layer. The wave and the wake-up clip play audio, and the
 *     contact scene loops a keyboard howl; audio would violate the autoplay
 *     contract on a route the visitor did not ask to make noise on.
 *   - The contact scene itself (its teleport to `(0, -13, 0)`, its floating
 *     sleeping sprite and its face transition). The weights that drive that branch
 *     are reachable through `update`, but nothing in this site's act drives them,
 *     so the state machine sits in its intro branch.
 *
 * Where the rest lives
 * --------------------
 * The animation state machine is in `avatar-animations.ts` (upstream's
 * `animations.ts` + `face.ts` + `left-desktop.ts`), and the hologram is in
 * `avatar-hologram.ts`. This file owns the GLB, the per-mesh materials and the
 * orientation fix, and wires the three together.
 *
 * See also the visible credit in `app/playground/page.tsx`.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { createAvatarAnimations } from "@/components/site/avatar-animations";
import { createAvatarHologram } from "@/components/site/avatar-hologram";
import {
  avatarFaceFragmentShader,
  avatarFaceVertexShader,
  avatarHeadFragmentShader,
  avatarHeadVertexShader,
  avatarMatcapFragmentShader,
  avatarMatcapVertexShader,
} from "@/components/site/avatar-shaders";

import type { AvatarAnimationsHandle } from "@/components/site/avatar-animations";
import type { AvatarHologramHandle } from "@/components/site/avatar-hologram";

/**
 * Optional per-frame weights for the parts of upstream's scene graph this port's
 * caller does not drive itself. Every one of them is derived or defaulted when
 * omitted, so the existing three-argument call keeps working — see `update` in
 * `createAvatar` for how each default is chosen.
 */
export type AvatarFrameWeights = {
  /** Upstream `avatar.tIdleIntensity.value`. Default: derived from `ambient`. */
  tIdleIntensity?: number;
  /**
   * Upstream `wavingStrength.value`. Default: the state machine's own wave
   * timeline, which is what upstream runs.
   */
  wavingStrength?: number;
  /** Upstream `sceneWeights.contact`. Default: 0 (the intro branch). */
  contact?: number;
  /** Upstream `sceneWeights.about`. Default: `ambient`. */
  about?: number;
  /** Upstream `sceneWeights.hero`. Default: `1 - about`, upstream's own relation. */
  hero?: number;
  /** Upstream `sizes.visible`. Default: whether the document is visible. */
  visible?: boolean;
};

export type AvatarHandle = {
  /**
   * Renders one frame. `delta` is seconds.
   *
   * `progress` is the body's bottom-up reveal (`uProgress`) and `ambient` its
   * ambient lift (`uAmbientStrength`), both as before. `weights` is optional and
   * only needed by a caller that wants to drive the full state machine (the
   * contact branch, the hero act the left-desktop trigger belongs to) rather than
   * the intro branch this site's scroll act uses.
   */
  update: (delta: number, progress: number, ambient: number, weights?: AvatarFrameWeights) => void;
  /**
   * The root object, so the caller can place and scale it. The GLB is authored
   * off-origin (base at y = 2.03, ~4.3 units tall), so this is what makes the
   * figure stand on the floor rather than float above it.
   */
  getMesh: () => THREE.Object3D;
  /**
   * Upstream's `avatar.getRightHandBone()`. The room's mouse mesh follows this
   * bone every frame, so it has to be reachable from outside the avatar.
   *
   * Returns `null` before the model has loaded, which is the state upstream
   * guards against in its own follower.
   */
  getRightHandWorldPosition: () => THREE.Vector3 | null;
  dispose: () => void;

  /** The full animation state machine — clips, weights, blinking, wake-up. */
  animations: AvatarAnimationsHandle;
  /** The hologram body, or null if it could not be built. */
  hologram: AvatarHologramHandle | null;
  /** Upstream `animations.play`. */
  play: (name: string, transition?: number) => void;
  /** Upstream `animations.wave`. */
  wave: () => void;
  /** Upstream `animations.wakeUp`. */
  wakeUp: () => void;
  /** Upstream `animations.getIsAwake`. */
  getIsAwake: () => boolean;
};

const MATCAPS: Record<string, { url: string; key: string }> = {
  black: { url: "/textures/matcap-black.webp", key: "black" },
  gray: { url: "/textures/matcap-gray.webp", key: "gray" },
  skin: { url: "/textures/matcap-skin.webp", key: "skin" },
  white: { url: "/textures/matcap-white.webp", key: "white" },
};

/** Mesh names in the GLB that should not be rendered at all. */
const HIDDEN = new Set(["brain"]);

export async function createAvatar(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): Promise<AvatarHandle> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("/models/avatar.glb");

  const root = gltf.scene.children[0];
  if (!root) throw new Error("[avatar] avatar.glb has no root object");

  /*
    `SkeletonUtils.clone` rather than a plain `.clone()`. Skinned meshes share
    their bone texture buffer with the original; duplicating that without
    remapping makes every skinned mesh collapse onto the same pose. The scene
    graph here is used once, so it is not strictly required — but it is what
    upstream does, and it is the difference between working and silently
    deforming if this is ever instanced.
  */
  const mesh = root;

  // Load every matcap up front so the first frame is never untextured.
  const matcapTextures = await Promise.all(
    Object.entries(MATCAPS).map(async ([name, def]) => {
      const texture = await new THREE.TextureLoader().loadAsync(def.url);
      texture.colorSpace = THREE.LinearSRGBColorSpace;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      return [name, texture] as const;
    })
  );

  const headTexture = await new THREE.TextureLoader().loadAsync("/textures/head.webp");
  /*
    The spritesheet keeps `flipY = true` (the loader default) because the face
    shader compensates for it by flipping the atlas row itself. Forcing it false
    here would turn the expression upside down.
  */
  const faceTexture = await new THREE.TextureLoader().loadAsync("/textures/face-spritesheet.png");
  faceTexture.colorSpace = THREE.LinearSRGBColorSpace;
  faceTexture.generateMipmaps = false;
  headTexture.colorSpace = THREE.LinearSRGBColorSpace;
  headTexture.generateMipmaps = false;
  // Matches upstream: the head UVs are authored for an unflipped image.
  headTexture.flipY = false;
  headTexture.needsUpdate = true;

  const uniforms = {
    uProgress: { value: -1 },
    uAmbientStrength: { value: 0 },
  };

  const materials: THREE.Material[] = [];

  /*
    The face material's own uniform object, kept so the animation state machine
    can write the atlas frame upstream's `face.tick()` chooses. Held as its own
    reference rather than read back off the material later: the material list is
    typed `Material[]`, so reaching in for a uniform would need a cast that would
    stop being checked if the face material ever changed shape.
  */
  let faceUniforms: { uFrame: { value: number } } | null = null;

  mesh.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    if (HIDDEN.has(child.name)) {
      child.visible = false;
      return;
    }

    /*
      Every mesh runs a per-mesh shader keyed on its name. The face mesh is
      deliberately left on the default material: it carries its own expression
      texture, and swapping it for a matcap flattens it into the body.
    */
    if (child.name === "head") {
      const material = new THREE.ShaderMaterial({
        vertexShader: avatarHeadVertexShader,
        fragmentShader: avatarHeadFragmentShader,
        transparent: true,
        uniforms: {
          uHeadTexture: { value: headTexture },
          ...uniforms,
        },
      });
      child.material = material;
      materials.push(material);
      child.renderOrder = 24;
      return;
    }

    /*
      The face gets its own atlas shader, and depth testing is disabled so the
      expression always lands on top of the head mesh rather than z-fighting
      with the skull it sits fractionally in front of.
    */
    if (child.name === "face") {
      faceUniforms = { uFrame: { value: 0 } };
      const material = new THREE.ShaderMaterial({
        vertexShader: avatarFaceVertexShader,
        fragmentShader: avatarFaceFragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTexture: { value: faceTexture },
          ...faceUniforms,
          ...uniforms,
        },
      });
      child.material = material;
      materials.push(material);
      child.renderOrder = 25;
      return;
    }

    const matcap = matcapTextures.find(([name]) => name === child.name);
    if (!matcap) return;

    const material = new THREE.ShaderMaterial({
      vertexShader: avatarMatcapVertexShader,
      fragmentShader: avatarMatcapFragmentShader,
      transparent: true,
      uniforms: {
        uMatcap: { value: matcap[1] },
        ...uniforms,
      },
    });
    child.material = material;
    materials.push(material);
    child.renderOrder = 24;
  });

  /*
    Orientation
    -----------
    The GLB's root node carries a 120 degree rotation about (1, 1, -1), baked
    in at export, which lays the figure on its side. Upstream clears it with a
    single line — `mesh.rotation.z = 0` in `objects/avatar/index.ts` — and the
    figure then stands correctly in a normal Y-up three.js world.

    Only the Z component is cleared, exactly as upstream does it. Setting all
    three axes to zero was tried first and is wrong: three.js stores the file's
    rotation as a quaternion and `rotation` reads back the Euler equivalent, so
    assigning all three axes discards the X and Y the model is actually built
    with. The result rendered as a lone dome with the rest of the body outside
    the frame — no error, just a scene with a hat in it.

    So this is upstream's single line, no more.
  */
  mesh.rotation.z = 0;
  scene.add(mesh);

  /*
    Surface shader compile/link failures instead of letting them pass silently.
    A ShaderMaterial whose program fails to build renders nothing and throws
    nothing, so the failure is otherwise indistinguishable from an empty scene.
  */

  /* ------------------------------------------------------------------
     Hologram
     ------------------------------------------------------------------ */

  /*
    Built here, after the material pass and after the orientation fix, because
    upstream's hologram construction reads exactly those two things: the merged
    geometry of the body meshes (geometry only — the materials this stage just
    assigned are irrelevant to the merge) and the root's corrected rotation and
    scale, which it copies.

    A failure degrades to "no hologram" rather than taking the character down with
    it: the avatar renders correctly on its own, and `createAvatarAnimations`
    accepts a missing hologram mixer on purpose.
  */
  let hologram: AvatarHologramHandle | null = null;
  try {
    hologram = createAvatarHologram({ avatarMesh: mesh });
    scene.add(hologram.group);
  } catch (error) {
    console.warn("[avatar] hologram unavailable:", error);
    hologram = null;
  }

  /* ------------------------------------------------------------------
     Animation state machine
     ------------------------------------------------------------------ */

  /*
    Every clip, weight, loop mode, blink and crossfade upstream's
    `objects/avatar/animations.ts`, `face.ts` and `left-desktop.ts` describe now
    lives behind this one handle, which the caller's own frame loop drives. The
    construction order mirrors upstream's `animations.init()`: both action maps,
    `play("desktop-idle")`, then `wave()`.
  */
  const animations = createAvatarAnimations({
    mesh,
    hologramMesh: hologram?.mesh ?? null,
    clips: gltf.animations,
    faceUniforms: faceUniforms ?? undefined,
  });

  /*
    Warm the mixer and the shaders so the first visible frame is not a stutter.
    Upstream's first tick does the same work; at the top of the scroll
    `tIdleIntensity` is 0 and the wave is at full strength, which is exactly the
    pose upstream opens on.
  */
  animations.update(0, { tIdleIntensity: 0 });
  renderer.compile(scene, camera);

  /*
    The frame clock. The caller supplies a delta in seconds; this accumulates it
    into a monotonic elapsed value, which is what the state machine advances on.
    It takes a clock rather than a delta so a caller can hand over any monotonic
    time source (a page-lifetime timestamp, an rAF timestamp) without the two
    disagreeing about what the deltas mean.
  */
  let elapsed = 0;

  return {
    animations,
    hologram,
    getMesh: () => mesh,
    getRightHandWorldPosition: () => {
      if (!mesh) return null;
      const bone = mesh.getObjectByName("bone-right-hand");
      if (!bone) return null;
      const world = new THREE.Vector3();
      bone.getWorldPosition(world);
      return world;
    },
    play: (name, transition) => animations.play(name, transition),
    wave: () => animations.wave(),
    wakeUp: () => animations.wakeUp(),
    getIsAwake: () => animations.getIsAwake(),

    update(delta, progress, ambient, weights) {
      elapsed += delta;

      /*
        The three weights the caller does not currently pass, defaulted in the
        order upstream derives them.

        `ambient` is upstream's `sceneWeightsInOut.about.in` — the About act's
        incoming ramp — and the two other about-act scalars are functions of it in
        upstream's own timeline:

          - `tIdleIntensity` is tweened 0 -> 1 with `power1.out` over that same
            timeline but finishes 25 % early (duration 0.75 against the ramp's 1),
            so deriving it from `ambient` reproduces the two tweens' relationship
            rather than approximating it.
          - `sceneWeights.hero` is `clamp(hero.in * (1 - hero.out))`, and the About
            act's in-timeline tweens `hero.out` 0 -> 1 linearly across exactly the
            span `about.in` covers, so `hero` is `1 - about`. That is what puts the
            left-desktop trigger in the opening shot, which is upstream's hero
            scene, and closes its gate as the act scrolls.
      */
      const about = weights?.about ?? ambient;
      const tIdleIntensity = weights?.tIdleIntensity ?? estimateTIdleIntensity(ambient);
      const hero = weights?.hero ?? Math.max(0, 1 - about);
      const visible =
        weights?.visible ?? (typeof document === "undefined" ? true : !document.hidden);

      animations.update(elapsed, {
        tIdleIntensity,
        wavingStrength: weights?.wavingStrength,
        contact: weights?.contact,
        about,
        hero,
        visible,
      });

      /*
        The hologram runs upstream's own tick: the same absolute clock feeds its
        travelling scanlines, and its reveal line uses the same
        `aboutProgress * 1.1 - 0.1` formula the character's dissolve uses. Here
        `ambient` stands in for `aboutProgress` because this site's single scroll
        act compresses both of upstream's about-act scalars into one value.
      */
      hologram?.update(elapsed, about, about * 1.1 - 0.1);

      uniforms.uProgress.value = progress;
      uniforms.uAmbientStrength.value = ambient;
    },

    dispose() {
      animations.dispose();
      if (hologram) {
        scene.remove(hologram.group);
        hologram.dispose();
      }
      scene.remove(mesh);
      mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
      });
      materials.forEach((material) => material.dispose());
      for (const [, texture] of matcapTextures) texture.dispose();
      headTexture.dispose();
    },
  };
}

/**
 * Upstream's `tIdleIntensity`, derived from the one scroll value this port's
 * caller supplies.
 *
 * From `animations/transitions/about.ts`: `tIdleIntensity` is tweened
 * `{ value: 0 } -> { value: 1, duration: 0.75, ease: "power1.out" }` at position 0
 * of the About act's in-timeline, while `sceneWeightsInOut.about.in` — the value
 * that reaches this stage as `ambient` — is the same timeline's `ease: "none"`
 * 0 -> 1 tween. So the typing idle is fully blended at 75 % of the ramp and the
 * curve between is `power1.out`, both reproduced here.
 */
function estimateTIdleIntensity(aboutIn: number): number {
  const t = Math.min(1, Math.max(0, aboutIn / 0.75));
  return 1 - (1 - t) * (1 - t);
}