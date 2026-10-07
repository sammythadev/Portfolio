# Avatar object — exact implementation spec

Source repo: `/home/sammy/sammys-web/portfolio-2025`

**Correction up front:** that repo is **Vue 3 + Vite + TypeScript** (`vue`, `@vitejs/plugin-vue`, `vite-plugin-glsl`, `gsap ^3.13`, `three ^0.181.0`, `howler`, `lenis`). It is **not** Next.js/React. The "Next.js" framing in the request does not match the source; nothing in the avatar system is framework-specific (no React/Next APIs) so it ports cleanly, but the port must supply its own module-level singletons (`resources`, `scene`, `sceneWeights`, `sizes`, `features`, `playSound`, `sprites`, `desktops`, `messagePopup`, `sleepingSprite`, `aboutProgress`).

Files read in full:
`src/three/objects/avatar/{index,animations,face,left-desktop,hologram,hologram-material}.ts`,
`src/three/shaders/{avatar-face,avatar-head,avatar-matcap,hologram}/{vertex,fragment}.glsl`,
`src/three/shaders/includes/avatar-progress/{vertex,fragment}.glsl`,
`src/three/shaders/includes/about-ambient.glsl`,
`src/animations/transitions/{about,contact}.ts` (note: real path is `src/animations/...`, **not** `src/three/animations/...`),
plus `src/sources.ts`, `src/utils/resources.ts`, `src/utils/features.ts`, `src/animations/scenes.ts`, `src/three/objects/index.ts`, `src/three/core/{scene,renderer}.ts`, `src/animations/{index,intro}.ts`, `src/three/objects/room/mouse.ts`, `src/utils/sizes.ts`, and the GLB binary itself.

---

## 0. GLB facts (measured from `src/assets/models/avatar.glb`)

Container: glTF 2.0, JSON chunk 130 400 B, BIN chunk 486 108 B, total 616 536 B. No `extensionsUsed` / `extensionsRequired` (no Draco, no meshopt, no KTX2).

**The GLB contains NO materials, NO textures, NO images, NO samplers.** (`materials`, `textures`, `images` arrays are all absent.) Every material is created in code. Importing this GLB into a new project yields meshes with the loader's default `MeshStandardMaterial`, which the avatar code then overwrites wholesale.

**Scene graph:** one scene `"Scene"`, roots `[31]`.

| node idx | name | kind | children | TRS |
|---|---|---|---|---|
| 31 | `armature` | Group (skinned root) | `[25,26,27,28,29,30,24]` | T=(-0.00009566…) actually T=`[0.00009566172957420349, 0.000004385568900033832, 0.00018998980522155762]`, R=`[0.5, 0.5, -0.5000000596046448, 0.4999999403953552]`, S=`[1.0384337902069092, 1.0384337902069092, 1.0384337902069092]` |
| 25 | `black` | SkinnedMesh, mesh 0, skin 0 | — | — |
| 26 | `face` | SkinnedMesh, mesh 1, skin 0 | — | — |
| 27 | `gray` | SkinnedMesh, mesh 2, skin 0 | — | — |
| 28 | `head` | SkinnedMesh, mesh 3, skin 0 | — | — |
| 29 | `skin` | SkinnedMesh, mesh 4, skin 0 | — | — |
| 30 | `white` | SkinnedMesh, mesh 5, skin 0 | — | — |
| 24 | `hipsBone` | Bone (root joint) | `[15,19,23]` | — |

**There are exactly six renderable meshes: `black`, `face`, `gray`, `head`, `skin`, `white`. There is no `brain` node in this GLB** — `GEOMETRY_NAMES` in `hologram.ts` and `mesh.getObjectByName("brain")` in `index.ts` refer to a node that no longer exists; both are no-ops/dead code.

Each mesh primitive has attributes `POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0` and **no** `material` index. glTF-side mesh names are `"pants-right.001_Cylinder.006mesh.001"`, `"face_Cube.001mesh.001"`, `"pants-bottom-right.001_Cylinder.007mesh.001"`, `"ears.001_Circle.001mesh.003"`, `"arm-right.002_Roundcube.005mesh.001"`, `"shoe-white-right_Roundcube.031mesh.001"`; three.js's `GLTFLoader` overrides `object.name` with the **node** name, which is why the code keys off `black/face/gray/head/skin/white`.

Skin 0: `name: "armature"`, 25 joints, `skeleton` index undefined (implicit root = joints[0]).
Joint order (important — `hologram.ts` uses `skeleton.bones[0]`):
`[0] hipsBone, [1] spineBone, [2] spine1Bone, [3] spine2Bone, [4] headBone, [5] leftShoulderBone, [6] leftArmBone, [7] leftForeArmBone, [8] leftHandBone, [9] leftHandIndex1Bone, [10] leftHandIndex2Bone, [11] rightShoulder, [12] rightarmBone, [13] rightForearmBone, [14] rightHandBone, [15] bone-right-hand, [16] rightHandIndex2Bone, [17] leftUpLegBone, [18] leftLegBone, [19] leftFootBone, [20] leftToeBaseBone, [21] rightUpLegBone, [22] rightLegBone, [23] rightFootBone, [24] rightToeBaseBone`.
So `skeleton.bones[0] === hipsBone`.

### Animation clips (exhaustive)

| index | clip name | duration (s) | duration in 24ths | channels | samplers |
|---|---|---|---|---|---|
| 0 | `contact-idle` | 2.0833333333333335 | 50/24 | 75 | 75 |
| 1 | `idle` | 3.375 | 81/24 | 75 | 75 |
| 2 | `left-desktop` | 4.791666666666667 | 115/24 | 75 | 75 |
| 3 | `sleeping` | 2.0833333333333335 | 50/24 | 75 | 75 |
| 4 | `t-idle` | 1.6666666666666667 | 40/24 | 40/24 → 40/24 | 75 |
| 5 | `wake-up` | 0.8333333333333334 | 20/24 | 75 | 75 |
| 6 | `wave` | 2.7083333333333335 | 65/24 | 75 | 75 |

(`t-idle` = 1.6666666666666667 s = 40/24 s.) All clips bake **75 channels = the same 25 bones × {translation, rotation, scale}**. Interpolation is mixed `LINEAR` + `STEP`. No clip animates the `armature` root, so clip playback never fights `mesh.rotation.z = 0`.

### Texture files actually used by the avatar system

From `src/sources.ts` (all loaded via `THREE.TextureLoader`, and `resources.ts` initially assigns `file.colorSpace = SRGBColorSpace` to **every** texture before the avatar code overrides it):

| `resources.items` key | file | dimensions | format | used by |
|---|---|---|---|---|
| `avatar-model` | `src/assets/models/avatar.glb` | — | glTF | all avatar meshes + animations |
| `face-texture` | `src/assets/textures/face-spritesheet.png` | 1024×1024 | PNG RGBA | `face` mesh material |
| `head-texture` | `src/assets/textures/head.webp` | 256×256 | WEBP RGB | `head` mesh material |
| `matcap-black` | `src/assets/textures/matcap-black.webp` | 256×256 | WEBP RGB | default matcap in `getMaterial` + `black` mesh |
| `matcap-gray` | `src/assets/textures/matcap-gray.webp` | 256×256 | WEBP RGB | `gray` mesh |
| `matcap-skin` | `src/assets/textures/matcap-skin.webp` | 256×256 | WEBP RGB | `skin` mesh |
| `matcap-white` | `src/assets/textures/matcap-white.webp` | 256×256 | WEBP RGB | `white` mesh |

Related but **not** part of the avatar object: `hologram-plane-texture` (`hologram-plane.webp`, 256×171) belongs to `src/three/objects/lab/plane.ts`, which merely *reads* `hologramUniforms.uProgress`; `desktops-texture` (512×512) belongs to `room/desktops.ts`; `contact-*` textures belong to the contact scene.

Renderer context that the material colour decisions assume: `src/three/core/renderer.ts` creates `new WebGLRenderer({ canvas, antialias: true, alpha: false })` and **never sets `outputColorSpace` or `toneMapping`** → three r181 defaults (`outputColorSpace = SRGBColorSpace`, `toneMapping = NoToneMapping`). The avatar textures are deliberately marked `LinearSRGBColorSpace` (i.e. treated as linear data, no sRGB decode) and the shaders write raw values, so the framebuffer's linear→sRGB encode on output is what makes them look right. If the port changes `toneMapping` or leaves textures in `SRGBColorSpace`, the avatar will not match.

---

## 1. Material assignment — complete logic

### Entry point: `src/three/objects/avatar/index.ts`

```ts
const getMaterial = (name: string): Material | null => {
  if (name === "face") return face.getMaterial();
  if (name === "head") {
    const texture = resources.items["head-texture"];
    texture.flipY = false;
    texture.colorSpace = LinearSRGBColorSpace;
    texture.generateMipmaps = false;
    return new ShaderMaterial({
      vertexShader: headVertexShader,
      fragmentShader: headFragmentShader,
      transparent: true,
      uniforms: {
        uHeadTexture: { value: texture },
        ...uniforms,
      },
    });
  }

  const tex = resources.items["matcap-black"];
  tex.colorSpace = LinearSRGBColorSpace;
  tex.generateMipmaps = false;

  return new ShaderMaterial({
    vertexShader: matcapVertexShader,
    fragmentShader: matcapFragmentShader,
    transparent: true,
    uniforms: {
      uMatcap: { value: tex },
      ...uniforms,
    },
  });
};

const assignMatcap = (child: Mesh): boolean => {
  let tex: Texture | null = null;

  if (child.name === "black") {
    tex = resources.items["matcap-black"];
  } else if (child.name === "gray") {
    tex = resources.items["matcap-gray"];
  } else if (child.name === "skin") {
    tex = resources.items["matcap-skin"];
  } else if (child.name === "white") {
    tex = resources.items["matcap-white"];
  }

  if (tex) {
    tex.colorSpace = LinearSRGBColorSpace;
    child.userData.matcap = tex;
    return true;
  }

  return false;
};
```

Traversal in `setupMesh()`:

```ts
mesh.traverse((child) => {
  if (child instanceof Mesh) {
    const mat = getMaterial(child.name);
    if (!mat) return;
    child.material = mat;
    child.frustumCulled = false;
    child.renderOrder = child.name === "face" ? 25 : 24;

    const hasMatcap = assignMatcap(child);
    if (hasMatcap) {
      child.onBeforeRender = () => {
        child.material.uniforms.uMatcap.value = child.userData.matcap;
      };
    }
  }
});
```

### Per-mesh table

| GLB mesh | shader program | texture passed in `uniforms` at construction | uniform `uMatcap` after first `onBeforeRender` | `colorSpace` | `flipY` | `generateMipmaps` | `transparent` | `renderOrder` |
|---|---|---|---|---|---|---|---|---|
| `black` | avatar-matcap | `matcap-black` | `matcap-black` | `LinearSRGBColorSpace` | **untouched → `true`** (TextureLoader default) | `false` | `true` | 24 |
| `gray` | avatar-matcap | `matcap-black` | `matcap-gray` | `LinearSRGBColorSpace` | untouched → `true` | **untouched → `true`** (only `matcap-black` gets `false`) | `true` | 24 |
| `skin` | avatar-matcap | `matcap-black` | `matcap-skin` | `LinearSRGBColorSpace` | untouched → `true` | untouched → `true` | `true` | 24 |
| `white` | avatar-matcap | `matcap-black` | `matcap-white` | `LinearSRGBColorSpace` | untouched → `true` | untouched → `true` | `true` | 24 |
| `head` | avatar-head | `head-texture` | n/a (no `assignMatcap`) | `LinearSRGBColorSpace` | **`false`** (explicitly set) | `false` | `true` | 24 |
| `face` | avatar-face | `face-texture` | n/a | `LinearSRGBColorSpace` | **untouched → `true`** | `false` | `true` (+ `depthTest: false`, `depthWrite: false`) | **25** |

Notes that matter for an exact port:

* A **separate `ShaderMaterial` instance is created per mesh** (`getMaterial` is called inside `traverse`). Each has its own `uMatcap`/`uHeadTexture`/`uTexture` uniform object, but **`uProgress` and `uAmbientStrength` are the same two uniform objects shared by every avatar material** (see §4), because `...uniforms` spreads the module-level `{ uProgress: {value:0}, uAmbientStrength: {value:0} }` by reference.
* Because each material is constructed with `matcap-black`, the `onBeforeRender` swap is **the only thing that makes `gray`/`skin`/`white` render with their own matcap.** Dropping `onBeforeRender` silently makes three meshes render black.
* `assignMatcap` mutates `colorSpace` on `matcap-black`, `matcap-gray`, `matcap-skin`, `matcap-white`. It never touches `generateMipmaps`, never touches `flipY`.
* `ShaderMaterial` defaults everywhere else: `side = FrontSide`, `depthTest = true`, `depthWrite = true`, `blending = NormalBlending`, `fog = false`, `lights = false`.
* All other render orders in the project for context: hologram mesh `23`, lab plane `24`, lab `shine` `30`, `electric` `25`, `base` `20`, `display` `21`, particles `22`, `dark-plane` `10`, `grid-floor` `-100`, `room` `-10`, shadows `-1000`.

### Face material (`src/three/objects/avatar/face.ts`)

```ts
const getMaterial = (): Material | null => {
  const texture = resources.items["face-texture"];
  texture.colorSpace = LinearSRGBColorSpace;
  texture.generateMipmaps = false;

  material = new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fragmentShader,
    vertexShader,
    uniforms: { uTexture: { value: texture }, ...uniforms, ...avatar.uniforms },
  });

  return material;
};
```
`uniforms` here is the face module's own `const uniforms = { uFrame: { value: 0 } };`, and `avatar.uniforms` is `{ uProgress, uAmbientStrength }`. Final face uniforms: `uTexture`, `uFrame`, `uProgress`, `uAmbientStrength`. `flipY` is left at the default `true`.

### Hologram material (`src/three/objects/avatar/hologram-material.ts`)

```ts
const uniforms = {
  uTime: { value: 0 },
  uColor: { value: new Color("rgb(0, 234, 255)") },
  uProgress: { value: 0 },
};

const getMaterial = () => {
  if (material) return material;

  material = new ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms,
  });

  return material;
};
```
The hologram's `uProgress` is a **separate** uniform from `avatar.uniforms.uProgress` (same formula, different object, updated in `hologram.ts`'s own tick). No texture is used by the hologram shader at all.

---

## 2. Animation state machine — verbatim

`src/three/objects/avatar/animations.ts`, complete:

```ts
import { avatar } from ".";
import { avatarHologram } from "./hologram";
import { AnimationAction, AnimationMixer, LoopOnce, LoopPingPong } from "three";
import gsap from "gsap";
import { resources } from "../../../utils/resources";
import { sceneWeights } from "../../../animations/scenes";
import { face } from "./face";
import { sleepingSprite } from "../contact/sleeping-sprite";
import { playSound } from "../../../features/sounds/utils/sounds";
import { isFeatureEnabled } from "../../../utils/features";
import { stopSnoreRepetition } from "../../../features/sounds/core/contact";

import type { AnimationClip, Object3D } from "three";

let mixer: AnimationMixer;
let activeAction: string | null = null;
const actions = new Map<string, AnimationAction>();
let isAwake = false;
const wavingStrength = { value: isFeatureEnabled("introWave") ? 1 : 0 };
let hologramMixer: AnimationMixer;
const hologramActions = new Map<string, AnimationAction>();

const init = () => {
  mixer = new AnimationMixer(avatar.getMesh() as Object3D);
  hologramMixer = new AnimationMixer(avatarHologram.getMesh() as Object3D);

  setupActions();
  setupHologramActions();

  play("desktop-idle");

  wave();
};

const getActionFromMesh = (name: string) => {
  const resource = resources.items["avatar-model"];
  const action = resource.animations.find((animation: AnimationClip) => animation.name === name);
  if (!action) throw new Error("[AvatarAnimations] Action not found");
  return action;
};

const setupActions = () => {
  //idle
  const desktopIdle = mixer.clipAction(getActionFromMesh("idle"));
  desktopIdle.loop = LoopPingPong;
  actions.set("desktop-idle", desktopIdle);
  desktopIdle.weight = 1;

  //t-idle
  const tIdle = mixer.clipAction(getActionFromMesh("t-idle"));
  tIdle.loop = LoopPingPong;
  actions.set("t-idle", tIdle);
  tIdle.weight = 0;
  tIdle.play();

  //left-desktop
  const leftDesktop = mixer.clipAction(getActionFromMesh("left-desktop"));
  leftDesktop.repetitions = 1;
  leftDesktop.clampWhenFinished = true;
  actions.set("left-desktop", leftDesktop);
  leftDesktop.weight = 0;

  //sleeping
  const sleeping = mixer.clipAction(getActionFromMesh("sleeping"));
  sleeping.loop = LoopPingPong;
  actions.set("sleeping", sleeping);
  sleeping.weight = 1;
  sleeping.play();

  //wake-up
  const wake = mixer.clipAction(getActionFromMesh("wake-up"));
  wake.repetitions = 1;
  wake.clampWhenFinished = true;
  actions.set("wake-up", wake);

  //contact-idle
  const contactIdle = mixer.clipAction(getActionFromMesh("contact-idle"));
  contactIdle.loop = LoopPingPong;
  actions.set("contact-idle", contactIdle);

  //wave
  const wave = mixer.clipAction(getActionFromMesh("wave"));
  wave.clampWhenFinished = true;
  wave.loop = LoopOnce;
  actions.set("wave", wave);
};

const setupHologramActions = () => {
  //idle
  const desktopIdle = hologramMixer.clipAction(getActionFromMesh("idle"));
  desktopIdle.loop = LoopPingPong;
  hologramActions.set("desktop-idle", desktopIdle);
  desktopIdle.weight = 1;
  desktopIdle.play();

  //t-idle
  const tIdle = hologramMixer.clipAction(getActionFromMesh("t-idle"));
  tIdle.loop = LoopPingPong;
  hologramActions.set("t-idle", tIdle);
  tIdle.weight = 0;
  tIdle.play();

  //left-desktop
  const leftDesktop = hologramMixer.clipAction(getActionFromMesh("left-desktop"));
  leftDesktop.repetitions = 1;
  leftDesktop.clampWhenFinished = true;
  hologramActions.set("left-desktop", leftDesktop);
  leftDesktop.weight = 0;

  //wave
  const wave = hologramMixer.clipAction(getActionFromMesh("wave"));
  wave.clampWhenFinished = true;
  wave.loop = LoopOnce;
  hologramActions.set("wave", wave);
};

const play = (name: string, transition: number = 0.5) => {
  if (activeAction === name) return;
  const newAction = actions.get(name);
  const newHologramAction = hologramActions.get(name);
  if (!newAction || !newHologramAction) throw new Error("[AvatarAnimations] Action not found");

  newAction.reset().play();
  newHologramAction.reset().play();

  if (activeAction) {
    const currentAction = actions.get(activeAction);
    if (currentAction) currentAction.crossFadeTo(newAction, transition);

    const currentHologramAction = hologramActions.get(activeAction);
    if (currentHologramAction) currentHologramAction.crossFadeTo(newHologramAction, transition);
  }

  activeAction = name;
};

const setWeight = (key: string, weight: number) => {
  const action = actions.get(key);
  if (action) action.weight = weight;
  const hologramAction = hologramActions.get(key);
  if (hologramAction) hologramAction.weight = weight;
};

const updateIntro = () => {
  setWeight("desktop-idle", (1 - avatar.tIdleIntensity.value) * (1 - wavingStrength.value));
  setWeight("left-desktop", (1 - avatar.tIdleIntensity.value) * (1 - wavingStrength.value));
  setWeight("t-idle", avatar.tIdleIntensity.value);
  setWeight("sleeping", 0);
  setWeight("contact-idle", 0);
  setWeight("wake-up", 0);
  setWeight("wave", wavingStrength.value * (1 - avatar.tIdleIntensity.value));
};

const wave = () => {
  //get wave duration from action
  const waveAction = actions.get("wave");
  const hologramWaveAction = hologramActions.get("wave");
  if (!waveAction) return;
  const tl = gsap.timeline();

  const waveDuration = waveAction.getClip().duration;
  waveAction.play();
  hologramWaveAction?.play();

  tl.add(face.wave());
  tl.fromTo(wavingStrength, { value: 1 }, { value: 0 }, waveDuration - 0.2);

  return tl;
};

const wakeUp = () => {
  if (isAwake) return;
  isAwake = true;
  const sleepingAction = actions.get("sleeping");
  const wakeUpAction = actions.get("wake-up");
  const contactIdleAction = actions.get("contact-idle");
  if (!sleepingAction || !wakeUpAction || !contactIdleAction) return;

  stopSnoreRepetition();
  playSound("gasp");

  //crossfade to wake-up
  sleepingAction.crossFadeTo(wakeUpAction, 0.2);
  wakeUpAction.play();

  const wakeUpDuration = wakeUpAction.getClip().duration;

  setTimeout(() => {
    //crossfade to contact-idle
    wakeUpAction.crossFadeTo(contactIdleAction, 0.5);
    contactIdleAction.play();
  }, wakeUpDuration * 1000);

  face.wakeUp();
  sleepingSprite.hide();
};

const updateContact = () => {
  setWeight("desktop-idle", 0);
  setWeight("left-desktop", 0);
  setWeight("t-idle", 0);
  setWeight("sleeping", 1);
  setWeight("contact-idle", 1);
  setWeight("wake-up", 1);
  setWeight("wave", 0);
};

const update = () => {
  const isContact = sceneWeights.contact > 0.001;
  if (isContact) {
    updateContact();
  } else {
    updateIntro();
  }

  const delta = gsap.ticker.deltaRatio(60);
  mixer.update(delta / 60);
  hologramMixer.update(delta / 60);
};

export const animations = { init, play, actions, update, wakeUp, getIsAwake: () => isAwake, wave };
```

### Action table (setup state)

**Primary mixer** — `mixer = new AnimationMixer(avatar.getMesh())`, i.e. rooted at the cloned `armature` Group.

| map key | clip | `loop` | `repetitions` | `clampWhenFinished` | `weight` set at setup | `.play()` at setup? |
|---|---|---|---|---|---|---|
| `desktop-idle` | `idle` (3.375 s) | `LoopPingPong` | default (`Infinity`) | default `false` | `1` | **no** — played by `play("desktop-idle")` in `init()` → `.reset().play()` |
| `t-idle` | `t-idle` (1.6666666666666667 s) | `LoopPingPong` | default | default | `0` | **yes** |
| `left-desktop` | `left-desktop` (4.791666666666667 s) | **not set → `LoopRepeat`** | `1` | `true` | `0` | **no** |
| `sleeping` | `sleeping` (2.0833333333333335 s) | `LoopPingPong` | default | default | `1` | **yes** |
| `wake-up` | `wake-up` (0.8333333333333334 s) | **not set → `LoopRepeat`** | `1` | `true` | **never set → default `1`** | **no** |
| `contact-idle` | `contact-idle` (2.0833333333333335 s) | `LoopPingPong` | default | default | **never set → default `1`** | **no** |
| `wave` | `wave` (2.7083333333333335 s) | `LoopOnce` | default | `true` | **never set → default `1`** | **no** — `waveAction.play()` inside `wave()` |

**Hologram mixer** — `hologramMixer = new AnimationMixer(avatarHologram.getMesh())`.

| map key | clip | `loop` | `repetitions` | `clampWhenFinished` | `weight` at setup | `.play()` at setup? |
|---|---|---|---|---|---|---|
| `desktop-idle` | `idle` | `LoopPingPong` | default | default | `1` | **yes** |
| `t-idle` | `t-idle` | `LoopPingPong` | default | default | `0` | **yes** |
| `left-desktop` | `left-desktop` | `LoopRepeat` (unset) | `1` | `true` | `0` | **no** |
| `wave` | `wave` | `LoopOnce` | default | `true` | **default `1`** | **no** — played by `wave()` |

The hologram map deliberately has **no** `sleeping` / `wake-up` / `contact-idle` keys. Consequences: `setWeight("sleeping"|"contact-idle"|"wake-up", …)` only affects the primary mixer (`hologramAction` is `undefined` → skipped), and `play()` can only ever be called with `desktop-idle`, `t-idle`, `left-desktop`, `wave` (it `throw`s otherwise, because it demands both maps have the key).

### `init()` order

`objects.init()` (`src/three/objects/index.ts`) calls `avatarHologram.init()` **before** `avatar.init()`. `avatar.init()` then does:

```ts
const init = () => {
  setupMesh();
  animations.init();
  face.init();
  avatarLeftDesktop.init();
  gsap.ticker.add(tick);
};
```

`animations.init()` → create both mixers → `setupActions()` → `setupHologramActions()` → `play("desktop-idle")` → `wave()`.

**Porting hazard:** `animations.init()` unconditionally dereferences `avatarHologram.getMesh()`. If the hologram is omitted, `new AnimationMixer(null)` does not throw immediately but `clipAction(...)` will fail when `PropertyBinding` searches the root — and `play()` will `throw new Error("[AvatarAnimations] Action not found")` because `hologramActions` is empty. A port that wants to drop the hologram must stub the hologram mixer/actions, not merely skip `avatarHologram.init()`.

### Important three.js r181 semantics

In three r181, `AnimationAction`'s weight setter is:

```js
set weight( weight ) {
    this._weight = weight;
    this._effectiveWeight = this.enabled ? weight : 0;
    return this.stopFading();
}
```

`updateIntro()` / `updateContact()` write `.weight` for **every** key **every frame**, so `stopFading()` is called each frame and the `crossFadeTo()` fades issued inside `play()` are cancelled on the very next tick. In practice the `transition` argument (`0.5` default, `0.3` used by `left-desktop`) is effectively a no-op beyond the frame it is called in — the crossfade you actually see comes from the manually animated weights (`tIdleIntensity`, `wavingStrength`). `wakeUp()`'s crossfades **do** survive, because `updateContact()` sets all three of `sleeping`, `wake-up`, `contact-idle` to weight `1` (so those are hard cuts rather than fades). Reproduce this exactly if you want identical motion.

`update()` timing: `gsap.ticker.deltaRatio(60)` returns ≈1.0 at 60 fps, so `mixer.update(delta / 60)` advances ≈1/60 s per frame — frame-rate independent.

---

## 3. The three driving formulas

### `tIdleIntensity`

* Declared in `src/three/objects/avatar/index.ts:22`: `const tIdleIntensity = { value: 0 };` and exported on the `avatar` object.
* Animated **only** in `src/animations/transitions/about.ts`, inside `setupInAnimation`'s `createMatchMedia` callback (line 86):
  ```ts
  tl.fromTo(avatar.tIdleIntensity, { value: 0 }, { value: 1, duration: 0.75, ease: "power1.out" }, 0);
  ```
  i.e. **0 → 1, over 0.75 of the timeline's normalised duration, `power1.out`, starting at position 0**, on a `duration: 1`, `scrub: true` timeline whose ScrollTrigger is
  `trigger: about`, `start: isMobile ? "top bottom" : "-=200px bottom"`, `end: "top top"`.
  It is scrubbed, so it tracks scroll progress and never runs on a clock.
* Consumed in `updateIntro()`:
  * `t-idle` weight `= tIdleIntensity`
  * `desktop-idle` weight `= (1 - tIdleIntensity) * (1 - wavingStrength)`
  * `left-desktop` weight `= (1 - tIdleIntensity) * (1 - wavingStrength)`
  * `wave` weight `= wavingStrength * (1 - tIdleIntensity)`

### `leftDesktop` "intensity"

There is no scalar named `leftDesktop` intensity. Playback is governed by two places:

**(a) Continuous weight**, recomputed every frame in `updateIntro()`:
```ts
setWeight("left-desktop", (1 - avatar.tIdleIntensity.value) * (1 - wavingStrength.value));
```
and forced to `0` in `updateContact()`.

**(b) Trigger cadence** — `src/three/objects/avatar/left-desktop.ts`:
```ts
const INTERVAL_DURATION = 7;
...
const clip = leftDesktop.getClip();

const calcDelay = () => {
  return Math.floor(INTERVAL_DURATION + Math.random() * 6 + clip.duration);
};

const playAnimation = () => {
  const delay = calcDelay();
  gsap.delayedCall(delay, playAnimation);

  if (sceneWeights.hero < 0.95 || !sizes.visible) return;

  const tl = gsap.timeline({
    duration: clip.duration + 0.2,
    onComplete: () => {
      avatarAnimations.play("desktop-idle", 0.3);
      isActive.value = false;
    },
  });

  isActive.value = true;

  tl.add(() => {
    avatarAnimations.play("left-desktop", 0.3);
  }, 0.2);

  if (currentId) {
    sprites.room.howl.stop(currentId);
    currentId = undefined;
  }

  tl.add(() => {
    currentId = playSound("keyboard");
  }, 1.6);

  desktops.showMessage();
  messagePopup.show();
};
```
Exact numbers: `clip.duration = 4.791666666666667`, so
`delay = Math.floor(7 + Math.random()*6 + 4.791666666666667)` = `Math.floor(11.791666666666667 + U*6)` ∈ **{11, 12, …, 17} seconds**, rescheduled **before** the guard check (so the loop continues even when it bails). Timeline `duration = clip.duration + 0.2 = 4.991666666666667 s`; `play("left-desktop", 0.3)` fires at `t = 0.2`; the `"keyboard"` sound fires at `t = 1.6`; `onComplete` calls `play("desktop-idle", 0.3)`.
Guards: skip if `sceneWeights.hero < 0.95` (i.e. not in the hero) or `!sizes.visible` (tab hidden).
`init()` also registers `sizes.on("show", handleWindowVisible)`, which stops the looping `"keyboard"` howl id when the tab becomes visible again.
Side effects when it fires: `desktops.showMessage()` and `messagePopup.show()`.

### The wave

* `const wavingStrength = { value: isFeatureEnabled("introWave") ? 1 : 0 };` in `animations.ts:19`. `features.introWave = true` (`src/utils/features.ts`), so **initial value is `1`**.
* `wave()` is called once, at the end of `animations.init()` (line 32), and is also exported (`animations.wave`). `src/animations/intro.ts` has its call commented out (`//avatarAnimations.wave();`), so **`animations.init()` is the only caller**.
* Body:
  ```ts
  const waveDuration = waveAction.getClip().duration;   // 2.7083333333333335
  waveAction.play();
  hologramWaveAction?.play();

  tl.add(face.wave());
  tl.fromTo(wavingStrength, { value: 1 }, { value: 0 }, waveDuration - 0.2);
  ```
* **Critical detail:** the 4th argument of `tl.fromTo(target, fromVars, toVars, position)` is the timeline **position**, not a duration. So this is `fromTo(wavingStrength, {value:1}, {value:0}, position = 2.7083333333333335 - 0.2 = 2.5083333333333335)` with GSAP's **default duration `0.5`**. `fromTo` also has `immediateRender: true`, so at timeline start `wavingStrength.value` is snapped to `1` and held, then tweens `1 → 0` from `t = 2.5083333333333335` to `t = 3.0083333333333333`.
  (If a porter "fixes" this to a duration of 2.508 s the wave weight will fade far too early and the whole intro will read differently.)
* Wave weight each frame: `wavingStrength * (1 - tIdleIntensity)`.
* `tl.add(face.wave())` inserts the face timeline at the end of the (still empty) timeline, i.e. position 0. `face.wave()` = `set(sceneFrames, { intro: "proud-0" }, 0)` then `set(sceneFrames, { intro: "default-0" }, 3)` with `RESET_AFTER = 3`. So the showing-off face (`proud-*`) is held for **3 s**, slightly past the total wave timeline (3.0083333333333333 s).

---

## 4. Per-frame `tick()` for the avatar

`src/three/objects/avatar/index.ts`, module state:

```ts
let mesh: Mesh | null = null;
let rightHandBone: Bone | null = null;

const tIdleIntensity = { value: 0 };

const waypointsPosition = new Vector3();
const waypointsRotation = new Euler();
const transform = new Group();
const uniforms = { uProgress: { value: 0 }, uAmbientStrength: { value: 0 } };
const contactPosition = new Vector3(0, -13, 0);
const contactRotation = new Euler(0, -Math.PI, 0);
```

The tick, verbatim:

```ts
const tick = () => {
  animations.update();

  const isContact = sceneWeights.contact > 0.001;

  if (isContact) {
    transform.position.copy(contactPosition);
    transform.rotation.copy(contactRotation);
    uniforms.uProgress.value = 0;
    uniforms.uAmbientStrength.value = 0;
    transform.visible = true;
    return;
  }

  transform.position.copy(waypointsPosition);
  transform.rotation.copy(waypointsRotation);

  //uniforms.uProgress.value = sceneWeightsInOut.about.in * 1.1 - 0.1;
  uniforms.uProgress.value = aboutProgress.value * 1.1 - 0.1;
  uniforms.uAmbientStrength.value = sceneWeightsInOut.about.in;

  if (!mesh) return;
  if (uniforms.uProgress.value > 0.999 && sceneWeights.contact > 0.99) {
    mesh.visible = false;
  } else {
    mesh.visible = true;
  }
};
```

Resolved semantics:

* `transform.position := waypointsPosition` (a `Vector3`, copied, not assigned) and `transform.rotation := waypointsRotation` (an `Euler`, order `XYZ`, copied). Both are **animated by GSAP** in `src/animations/transitions/about.ts`; nothing else in the repo writes them (verified by grep). Initial values: `(0, 0, 0)` and `Euler(0, 0, 0)`.
  * Landscape, `setupInAnimation`: `waypointsPosition` `(2,0,0) → (0,0,6)`, duration 1, ease `power1.out`; `waypointsRotation` `(0, -2.3 + Math.PI/2, 0) → (0, -Math.PI, 0)`, duration 1, ease `power1.out`. Same timeline also moves `room.group` and `lab.group`.
  * Portrait: `waypointsPosition` `(0,0,0) → (0,0,6)`; `waypointsRotation` `(0, -2.1 + Math.PI/2, 0) → (0, -Math.PI, 0)`.
  * `setupScenesAnimation` (the About scroll, `start: "top top"`, `end: "bottom bottom"`, `scrub`, `duration: 1`): `tl.to(waypointsRotation, { x: 0, y: -Math.PI, z: 0, duration: (1 - 0*2) * 0.95, ease: "power1.inOut" }, 0)` — so it also *pins* rotation to `y = -π` over 0.95 of the About scroll.
* `uniforms.uProgress.value = aboutProgress.value * 1.1 - 0.1`, where `aboutProgress` is `export const aboutProgress = { value: 0 }` in `src/animations/transitions/about.ts`, driven by `setupProgressAnimation`:
  ```ts
  const tl = gsap.timeline({
    duration: 1,
    scrollTrigger: {
      trigger: about,
      start: isLandscape ? "top bottom" : "top 75%",
      end: "bottom bottom",
      scrub: true,
    },
  });
  const completed = { value: false };
  tl.to(completed, { value: true, duration: 0 }, 1);

  tl.fromTo(aboutProgress, { value: 0 }, { value: 1, duration: 0.95, ease: "none" }, 0);
  ```
  So `aboutProgress` goes `0 → 1` over the first 95 % of the About section scroll, linearly, and `uProgress ∈ [-0.1, 1.0]`.
* `uniforms.uAmbientStrength.value = sceneWeightsInOut.about.in` — **the raw `in` channel, not the clamped product** `sceneWeights.about`. `sceneWeightsInOut.about.in` is tweened `0 → 1` over the About in-animation (`about.ts:88`, `ease: "none"`, `duration: 1`) and is only ever driven forward (there is no `out` write to `about.in`), so it is monotonic 0→1 and can exceed the clamped `sceneWeights.about` during the About→Projects overlap. `src/animations/scenes.ts` derives `sceneWeights` separately:
  ```ts
  sceneWeights[key] = Math.max(0, Math.min(1, inOut.in * (1 - inOut.out)));
  ```
  computed in a `gsap.ticker` callback owned by `scenes.init()`.
* Contact branch: position `(0, -13, 0)`, rotation `Euler(0, -π, 0)`, both `uProgress` and `uAmbientStrength` zeroed, `transform.visible = true`, early `return` (so `mesh.visible` is not touched that frame).
* **Dead branch:** `mesh.visible = false` requires `uniforms.uProgress.value > 0.999 && sceneWeights.contact > 0.99`. `sceneWeights.contact > 0.99` implies `sceneWeights.contact > 0.001`, so the early `return` above always fires first. The avatar model is therefore **never actually hidden**; it is instead teleported to `(0,-13,0)` and rotated 180° behind the contact scene. Port it as-is for fidelity.
* Ticker registration order (matters slightly): `objects.init()` → `avatarHologram.init()` adds hologram `tick` **first**; `avatar.init()` adds `face.tick` (inside `face.init()`) then `avatar.tick`. GSAP runs callbacks in insertion order, so per frame: hologram tick → face tick → avatar tick (which calls `animations.update()`). The face therefore reads `uProgress`/`uAmbientStrength` written on the *previous* frame, and animations' mixer update happens after the face frame is chosen. Sub-frame ordering only; harmless, but reproduce it if you are diffing pixel output.
* `destroy()` only does `face.destroy()` and removes `tick`. `mesh` is never nulled (the nulling lines are commented out), so a second `init()` short-circuits `setupMesh()` (`if (mesh) return;`).

Uniform consumers: `uProgress` is read by the avatar-progress include in all four avatar shaders; `uAmbientStrength` is read by `about-ambient.glsl`, which is included only by **avatar-head** and **avatar-matcap** (not by avatar-face, not by hologram).

---

## 5. Exact shader source

### `src/three/shaders/includes/avatar-progress/vertex.glsl`

```glsl
varying float vModelProgress;

float getModelProgress(vec3 position) {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    float modelProgress = (worldPosition.y + 0.2) / 4.7;
    return modelProgress;
}
```

### `src/three/shaders/includes/avatar-progress/fragment.glsl`

```glsl
varying float vModelProgress;

uniform float uProgress;

#define SMOOTH_WIDTH 0.002

float getProgress() {
    float s = smoothstep(uProgress, uProgress + SMOOTH_WIDTH, vModelProgress);
    // If uProgress == 0.0, return 1.0, otherwise use s
    return mix(s, 1.0, step(uProgress, 0.0));
}
```

### `src/three/shaders/includes/about-ambient.glsl`

```glsl
uniform float uAmbientStrength;

#define AMBIENT_COLOR vec3(0.,0.016,0.063)

vec3 applyAmbient(vec3 color) {
    return color + AMBIENT_COLOR * uAmbientStrength;
}
```

### `src/three/shaders/avatar-matcap/vertex.glsl`

```glsl
#include <skinning_pars_vertex>
#include ../includes/avatar-progress/vertex.glsl;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>

    #include <project_vertex>

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);

    vec4 skinnedNormal = vec4(0.0);
    skinnedNormal += boneMatX * vec4(normal, 0.0) * skinWeight.x;
    skinnedNormal += boneMatY * vec4(normal, 0.0) * skinWeight.y;
    skinnedNormal += boneMatZ * vec4(normal, 0.0) * skinWeight.z;
    skinnedNormal += boneMatW * vec4(normal, 0.0) * skinWeight.w;

    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    vNormal = skinnedNormal.xyz;

    vModelProgress = getModelProgress(transformed);
}
```

### `src/three/shaders/avatar-matcap/fragment.glsl`

```glsl
#include ../includes/avatar-progress/fragment.glsl;
#include ../includes/about-ambient.glsl;

uniform sampler2D uMatcap;

varying vec3 vViewNormal;
varying vec3 vViewPosition;
varying vec3 vNormal;

void main() {
    vec3 viewDir = normalize(vViewPosition);

    vec3 x = normalize(vec3(viewDir.z, 0.0, -viewDir.x));
    vec3 y = cross(viewDir, x);
    vec2 uv = vec2(dot(x, vNormal), dot(y, vNormal)) * 0.495 + 0.5;

    vec3 matcapColor = texture2D(uMatcap, uv).rgb;

    float progress = getProgress();

    matcapColor = applyAmbient(matcapColor);

    gl_FragColor = vec4(matcapColor, progress);
}
```

> Latent bug to preserve or clean consciously: the fragment declares `varying vec3 vViewNormal;`, but the vertex shader never writes it (it writes `vNormal` and `vViewPosition`). It is unreferenced in `main()`. A GLSL linker may warn or optimise it away. Also note `worldPosition` is computed in the vertex shader and never used — the ambient term in the fragment is uniform-only.

### `src/three/shaders/avatar-head/vertex.glsl`

```glsl
#include <skinning_pars_vertex>
#include ../includes/avatar-progress/vertex.glsl;

varying vec2 vUv;

void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>

    #include <project_vertex>

    vModelProgress = getModelProgress(transformed);
    vUv = uv;
}
```

### `src/three/shaders/avatar-head/fragment.glsl`

```glsl
#include ../includes/avatar-progress/fragment.glsl;
#include ../includes/about-ambient.glsl;

uniform sampler2D uHeadTexture;
uniform vec2 uHeadTextureSize;

varying vec2 vUv;

void main() {
    vec4 tex = texture2D(uHeadTexture, vUv);

    float progress = getProgress();

    gl_FragColor = vec4(applyAmbient(tex.rgb), progress);
}
```

> `uHeadTextureSize` is declared but **never supplied** by the material (`uniforms: { uHeadTexture, ...uniforms }` only) and never used — it defaults to `(0, 0)`. Also note the head output **ignores `tex.a`** and writes `progress` as alpha, so it is fully opaque until the About progress clip bites.

### `src/three/shaders/avatar-face/vertex.glsl`

```glsl
#include <skinning_pars_vertex>
#include ../includes/avatar-progress/vertex.glsl;

varying vec2 vUv;

void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>

    #include <project_vertex>

    vModelProgress = getModelProgress(transformed);
    vUv = uv;
}
```

### `src/three/shaders/avatar-face/fragment.glsl`

```glsl
#include ../includes/avatar-progress/fragment.glsl;

varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uFrame;

#define ROWS 4.
#define COLUMNS 4.

void main() {
  // Calculate tile position
  float column = mod(uFrame, COLUMNS);
  float row = floor(uFrame / COLUMNS);

  // Flip Y because texture atlases often start from top-left
  row = (ROWS - 1.0) - row;

  // Scale UVs to a single tile
  vec2 uv = vUv;
  uv.x = (uv.x + column) / COLUMNS;
  uv.y = (uv.y + row) / ROWS;

  vec4 textureColor = texture2D(uTexture, uv);

  float progress = getProgress();

  gl_FragColor = vec4(textureColor.rgb, progress * textureColor.a);
}
```

### `src/three/shaders/hologram/vertex.glsl`

```glsl
#include <skinning_pars_vertex>
#include ../includes/avatar-progress/vertex.glsl;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vPosition;

uniform float uTime;
uniform float uProgress;

float random2D(vec2 value) {
    return fract(sin(dot(value.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>

    #include <project_vertex>

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);

    // Normal skinning
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
```

> `random2D` is defined and unused; `vPosition` is declared in both stages and never read; the hologram vertex shader declares `uniform float uProgress;` and also gets the include (which reads `uProgress` in the fragment only) — do not add a second `uProgress` declaration in the fragment (it comes from the fragment include).

### `src/three/shaders/hologram/fragment.glsl`

```glsl
#include ../includes/avatar-progress/fragment.glsl;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vPosition;

uniform vec3 uColor;
uniform float uTime;

#define LINE_WIDTH 0.003
#define FADE_WIDTH 0.02

void main() {
    vec3 normal = normalize(vNormal);

    if(!gl_FrontFacing)
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

    if(!gl_FrontFacing)
        holographic *= 0.4;

    gl_FragColor = vec4(uColor, min(holographic * progress, 1.0));
}
```

Shader include resolution is done by **`vite-plugin-glsl`** (`import ... from "...glsl"`); `#include ../includes/...` paths are relative to the including file. In a Next.js port use `raw-loader`/`glslify`/`next.config` `webpack` rule or inline the strings — the include graph is:

```
avatar-matcap/{vertex,fragment}.glsl → includes/avatar-progress/{vertex,fragment}.glsl, includes/about-ambient.glsl
avatar-head/{vertex,fragment}.glsl   → includes/avatar-progress/{vertex,fragment}.glsl, includes/about-ambient.glsl
avatar-face/{vertex,fragment}.glsl   → includes/avatar-progress/{vertex,fragment}.glsl
hologram/{vertex,fragment}.glsl      → includes/avatar-progress/{vertex,fragment}.glsl
```

Note the shared include files have **no include guards**, and each fragment includes `avatar-progress/fragment.glsl` exactly once, so no duplicate-declaration problems arise in the current graph.

---

## 6. The face system

Source: `src/three/objects/avatar/face.ts` (verbatim, complete):

```ts
import { LinearSRGBColorSpace, ShaderMaterial } from "three";
import { resources } from "../../../utils/resources";
import fragmentShader from "../../shaders/avatar-face/fragment.glsl";
import vertexShader from "../../shaders/avatar-face/vertex.glsl";
import { avatar } from "./index";
import gsap from "gsap";

import type { Material } from "three";
import { sceneWeights } from "../../../animations/scenes";

let material: Material | null = null;

const FRAME_INDEXES = {
  "default-0": 0,
  "default-1": 1,
  "default-2": 2,
  "default-3": 3,
  sleeping: 4,
  "proud-0": 12,
  "proud-1": 13,
  "proud-2": 14,
  "proud-3": 15,
  "contact-transition-0": 8,
  "contact-transition-1": 9,
  "contact-transition-2": 10,
} as const satisfies Record<string, number>;

const blinkFrame = { value: 0 };

const uniforms = { uFrame: { value: 0 } };

const sceneFrames: Record<"intro" | "contact", keyof typeof FRAME_INDEXES> = {
  intro: "default-0",
  contact: "sleeping",
};

const init = () => {
  gsap.ticker.add(tick);
  scheduleBlinkInterval();
};

const scheduleBlinkInterval = () => {
  gsap.delayedCall(3 + Math.random() * 3, () => {
    scheduleBlinkInterval();
    blink();
  });
};

const blink = () => {
  if (!canBlink()) return;
  const tl = gsap.timeline();
  tl.to(blinkFrame, { value: 3, duration: 0.12, ease: "power2.out" });
  tl.to(blinkFrame, { value: 0, duration: 0.2, ease: "power2.out" });
};

const getMaterial = (): Material | null => { /* see §1 */ };

const canBlink = (): boolean => {
  const isContact = sceneWeights.contact > 0.001;
  if (isContact) {
    if (sceneFrames.contact.startsWith("proud")) {
      return true;
    }
  } else {
    if (sceneFrames.intro.startsWith("default")) {
      return true;
    }
  }
  return false;
};

const wakeUp = () => {
  sceneFrames.contact = "proud-0";
  const tl = gsap.timeline();
  tl.set(sceneFrames, { contact: "contact-transition-0" }, 0);
  tl.set(sceneFrames, { contact: "contact-transition-1" }, 0.4);
  tl.set(sceneFrames, { contact: "contact-transition-2" }, 0.43);
  tl.set(sceneFrames, { contact: "proud-0" }, 0.46);
};

const wave = () => {
  const tl = gsap.timeline();

  const RESET_AFTER = 3;
  tl.set(sceneFrames, { intro: "proud-0" }, 0);
  tl.set(sceneFrames, { intro: "default-0" }, RESET_AFTER);

  return tl;
};

const tick = () => {
  const isContact = sceneWeights.contact > 0.001;
  if (isContact) {
    const name = sceneFrames.contact.startsWith("proud")
      ? `proud-${Math.round(blinkFrame.value)}`
      : sceneFrames.contact;
    uniforms.uFrame.value = FRAME_INDEXES[name as keyof typeof FRAME_INDEXES];
  } else {
    const isAbout = sceneWeights.about > 0.1;
    if (isAbout) {
      uniforms.uFrame.value = FRAME_INDEXES["default-0"];
    } else {
      const name = sceneFrames.intro.startsWith("default")
        ? `default-${Math.round(blinkFrame.value)}`
        : sceneFrames.intro;
      uniforms.uFrame.value = FRAME_INDEXES[name as keyof typeof FRAME_INDEXES];
    }
  }
};

const destroy = () => {
  gsap.ticker.remove(tick);
};

export const face = { init, destroy, getMaterial, FRAME_INDEXES, wakeUp, wave };
```

### Spritesheet + UV atlas maths

* `face-spritesheet.png` is **1024×1024 RGBA PNG**, a **4×4 grid of 16 tiles, each 256×256**. `uFrame` is a float `0…15`.
* Atlas maths in `avatar-face/fragment.glsl` (verbatim above):
  `column = mod(uFrame, 4.0)`, `row = floor(uFrame / 4.0)`, then `row = (4.0 - 1.0) - row` to convert the authored top-left origin to the flipped V axis, then `uv.x = (vUv.x + column) / 4.0`, `uv.y = (vUv.y + row) / 4.0`. `vUv` is the raw `TEXCOORD_0` of the `face` mesh (the UVs are authored in 0–1 tile space).
* `face-texture.flipY` is **left at the `TextureLoader` default `true`**, which is exactly why the explicit `row = 3 - row` flip is needed. `colorSpace = LinearSRGBColorSpace`, `generateMipmaps = false`.
* Alpha: `gl_FragColor = vec4(textureColor.rgb, progress * textureColor.a)`, with `progress = getProgress()` from the shared include. Material is `transparent: true, depthTest: false, depthWrite: false`, `renderOrder = 25` — the face draws last among avatar meshes, on top, with no depth interaction.

### Frame index map (verbatim)

```
"default-0": 0, "default-1": 1, "default-2": 2, "default-3": 3,
"sleeping": 4,
"proud-0": 12, "proud-1": 13, "proud-2": 14, "proud-3": 15,
"contact-transition-0": 8, "contact-transition-1": 9, "contact-transition-2": 10
```

Visual content of the atlas (inspected): row 0 (0–3) = eyes open → progressively blink → eyes closed, no mouth; index 4 (row 1, col 0) = closed eyes, "sleeping"; indices 5, 6, 7 and 11 are **blank tiles**; row 2 (8, 9, 10) = open eyes with a small mouth (the wake-up transition); row 3 (12–15) = "proud" face with a smile, where 14 is mid-blink and 15 is fully blinked.

### Blinking

* `blinkFrame = { value: 0 }`, tweened, drives the last digit of the frame name via `Math.round(blinkFrame.value)` → snaps to indices 0…3.
* `scheduleBlinkInterval()` is recursive and self-rescheduling: `gsap.delayedCall(3 + Math.random() * 3, callback)` at the start of `init()`, and the callback re-schedules **before** calling `blink()`. So blinks happen every **3.0–6.0 s**, uniformly randomised, forever, regardless of whether `blink()` actually did anything.
* `blink()` bails unless `canBlink()`; otherwise a timeline of `to(blinkFrame, {value: 3, duration: 0.12, ease: "power2.out"})` then `to(blinkFrame, {value: 0, duration: 0.2, ease: "power2.out"})` — a **0.32 s** close/open.
* `canBlink()`: contact scene → only when `sceneFrames.contact` starts with `"proud"`; intro scene → only when `sceneFrames.intro` starts with `"default"`. So blinking is suppressed while the wave's `"proud-0"` is held (first 3 s) and during `contact-transition-*`.
* Selection per frame (`tick`): contact & proud → `proud-${round(blinkFrame)}`; contact & not proud → the literal `sceneFrames.contact` (`sleeping` at first, then the transition names); non-contact & `sceneWeights.about > 0.1` → hard-forced `default-0` (no blinking during About); otherwise intro & default → `default-${round(blinkFrame)}`, else the literal `sceneFrames.intro` (`proud-0` during the wave).
* `wakeUp()` sets the contact face to `proud-0` and schedules the transition: `contact-transition-0 @ 0 s`, `contact-transition-1 @ 0.4 s`, `contact-transition-2 @ 0.43 s`, `proud-0 @ 0.46 s`.
* `wave()` schedules `intro: "proud-0" @ 0 s`, `intro: "default-0" @ 3 s` (`RESET_AFTER = 3`).

### Talking

**There is no talking system.** No mouth/talk timer, no audio-driven viseme, no phoneme frames. The frames that contain a mouth (8, 9, 10) are the contact wake-up transition and are used only by `wakeUp()`. If the port needs talking, it must be invented; nothing here to copy.

---

## 7. The hologram

* **What it is:** a second, independent copy of the character rendered with an additive, Fresnel + scanline + "reveal line" shader — a wireframe-free hologram body that appears during the About section. It is a `SkinnedMesh` built by merging the geometries of `["black", "gray", "skin", "white", "head", "brain"]` from the **original** (non-cloned) glTF scene, bound to a skeleton taken from a `cloneSkeleton`'d copy.
* **Parenting:** `scene.instance → avatar.transform → hologram.transform → hologram mesh`. In `hologram.ts`'s `setupMesh()`: `avatar.transform.add(transform); transform.add(mesh);`. `avatar.transform` is the same `Group` the main avatar lives in, so the hologram inherits all `waypointsPosition` / `waypointsRotation` motion and the contact teleport for free.
* **Init order:** `objects.init()` calls `avatarHologram.init()` **before** `avatar.init()`. That is safe because `avatar.transform` is created at module scope; `avatar.setupMesh()` later adds it to `scene.instance`.
* **Visible by default? NO.** `hologram.ts`'s tick ends with `mesh.visible = sceneWeights.about > 0.001;`. `sceneWeights.about` starts at `0`, so the hologram is hidden until the About section begins and hides again once `about.out` reaches 1. (Its parent `transform` is never hidden.)
* Render state: `renderOrder = 23` (behind all avatar meshes at 24/25), `frustumCulled = false`, material `transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide`, `uColor = new Color("rgb(0, 234, 255)")`.
* Its own tick:
  ```ts
  hologramUniforms.uTime.value = gsap.ticker.time;
  hologramUniforms.uProgress.value = aboutProgress.value * 1.1 - 0.1;
  ```
  Note `uTime` is the absolute `gsap.ticker.time` (seconds since ticker start), and `uProgress` uses the **same formula and the same `aboutProgress` source** as the main avatar but through a **different uniform object**.
* Setup details / quirks worth preserving or deliberately fixing:
  ```ts
  const GEOMETRY_NAMES: string[] = ["black", "gray", "skin", "white", "head", "brain"];
  ...
  geometry = mergeGeometries(geometries);
  geometry.toNonIndexed();          // ← return value discarded: no-op, geometry stays indexed
  ...
  geometry.setAttribute("center", new BufferAttribute(centers, 3));   // ← never read by any hologram shader
  ```
  The `center` attribute cycles `(1,0,0)`, `(0,1,0)`, `(0,0,1)` by `i % 3` and is **dead code** (the hologram vertex shader does not reference `center`). `toNonIndexed()`'s result is thrown away, so the merged geometry remains indexed — harmless because the shader only reads `position`/`normal`/`uv`/skin attributes. `"brain"` doesn't exist, so six geometries are merged from `black, gray, skin, white, head`.
  `setupSkeleton()` clones the source scene and reads `skeleton` off the `"black"` SkinnedMesh, then `mesh.bind(skeleton, new Matrix4())` and `mesh.add(skeleton.bones[0])` (= `hipsBone`). The hologram mixer is rooted at this SkinnedMesh and resolves bone names through that child chain.
* `avatar/index.ts` has `//import { avatarHologram } from "./hologram";` commented out; the live import is in `animations.ts` and `three/objects/index.ts`, which is the only reason the hologram runs at all.
* The hologram is **not** the same thing as `lab/plane.ts`, which reuses `hologramUniforms` only to read `uProgress`.

---

## 8. Transform fix-ups on the loaded model

`src/three/objects/avatar/index.ts`, `setupMesh()`:

```ts
const setupMesh = () => {
  if (mesh) return;
  const resource = resources.items["avatar-model"];
  mesh = cloneSkeleton(resource.scene.children[0]) as Mesh;

  mesh.frustumCulled = false;

  mesh.traverse((child) => { /* materials, frustumCulled=false, renderOrder, onBeforeRender */ });

  const brain = mesh.getObjectByName("brain") as Mesh;
  if (brain) {
    mesh.remove(brain);
  }

  mesh.rotation.z = 0;

  transform.add(mesh);

  rightHandBone = mesh.getObjectByName("bone-right-hand") as Bone;

  scene.instance.add(transform);
};
```

The complete list of transform/structural fix-ups:

1. **`mesh.rotation.z = 0`** — `index.ts:123`, applied to the cloned root (`resource.scene.children[0]` = the `armature` Group). This is not cosmetic; it is a real orientation change. The GLB's `armature` node has quaternion `(x=0.5, y=0.5, z=-0.5000000596046448, w=0.4999999403953552)`, which three.js decodes into `rotation` (Euler `XYZ`) as approximately **`(1.570796327, -0.000000119, -1.570796446)` rad = `(90.000000°, -0.000007°, -90.000007°)`**. Zeroing `.z` re-derives the quaternion from `(π/2, ≈0, 0)`, i.e. **`(x=0.70710678, y≈-4.2e-8, z≈-4.2e-8, w=0.70710678)` = a pure +90° rotation about X**. So the ported model's root must end up as `rotation = (π/2, 0, 0)`, `scale = (1.0384337902069092, 1.0384337902069092, 1.0384337902069092)`, `position = (0.00009566172957420349, 0.000004385568900033832, 0.00018998980522155762)` (position and scale are untouched by the code).
   Note the assignment order in three.js matters: `.rotation` is an `Euler` kept in sync with `.quaternion` via change callbacks, so writing `euler.z = 0` does update the quaternion — but only because `rotation.copy()`/quaternion round-tripping happened at load. If your port's loader does not populate `.rotation` from the quaternion (e.g. you set `quaternion` directly afterwards), replicate the effect explicitly by setting `quaternion.setFromEuler(new Euler(Math.PI/2, 0, 0))`.
2. **`brain` removal** — `mesh.remove(brain)`. No-op on this GLB (no `brain` node exists), kept as defensive code.
3. **`mesh.frustumCulled = false`** on the cloned root.
4. **`child.frustumCulled = false`** on every `Mesh` descendant (all six renderables).
5. **`child.renderOrder = child.name === "face" ? 25 : 24`** on every mesh descendant.
6. **`child.material = getMaterial(child.name)`** — full override of the loader's default material.
7. **`child.onBeforeRender`** installed for the four matcap meshes, swapping `uMatcap` per draw.
8. **`rightHandBone = mesh.getObjectByName("bone-right-hand")`** — the GLB node 8, joint index 15. Consumed by `src/three/objects/room/mouse.ts` (`avatar.getRightHandBone()` → `bone.getWorldPosition(...)` → `room.group.worldToLocal(...)` → bounds checks with `Y_BOUND` / `BOUNDS`; `mesh.position.y` and `.z -= 0.15` are then overwritten/offset).
9. **`scene.instance.add(transform)`** — the avatar is added as a single child `Group` (`transform`); its own position/rotation are overwritten from `waypointsPosition`/`waypointsRotation` every frame (or the contact constants).
10. **Hologram-side fix-ups** (`hologram.ts:76-81`): `mesh.rotation.copy(resource.scene.children[0].rotation)`, `mesh.scale.copy(resource.scene.children[0].scale)`, then `mesh.rotation.z = 0` (the same snap as above, applied to a fresh `SkinnedMesh` that is *not* a descendant of the armature clone), `mesh.frustumCulled = false`, `mesh.renderOrder = 23`. Note it copies rotation and scale but **not** position, and the position of the hologram mesh is left at `(0,0,0)` inside `hologram.transform`.
11. No `position`/`scale` fix-ups, no `up`-axis conversion, no `matrixAutoUpdate` changes, no bind-matrix rewriting anywhere.

---

## 9. Porting checklist / gotchas

1. Six meshes only; no `brain`; no materials/textures baked into the GLB — all materials are code-constructed.
2. Per-mesh materials, shared `uProgress` + `uAmbientStrength` objects; `onBeforeRender` is load-bearing for `gray`/`skin`/`white`.
3. `face` gets `renderOrder 25`, `depthTest/depthWrite false`; everything else avatar is `24`; hologram is `23`.
4. `head` texture must be `flipY = false`; the face texture must stay `flipY = true` (the shader compensates). All avatar textures `LinearSRGBColorSpace`; renderer must keep default `SRGBColorSpace` output and `NoToneMapping`.
5. Animation clip names are exactly `idle`, `t-idle`, `left-desktop`, `sleeping`, `wake-up`, `contact-idle`, `wave`; both mixers must exist even if the hologram is dropped, and `play()` requires the key to exist in **both** maps.
6. Weights are rewritten every frame, which cancels `crossFadeTo` fades in three r181.
7. `wave()`'s `tl.fromTo(..., waveDuration - 0.2)` is a **position**, not a duration — the fade is 0.5 s long starting at 2.5083333333333335 s.
8. `uProgress = aboutProgress.value * 1.1 - 0.1`; `uAmbientStrength = sceneWeightsInOut.about.in` (raw `in`, not the clamped `sceneWeights.about`).
9. `mesh.visible = false` in the avatar tick is unreachable; contact works by teleporting to `(0, -13, 0)` with `rotation.y = -π`.
10. `mesh.rotation.z = 0` converts the armature from `(90°, 0, -90°)` to a pure `+90°` about X.
11. Blink interval is `3 + Math.random()*3` seconds, blinks are 0.32 s long, and there is no talking system at all.
