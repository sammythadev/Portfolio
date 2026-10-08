/*
 * Grid floor shaders — ported verbatim from davidhckh/portfolio-2025
 * (src/three/shaders/grid-floor/{vertex,fragment}.glsl), line-for-line.
 *
 *   https://github.com/davidhckh/portfolio-2025 — original by David Heckhoff.
 *   See README "Attribution" and the visible credit on /playground.
 *
 * The first port of this floor was hand-rolled in ogl with a perspective divide
 * in the fragment shader, because ogl's `Triangle` is a clip-space fullscreen
 * quad that cannot be put under a real camera. That reproduced the *idea* of the
 * floor, not the thing itself: the wrong cell count, the wrong fade, a linear
 * horizon, and none of the upward bow the upstream vertex shader produces.
 *
 * So this is the upstream shader exactly, running on a real
 * `PlaneGeometry(18, 18, 18, 18)` rotated flat — which is what gives it the
 * `pos.y += curve` displacement that a fullscreen quad has no way to express.
 */

/* glsl */
export const gridFloorVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;

uniform float uTime;
uniform float uProgress;

// tweakable constants
#define CURVE 0.04
#define CURVE_MIN 0.04

void main() {
  vUv = uv;
  vec3 pos = position;

  // calculate x weight based on distance to uv.x center
  float uvXCenter = 0.5;
  float distToUXCenter = abs(uv.x - uvXCenter);
  float xWeight = distToUXCenter * 2.0; // normalize to 0-1 range, then scale as needed

  // weighted distance: X varies based on distance to uv.x center
  float dist = sqrt(pos.x * pos.x * xWeight + pos.z * pos.z);
  float curve = pow(dist, 2.0);

  // make curve 0 at bottom center (uv.x = 0.5, uv.y = 0)
  vec2 bottomCenter = vec2(0.5, 0.0);
  float distToBottomCenter = distance(uv, bottomCenter);
  float bottomCenterMask = distToBottomCenter;
  curve *= bottomCenterMask;

  // apply curve
  pos.y += (curve * CURVE_MIN) + (curve * curve * uProgress);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

  vNormal = normal;
}
`;

/* glsl */
export const gridFloorFragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;

uniform vec3 uColor;
uniform vec3 uLineColor;
uniform float uOpacity;
uniform float uTime;
uniform float uProgress;

#define CELLS 18.0
#define LINE_WIDTH 0.01
#define FOG_START 0.25
#define SHADOW_COLOR vec3(0.0, 0.0, 0.075)

void main() {
    vec2 coord = vUv * CELLS;
    coord.y += uTime * 0.35;
    vec2 grid = abs(fract(coord) - 0.5);

    // grid lines
    float lineX = smoothstep(0.0, 0.5, grid.x);
    float lineY = smoothstep(0.0, 0.5, grid.y);
    float dots = lineX * lineY;
    dots = smoothstep(LINE_WIDTH - 0.005, LINE_WIDTH, 1. - dots);
    dots = 1. - dots;

    float halfLineWidth = LINE_WIDTH * 0.5;
    float lines = max(lineX, lineY);
    lines = smoothstep(halfLineWidth - 0.005, halfLineWidth, 1. - lines);
    lines = 1. - lines;
    lines *= 0.1;

    float pattern = max(dots, lines);

    // fade to edges
    float distToCenter = distance(vUv, vec2(0.5));
    float fadeProgress = mix(0.25, 0.5, uProgress);
    float alpha = 1.0 - smoothstep(FOG_START * 0.5, fadeProgress, distToCenter);

    // center circle
    vec2 center = vec2(0.5);
    float centerDist = distance(vUv, center);
    float centerAlpha = smoothstep(0.075, 0.059, centerDist);
    centerAlpha *= 0.4;

    vec3 finalColor = mix(uColor, uLineColor, pattern);
    finalColor = mix(finalColor, SHADOW_COLOR, centerAlpha);

    gl_FragColor = vec4(finalColor, alpha * uOpacity);
}
`;