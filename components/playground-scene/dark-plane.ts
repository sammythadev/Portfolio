/*
 * Dark plane — ported verbatim from davidhckh/portfolio-2025
 * (`src/three/objects/dark-plane/index.ts` and its two shaders).
 *
 *   https://github.com/davidhckh/portfolio-2025 — original by David Heckhoff.
 *   CC BY-NC-SA 4.0. See README "Attribution" and the visible credit on
 *   /playground. Commercial reuse of the original work is not permitted.
 *
 * This object is the reason the reference composition reads the way it does, and
 * it is the easiest part of the whole scene to miss.
 *
 * The grid floor is never drawn into the visible scene. It — along with the lab
 * particles — is rendered into an offscreen `WebGLRenderTarget` whose clear
 * colour is a saturated blue. This plane is then a fullscreen quad over the main
 * scene that *samples that texture* and reveals it through a rounded-rectangle
 * SDF, darkened toward `uVignetteColor` at the edges. So the blue window behind
 * the room is a single textured quad.
 *
 * Drawing the floor straight into the main scene — which this port did at first —
 * cannot reproduce any of that: there is no window, no corner radius, no
 * vignette, and no blue.
 *
 * The rectangle also animates: it rises and widens as the about act begins,
 * which is what uncovers the character as the room slides away.
 */

import * as THREE from "three";

/* glsl */
const vertexShader = /* glsl */ `
uniform vec2 uRectCenter;
uniform float uAspectRatio;
uniform float uAngle;

varying vec2 vUv;
varying vec2 vRectUv;

vec2 rotate(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

void main()
{
    gl_Position = vec4(position.x, position.y, position.z, 1.0);

    vRectUv = uv - uRectCenter;
    vRectUv.x *= uAspectRatio;
    vRectUv = rotate(vRectUv, uAngle);

    vUv = uv;
}
`;

/* glsl */
const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec2 vRectUv;

uniform sampler2D uTexture;
uniform vec3 uVignetteColor;
uniform vec2 uRectSize;
uniform float uRadius;

// Rounded rectangle SDF
float roundedRect(vec2 p, vec2 size, float radius) {
    vec2 d = abs(p) - size + vec2(radius);
    float outsideDist = length(max(d, 0.0));
    float insideDist = min(max(d.x, d.y), 0.0);
    return outsideDist + insideDist - radius;
}

void main() {
    vec4 color = texture2D(uTexture, vUv);

    // Vignette
    float distToCenter = distance(vUv, vec2(0.5));
    distToCenter = smoothstep(0.3, 0.8, distToCenter * 0.8);
    color.rgb = mix(color.rgb, uVignetteColor, distToCenter);

    // Compute SDF and alpha
    float dist = roundedRect(vRectUv, uRectSize, uRadius);
    float alpha = 1.0 - smoothstep(-0.002, 0.0, -dist);

    gl_FragColor = vec4(color.rgb, alpha);
}
`;

export interface DarkPlaneHandle {
  mesh: THREE.Mesh;
  /** Recompute the aspect-dependent corner radius. Call on resize. */
  resize(width: number, height: number, isMd: boolean): void;
  /**
   * Advance the window. Every argument is explicit rather than read from a
   * global: the caller owns the frame loop and the scene weights.
   */
  update(opts: { aboutIn: number; aboutOut: number; landscape: boolean; width: number; height: number }): void;
  dispose(): void;
}

export function createDarkPlane(texture: THREE.Texture): DarkPlaneHandle {
  const uniforms = {
    uAngle: { value: 0 },
    uRectSize: { value: new THREE.Vector2() },
    uRectCenter: { value: new THREE.Vector2() },
    uRadius: { value: 0.05 },
    uAspectRatio: { value: 1 },
    // Upstream declares these two and never reads them in the shader. They are
    // carried over unchanged rather than dropped, so the uniform block stays
    // identical to upstream's.
    uBloomStrength: { value: 0.5 },
    uBloomRadius: { value: 0.002 },
  };

  const geometry = new THREE.PlaneGeometry(2, 2);

  /*
    Upstream clones `position` into an `activePosition` attribute that no shader
    in the repo ever reads. Reproduced for the same reason as the spare uniforms:
    a silent structural divergence from upstream is harder to spot later than a
    harmless unused attribute.
  */
  const position = geometry.getAttribute("position");
  const activeArray = new Float32Array(position.array.length);
  for (let i = 0; i < position.array.length; i += 1) {
    activeArray[i] = position.array[i]!;
  }
  geometry.setAttribute("activePosition", new THREE.Float32BufferAttribute(activeArray, 3));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    uniforms: {
      uTexture: { value: texture },
      uVignetteColor: { value: new THREE.Color("rgb(0, 15, 61)") },
      ...uniforms,
    },
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  mesh.visible = false;

  return {
    mesh,
    resize(width: number, height: number, isMd: boolean) {
      uniforms.uAspectRatio.value = width / height;
      // Upstream: (isMd ? 48 : 24) / sizes.height
      uniforms.uRadius.value = (isMd ? 48 : 24) / height;
    },
    update({ aboutIn, aboutOut, landscape, width, height }) {
      /*
        Upstream hides the plane outright outside the about act's window rather
        than leaving it at zero alpha, which saves a fullscreen draw every frame
        while the room is the subject.
      */
      if (aboutIn < 0.001 || (aboutIn === 1 && aboutOut >= 0.999) || aboutOut === 1) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;

      const aspectRatio = width / height;
      // Upstream: mix(0.55, isLandscape ? 0.5 : 0.35, aboutIn)
      const sizeTarget = landscape ? 0.5 : 0.35;
      const sizeValue = 0.55 + (sizeTarget - 0.55) * aboutIn;

      uniforms.uRectSize.value.set(sizeValue * aspectRatio, 0.5);
      uniforms.uRectCenter.value.set(
        0.5 + (landscape ? 0.2 : 0) * aboutIn,
        0.5 + aboutIn * (landscape ? 1.1 : 1.02)
      );
      uniforms.uAngle.value = (landscape ? 0.075 : 0) * aboutIn;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
