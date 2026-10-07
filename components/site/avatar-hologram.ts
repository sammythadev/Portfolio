/**
 * The hologram — upstream's `objects/avatar/hologram.ts` and
 * `objects/avatar/hologram-material.ts` in one factory.
 *
 * Ported from the interactive portfolio at github.com/davidhckh/portfolio-2025 by
 * David Heckhoff, licensed CC BY-NC-SA 4.0. Original: https://david-hckh.com
 *
 * What this is
 * ------------
 * A second copy of the character, rendered additively with a Fresnel + scanline +
 * travelling-line shader, that appears over the About act. It is *not* a clone of
 * the visible avatar: upstream merges the raw geometries of five of the six
 * renderable meshes into one `SkinnedMesh`, binds it to a separately cloned
 * skeleton, and drives that skeleton with its own mixer. The two characters are
 * independent poses that happen to be fed identical weights, which is why the
 * hologram can lag or drift the way a projection would.
 *
 * Upstream's `hologram.ts` merges `["black", "gray", "skin", "white", "head", "brain"]`.
 * There is no `brain` node in this GLB — six meshes exist (`black`, `face`, `gray`,
 * `head`, `skin`, `white`) and `face` is deliberately excluded because the face is
 * a flat quad with no volume — so the list here is the five that exist. The merge
 * order is the *traverse* order, not the list's order: upstream filters during a
 * `traverse`, so the vertices land in scene-graph order (`black`, `gray`, `head`,
 * `skin`, `white`). The filter below mirrors that, because vertex order is what
 * decides whether a diff against upstream is comparing like with like.
 *
 * What is not carried over
 * ------------------------
 *   - Upstream clones each source geometry before merging
 *     (`geometries.push(child.geometry.clone())`). `mergeGeometries` allocates a
 *     fresh `BufferGeometry` from the vertex data and never mutates its inputs, so
 *     those clones are immediately garbage. Dropped.
 *   - Upstream's hand-built `center` attribute (a `(1,0,0)` / `(0,1,0)` / `(0,0,1)`
 *     cycle per vertex). No hologram shader reads `center` — it is dead upstream —
 *     and it costs three floats per vertex of GPU memory in a merged, skinned
 *     buffer. Dropped.
 *   - `geometry.toNonIndexed()` whose return value upstream discards (a no-op).
 *     Dropped; the merged geometry stays indexed, which is what upstream renders.
 *   - `vPosition` is kept as an upstream-declared varying even though the fragment
 *     stage never reads it, because it is free and it documents the model-space
 *     position a future effect would want.
 *
 * The parent transform
 * --------------------
 * Upstream parents this as `avatar.transform -> hologram.transform -> mesh`, so the
 * hologram inherits the avatar's own motion (the waypoint position/rotation, the
 * contact teleport) for free while carrying its own copy of the loaded root's
 * rotation and scale. This port's scene graph is assembled by the caller —
 * `scroll-sequence.tsx` takes `avatar.getMesh()` and adds it to a group it moves —
 * so the sibling relationship is reconstructed at runtime: `update()` mirrors the
 * avatar mesh's *parent* world matrix onto the hologram group each frame. The
 * result is the same composition upstream gets from its group nesting, and it
 * requires nothing of the caller.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

/* -------------------------------------------------------------------------- */
/* Shaders                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Upstream `shaders/hologram/vertex.glsl`, with its two `#include`s inlined.
 *
 * The include `includes/avatar-progress/vertex.glsl` only supplies
 * `getModelProgress`, which is the same `(worldY + 0.2) / 4.7` height ramp every
 * other avatar shader uses; it is inlined as the function rather than as a bare
 * expression so the shader still reads like upstream's. The base vertex shader
 * rebuilds the skinned normal by hand for the same reason the matcap shader does:
 * `vNormal` in three's stock skinning path is written pre-skinning, so the Fresnel
 * term would swim across the surface as the character breathes.
 *
 * Upstream also declares `uniform float uTime;` here and never uses it (it is the
 * fragment stage's uniform). Dropped rather than declared-unused.
 */
export const hologramVertexShader = /* glsl */ `
  #include <skinning_pars_vertex>

  varying float vModelProgress;
  uniform float uProgress;

  #define SMOOTH_WIDTH 0.002

  float getModelProgress(vec3 position) {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    return (worldPosition.y + 0.2) / 4.7;
  }

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vPosition;

  void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>

    #include <project_vertex>

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);

    // Normal skinning — the same by-hand reconstruction the matcap shader uses.
    vec4 skinnedNormal = vec4(0.0);
    skinnedNormal += boneMatX * vec4(normal, 0.0) * skinWeight.x;
    skinnedNormal += boneMatY * vec4(normal, 0.0) * skinWeight.y;
    skinnedNormal += boneMatZ * vec4(normal, 0.0) * skinWeight.z;
    skinnedNormal += boneMatW * vec4(normal, 0.0) * skinWeight.w;
    vNormal = skinnedNormal.xyz;

    vWorldPos = worldPosition.xyz;
    vPosition = transformed;

    vModelProgress = getModelProgress(transformed);
  }
`;

/**
 * Upstream `shaders/hologram/fragment.glsl`, with
 * `includes/avatar-progress/fragment.glsl` inlined as `getProgress()`.
 *
 * Three additive terms make the effect: a horizontal scanline band that travels up
 * the body with `uTime`, a Fresnel rim, and the bright "reveal line" where the
 * fragment's height ramp meets `uProgress` — the same scalar the body's dissolve
 * uses, so the hologram and the character are erased by one sweep. `smoothstep`
 * with a reversed edge pair (`0.8, 0.4`) is upstream's; it reads as an inverse ramp
 * and is kept verbatim rather than rewritten as `1.0 - smoothstep(...)`.
 */
export const hologramFragmentShader = /* glsl */ `
  varying float vModelProgress;
  uniform float uProgress;

  #define SMOOTH_WIDTH 0.002

  float getProgress() {
    float s = smoothstep(uProgress, uProgress + SMOOTH_WIDTH, vModelProgress);
    // If uProgress == 0.0, return 1.0, otherwise use s
    return mix(s, 1.0, step(uProgress, 0.0));
  }

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vPosition;

  uniform vec3 uColor;
  uniform float uTime;

  #define LINE_WIDTH 0.003
  #define FADE_WIDTH 0.02

  void main() {
    vec3 normal = normalize(vNormal);

    if (!gl_FrontFacing)
      normal *= -1.0;

    float progress = 1. - getProgress();

    float stripes = mod((vWorldPos.y - uTime * 0.1) * 25.0, 1.0);
    stripes = pow(stripes, 3.0);

    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    float fresnel = pow(1.0 - dot(viewDir, normal), 2.);
    float falloff = smoothstep(.8, 0.4, fresnel);

    float holographic = stripes * fresnel;
    holographic += fresnel;
    holographic += stripes * 0.05;
    holographic *= falloff;

    float dist = abs(vModelProgress - uProgress);
    float lineStrength = 1.0 - smoothstep(LINE_WIDTH - FADE_WIDTH, LINE_WIDTH + FADE_WIDTH, dist);

    holographic += lineStrength * 2.;

    if (!gl_FrontFacing)
      holographic *= 0.4;

    gl_FragColor = vec4(uColor, min(holographic * progress, 1.0));
  }
`;

/* -------------------------------------------------------------------------- */
/* Factory                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The meshes merged into the hologram body. `face` is excluded (a flat quad with
 * no volume to project) and `brain` does not exist in this GLB.
 */
const GEOMETRY_NAMES: readonly string[] = ["black", "gray", "skin", "white", "head"];

export type HologramUniforms = {
  uTime: { value: number };
  uColor: { value: THREE.Color };
  uProgress: { value: number };
};

export type AvatarHologramOptions = {
  /**
   * The loaded avatar root — upstream's
   * `resources.items["avatar-model"].scene.children[0]`. Both the merged geometry
   * and the cloned skeleton come from here.
   */
  avatarMesh: THREE.Object3D;
};

export type AvatarHologramHandle = {
  /** Upstream's hologram `transform` group, the thing that carries the avatar's motion. */
  group: THREE.Group;
  mesh: THREE.SkinnedMesh;
  material: THREE.ShaderMaterial;
  uniforms: HologramUniforms;
  /**
   * Upstream's hologram `tick()`: `uTime` from the ticker clock, `uProgress` from
   * the About progress ramp, `visible` from the About weight.
   */
  update: (time: number, aboutWeight: number, aboutProgress: number) => void;
  dispose: () => void;
};

/**
 * `Matrix4` used when the avatar root has not been parented yet. Shared and never
 * mutated.
 */
const IDENTITY = new THREE.Matrix4();

export function createAvatarHologram({
  avatarMesh,
}: AvatarHologramOptions): AvatarHologramHandle {
  /* ---- skeleton (upstream `setupSkeleton`) ------------------------------- */

  /*
    The skeleton must be a clone. `mesh.add(skeleton.bones[0])` below reparents the
    root bone, and a bone can only have one parent — binding the live avatar's own
    skeleton would tear the character apart at the hips.

    `SkeletonUtils.clone` is upstream's exact call. Note the addon ships no
    TypeScript declarations in @types/three 0.186; with `allowJs` the JS is
    inferred as an `any`-shaped function, so the result is cast back to `Object3D`.
  */
  const cloned = cloneSkeleton(avatarMesh) as THREE.Object3D;
  const clonedBlack = cloned.getObjectByName("black");
  if (!(clonedBlack instanceof THREE.SkinnedMesh)) {
    throw new Error("[avatar-hologram] cloned armature has no skinned black mesh");
  }
  const skeleton = clonedBlack.skeleton;

  /* ---- geometry (upstream `setupGeometry`) ------------------------------- */

  const geometries: THREE.BufferGeometry[] = [];

  avatarMesh.traverse((child) => {
    if (child instanceof THREE.Mesh && GEOMETRY_NAMES.includes(child.name)) {
      geometries.push(child.geometry);
    }
  });

  if (geometries.length === 0) {
    throw new Error("[avatar-hologram] no hologram geometries found on the avatar root");
  }

  const geometry = mergeGeometries(geometries);
  if (!geometry) {
    throw new Error("[avatar-hologram] mergeGeometries returned null for the hologram body");
  }

  /* ---- material (upstream `hologram-material.ts`) ------------------------ */

  const uniforms: HologramUniforms = {
    uTime: { value: 0 },
    /*
      Additive cyan. `new Color("rgb(0, 234, 255)")` goes through three's colour
      management, so the string is read as sRGB and stored linear — the same value
      upstream's `new Color("rgb(0, 234, 255)")` produces, which matters because
      the renderer re-encodes on output.
    */
    uColor: { value: new THREE.Color("rgb(0, 234, 255)") },
    uProgress: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: hologramVertexShader,
    fragmentShader: hologramFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms,
  });

  /* ---- mesh (upstream `setupMesh`) --------------------------------------- */

  const mesh = new THREE.SkinnedMesh(geometry, material);

  /*
    Identity bind matrix plus the root bone as a child of the mesh. The cloned
    skeleton's bone inverses are still the GLB's, and the source root's rotation
    and scale are copied below, so the bone world matrices cancel the inverses the
    same way they do for the visible avatar — this is the standard
    `SkeletonUtils`-clone construction, not a shortcut.
  */
  mesh.bind(skeleton, new THREE.Matrix4());
  mesh.add(skeleton.bones[0]);

  /*
    Rotation and scale only: upstream copies those two and deliberately leaves the
    hologram's position at the group origin, so the merged body sits exactly where
    the armature does (its authored position is ~1e-4 off zero, and keeping that
    offset is upstream's behaviour).
  */
  mesh.rotation.copy(avatarMesh.rotation);
  mesh.scale.copy(avatarMesh.scale);
  mesh.rotation.z = 0;

  mesh.frustumCulled = false;
  // Behind every avatar mesh (24) and the face (25), in front of the grid floor.
  mesh.renderOrder = 23;
  // Upstream's tick hides it before the About weight rises; without this the
  // hologram would be drawn for the one frame between construction and the first
  // update.
  mesh.visible = false;

  const group = new THREE.Group();
  /*
    The group's matrix is written directly from the avatar's world matrix every
    frame, so three must not rebuild it from position/quaternion/scale on the next
    `updateMatrixWorld()`. `matrixWorldNeedsUpdate` is set in `update()` instead.
  */
  group.matrixAutoUpdate = false;
  group.add(mesh);

  /* ---- per-frame ---------------------------------------------------------- */

  const update = (time: number, aboutWeight: number, aboutProgress: number) => {
    // upstream: `hologramUniforms.uTime.value = gsap.ticker.time;`
    uniforms.uTime.value = time;
    // upstream: `hologramUniforms.uProgress.value = aboutProgress.value * 1.1 - 0.1;`
    uniforms.uProgress.value = aboutProgress;
    // upstream: `mesh.visible = sceneWeights.about > 0.001;`
    mesh.visible = aboutWeight > 0.001;

    /*
      Reconstruct the sibling relationship: the hologram group stands in for
      `avatar.transform`, so it takes the avatar mesh's parent world matrix. The
      avatar's parent is refreshed first because the caller has usually just
      written a new position/rotation onto it this frame and its `matrixWorld` is
      still last frame's — using the stale one would lag the hologram behind the
      character by a frame, which reads as jitter while scrolling.

      The group is added to the scene, whose own transform is identity, so
      `group.matrixWorld === group.matrix` and the copy is exact.
    */
    const parent = avatarMesh.parent;
    if (parent) parent.updateWorldMatrix(true, false);
    group.matrix.copy(parent ? parent.matrixWorld : IDENTITY);
    group.matrixWorldNeedsUpdate = true;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { group, mesh, material, uniforms, update, dispose };
}
