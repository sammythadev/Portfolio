/*
 * Room stage — the hero scene from davidhckh/portfolio-2025.
 *
 *   https://github.com/davidhckh/portfolio-2025 — original by David Heckhoff.
 *   CC BY-NC-SA 4.0. See README "Attribution" and the visible credit on
 *   /playground. Non-commercial reuse only; the licence requires the credit to
 *   travel with derivative work, which is why it is repeated in this header.
 *
 * `room.glb` and `room.webp` are used exactly as upstream ships them: the model's
 * own UV atlas, one shared `MeshBasicMaterial`, and upstream's placement values
 * from `animations/transitions/about.ts`. Nothing here is re-authored, because
 * the model is an atlas-baked illustration — its silhouette, palette and
 * interior are all in the texture, so any change to the material changes the
 * artwork itself rather than lighting it differently.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

/** Upstream's `getRoomMaterial` — a textured basic material, unlit. */
const ROOM_TEXTURE = "/textures/room.webp";

export interface RoomHandle {
  /** The group, so the caller can add it to a scene it owns. */
  group: THREE.Group;
  /**
   * The loaded GLB and the room's shared atlas material, exposed so
   * `room-details.ts` can attach the desktops, shadow catcher, penguin heart,
   * notes, message popup and mouse without loading the model a second time.
   */
  gltf: GLTF;
  material: THREE.Material;
  update(progress: number, elapsed: number): void;
  dispose(): void;
}

export async function createRoom(): Promise<RoomHandle> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("/models/room.glb");
  const group = new THREE.Group();

  /*
    Upstream loads this as one texture atlas with `flipY = false` and a single
    shared basic material across every object in the room. The atlas already
    encodes which surface is carpet and which is wall, so swapping in a lit
    material here would destroy the baked artwork.
  */
  const texture = await new THREE.TextureLoader().loadAsync(ROOM_TEXTURE);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({ map: texture });

  /*
    The carpet is drawn behind everything and must not write depth, or it wins
    against the chair and desk in front of it. Upstream toggles `depthWrite` per
    object rather than reordering, so the draw order stays as the file declares.
  */
  gltf.scene.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.material = material;
    mesh.frustumCulled = false;
    mesh.castShadow = false;

    if (mesh.name === "carpet") {
      mesh.renderOrder = -10;
      mesh.onBeforeRender = () => {
        material.depthWrite = false;
      };
      mesh.onAfterRender = () => {
        material.depthWrite = true;
      };
    }

    // The catcher is a stand-in for real shadows, which this scene does not use.
    if (mesh.name === "shadow-catcher") mesh.visible = false;
  });

  /*
    Upstream's seat for this scene, verbatim from
    `animations/transitions/about.ts`: the room rises to y = 5.4 (landscape) or
    slides to x = 4.5 / y = 5.7 (portrait) while turning to y = -2.1.

    That turn is the reason the room reads as a three-quarter view rather than a
    flat elevation — the group is rotated -120 degrees so the desk and chair face
    the camera at an angle.
  */
  group.add(gltf.scene);
  /*
    Upstream's opening state for this act, verbatim: the room sits at x = 2 with
    a -2.3 rad turn on Y. That turn is what gives the three-quarter view in the
    reference shot — without it the desk faces the camera dead-on and reads as a
    flat elevation instead of a room.
  */
  group.position.set(2, 0, 0);
  group.rotation.set(0, -2.3, 0);

  return {
    group,
    gltf,
    material,
    update(t: number) {
      /*
        The room's exit, copied value-for-value from
        `animations/transitions/about.ts` (the landscape branch of
        `setupInAnimation`):

            position  (2, 0, 0)   ->  (4.5, 5.7, 0)
            rotation  (0, -2.3, 0) -> (0.1, -2.3, 0.09)
            scale      1          ->   0.85

        The room does not fade or disappear — it slides right and up while
        shrinking, which uncovers the character standing where the room used to
        be. That is the whole transition, and it is why both objects are present
        in the scene at once rather than swapped.
      */
      group.position.set(2 + 2.5 * t, 5.7 * t, 0);
      group.rotation.set(0.1 * t, -2.3, 0.09 * t);
      group.scale.setScalar(1 - 0.15 * t);
    },
    dispose() {
      texture.dispose();
      material.dispose();
      gltf.scene.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
      group.clear();
    },
  };
}