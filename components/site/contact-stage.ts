/*
 * Contact scene — the footer environment from davidhckh/portfolio-2025.
 *
 *   https://github.com/davidhckh/portfolio-2025 — original by David Heckhoff.
 *   CC BY-NC-SA 4.0. See README "Attribution" and the visible credit on
 *   /playground. Commercial reuse of the original work is not permitted.
 *
 * Upstream's last act is a separate little scene: a textured base the character
 * sleeps on, a shadow catcher, and a stream of drifting "z" sprites rising from
 * his head. All three come from `objects/contact/`, and — like the room and the
 * lab — they live in the same three.js scene as the character rather than in
 * their own context.
 *
 * The scene only becomes visible once `sceneWeights.contact` clears zero, so it
 * can sit in the scene graph permanently at no cost while the earlier acts play.
 * The avatar is *teleported* to it rather than the scene moving: upstream sets
 * the avatar's transform to `(0, -13, 0)` with `rotation.y = -PI` when contact
 * begins, which is why that group's own seat is `(1, -13, 0)` — the two are
 * authored to meet there, far below the room.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

/* glsl */
const sleepingSpriteVertexShader = /* glsl */ `
attribute float aIndex;

varying vec2 vUv;
varying float vAlpha;

uniform sampler2D uTexture;
uniform float uTime;

#define TOTAL_COLS 4.
#define TOTAL_ROWS 4.
#define FRAME_X 1.
#define FRAME_Y 0.
#define SCALE 0.35
#define PI 3.14159

vec2 rotate2D(vec2 pos, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * pos.x - s * pos.y, s * pos.x + c * pos.y);
}

void main() {
    mat4 spriteViewMatrix = modelViewMatrix;

    float progress = fract(uTime * 0.2 + aIndex);

    float scale = SCALE * (1.0 - progress * 0.4);

    spriteViewMatrix[0][0] = 1.0 * scale;
    spriteViewMatrix[0][1] = 0.0;
    spriteViewMatrix[0][2] = 0.0;

    spriteViewMatrix[1][0] = 0.0;
    spriteViewMatrix[1][1] = 1.0 * scale;
    spriteViewMatrix[1][2] = 0.0;

    vec3 transformed = position;

    vec2 pos = position.xy;
    pos = rotate2D(pos, progress * PI * 0.4);
    transformed.xy = pos;

    transformed.x += progress * 3.5;
    transformed.y += progress * 4.5;

    gl_Position = projectionMatrix * spriteViewMatrix * vec4(transformed, 1.0);

    // Frame UVs
    vUv = uv;
    vUv.x = (uv.x + FRAME_X) / TOTAL_COLS;
    vUv.y = (uv.y + (TOTAL_ROWS - 1.0 - FRAME_Y)) / TOTAL_ROWS;

    // Alpha fade in/out
    float fadeIn = smoothstep(0.0, 0.3, progress);
    float fadeOut = smoothstep(1.0, 0.7, progress);
    vAlpha = fadeIn * fadeOut;
}
`;

/* glsl */
const sleepingSpriteFragmentShader = /* glsl */ `
varying vec2 vUv;
varying float vAlpha;

uniform sampler2D uTexture;
uniform float uOpacity;

void main() {
    vec4 textureColor = texture2D(uTexture, vUv);
    float alpha = vAlpha * textureColor.a * uOpacity;

    gl_FragColor = vec4(textureColor.rgb, alpha);
}
`;

/* glsl */
const shadowVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    vUv = uv;
}
`;

/* glsl */
const shadowFragmentShader = /* glsl */ `
varying vec2 vUv;

uniform sampler2D uTexture;
uniform vec3 uColorBackground;
uniform vec3 uColorShadow;

void main() {
    vec4 shadow = texture2D(uTexture, vUv);

    float intensity = shadow.r;

    vec3 color = mix(uColorShadow.rgb, uColorBackground.rgb, intensity);

    gl_FragColor = vec4(color, 1.);
}
`;

/** Upstream `contact/sleeping-sprite.ts`. */
const PLANE_COUNT = 3;

export interface ContactHandle {
  group: THREE.Group;
  /**
   * Upstream's contact ramp. `weight` is `sceneWeights.contact`; the scene hides
   * itself below 0.001 and the sprite stream's opacity is lerped toward
   * `opacityTarget`, which `hide()` clears — the avatar calls that on wake-up.
   */
  update(opts: { weight: number; elapsed: number }): void;
  /** Upstream `sleepingSprite.hide()`, called when the character wakes. */
  hide(): void;
  dispose(): void;
}

export async function createContact(): Promise<ContactHandle> {
  const loader = new GLTFLoader();
  const gltf: GLTF = await loader.loadAsync("/models/contact.glb");

  /*
    Upstream's seat for the whole scene, verbatim. The -13 in Y is not a layout
    choice: the avatar is teleported to `(0, -13, 0)` when contact begins, so the
    bed and its shadow are authored to meet it far below the room and the lab.
  */
  const group = new THREE.Group();
  group.position.set(1, -13, 0);
  group.rotation.set(0, -0.8, 0);

  const baseTexture = await new THREE.TextureLoader().loadAsync("/textures/contact.webp");
  baseTexture.flipY = false;
  baseTexture.colorSpace = THREE.SRGBColorSpace;
  const baseMaterial = new THREE.MeshBasicMaterial({ map: baseTexture });

  const base = gltf.scene.children.find((child) => child.name === "base");
  if (base) {
    const mesh = base as THREE.Mesh;
    mesh.material = baseMaterial;
    group.add(mesh);
  }

  /* ------------------------------------------------------------------ */
  /* Shadow catcher                                                      */
  /* ------------------------------------------------------------------ */

  const shadowTexture = await new THREE.TextureLoader().loadAsync("/textures/contact-shadow.webp");
  shadowTexture.flipY = false;

  /*
    Upstream's shadow colours. The background is the *dark* beige — the contact
    act swaps the renderer's clear colour to `colors.beigeDark`, which is what
    makes the footer read as a slightly warmer room than the hero.
  */
  const backgroundColor = new THREE.Color("rgb(233, 222, 208)").convertLinearToSRGB();
  const shadowColor = new THREE.Color("rgb(208, 185, 156)");

  const shadowMaterial = new THREE.ShaderMaterial({
    vertexShader: shadowVertexShader,
    fragmentShader: shadowFragmentShader,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTexture: { value: shadowTexture },
      uColorBackground: { value: backgroundColor },
      uColorShadow: { value: shadowColor },
    },
  });

  const shadowNode = gltf.scene.children.find((child) => child.name === "shadow-catcher");
  if (shadowNode) {
    const mesh = shadowNode as THREE.Mesh;
    mesh.material = shadowMaterial;
    mesh.renderOrder = -1000;
    group.add(mesh);
  }

  /* ------------------------------------------------------------------ */
  /* Sleeping sprites                                                    */
  /* ------------------------------------------------------------------ */

  const spritesheet = await new THREE.TextureLoader().loadAsync("/textures/icon-spritesheet.webp");
  spritesheet.colorSpace = THREE.LinearSRGBColorSpace;
  spritesheet.generateMipmaps = false;
  spritesheet.minFilter = THREE.LinearFilter;
  spritesheet.magFilter = THREE.LinearFilter;

  const spriteUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 1 },
  };

  /*
    Three separate 1x1 planes merged into one geometry, staggered by a per-vertex
    `aIndex` so the "z"s rise out of phase. Upstream uses `i / PLANE_COUNT`
    rather than `i / (PLANE_COUNT - 1)`, so the last sprite never reaches 1 and
    the three stay permanently offset instead of cycling together.
  */
  const spriteGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < PLANE_COUNT; i += 1) {
    const plane = new THREE.PlaneGeometry(1, 1);
    const indexValue = i / PLANE_COUNT;
    const vertexCount = plane.getAttribute("position").count;
    plane.setAttribute("aIndex", new THREE.BufferAttribute(new Float32Array(vertexCount).fill(indexValue), 1));
    spriteGeometries.push(plane);
  }

  const spriteGeometry = mergeGeometries(spriteGeometries, false)!;
  const spriteMaterial = new THREE.ShaderMaterial({
    vertexShader: sleepingSpriteVertexShader,
    fragmentShader: sleepingSpriteFragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    uniforms: {
      uTexture: { value: spritesheet },
      ...spriteUniforms,
    },
  });

  const spriteMesh = new THREE.Mesh(spriteGeometry, spriteMaterial);
  spriteMesh.renderOrder = -1;
  spriteMesh.position.set(-0.3, 3.5, 0);
  group.add(spriteMesh);

  let opacityTarget = 1;
  let meshVisible = false;

  return {
    group,
    update({ weight, elapsed }) {
      /*
        Upstream hides both pieces below a hair above zero rather than leaving
        them at zero alpha, which is what keeps an invisible footer scene from
        costing a draw call through the whole of the earlier acts.
      */
      const active = weight >= 0.001;
      if (group.visible !== active) group.visible = active;

      spriteMesh.visible = active && meshVisible;

      // The sprite clock only advances while the act is live; upstream's is fed
      // by the shared ticker and so advances always, but nothing samples it
      // until the scene is visible.
      spriteUniforms.uTime.value = elapsed;

      if (!active) return;

      /*
        Upstream's opacity lerp, expressed per second rather than per frame: a
        `deltaRatio(60)` step of 1 is one 60fps frame, and `speed * delta` with
        speed 0.1 is what it converges on.
      */
      spriteUniforms.uOpacity.value += (opacityTarget - spriteUniforms.uOpacity.value) * 0.1;

      meshVisible = spriteUniforms.uOpacity.value >= 0.01;
      spriteMesh.visible = meshVisible;
    },
    hide() {
      opacityTarget = 0;
    },
    dispose() {
      baseTexture.dispose();
      shadowTexture.dispose();
      spritesheet.dispose();
      baseMaterial.dispose();
      shadowMaterial.dispose();
      spriteMaterial.dispose();
      spriteGeometry.dispose();
      for (const geometry of spriteGeometries) geometry.dispose();
      group.clear();
    },
  };
}
