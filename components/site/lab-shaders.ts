/*
 * Lab shaders — the five programs that make up the "about" act diorama.
 *
 *   https://github.com/davidhckh/portfolio-2025 — original by David Heckhoff.
 *   Licensed CC BY-NC-SA 4.0. See README "Attribution" and the visible credit
 *   on /playground. Non-commercial reuse only, and the licence requires the
 *   credit to travel with derivative work, which is why it is repeated here.
 *
 * Provenance
 * ----------
 * Copied character-for-character from upstream
 *
 *   src/three/shaders/lab-base/{vertex,fragment}.glsl
 *   src/three/shaders/lab-electric/{vertex,fragment}.glsl
 *   src/three/shaders/lab-particles/{vertex,fragment}.glsl
 *   src/three/shaders/lab-shine/{vertex,fragment}.glsl
 *   src/three/shaders/digital-numbers/{vertex,fragment}.glsl
 *
 * including every `#define` and every literal. The look of the act is carried
 * almost entirely by those constants — the ring radii on the base, the three
 * line positions on the electric panel, the cone the particles climb, the 4x3
 * digit atlas grid — so a "tidy" rounding of any of them would be an edit to
 * the artwork rather than a cleanup.
 *
 * Why the GLSL is inlined
 * -----------------------
 * Upstream imports `.glsl` files through Vite. This project has no GLSL loader
 * configured and no `#include` chain, so each program lives here as a
 * template-literal string, the same shape as avatar-shaders.ts and
 * grid-floor-shaders.ts. None of these programs include another, so there is
 * nothing to resolve at build time and the shader a reader sees is exactly the
 * shader that runs.
 *
 * Quirks preserved on purpose
 * ---------------------------
 *   - `lab-base` declares COLOR_TOP and never reads it. The fragment mixes
 *     toward COLOR_CYAN only. It is kept so this file stays a straight diff
 *     against upstream — deleting a dead define would make the next upstream
 *     comparison lie about what actually changed.
 *
 *   - The particle cone disagrees with itself between the two languages. The JS
 *     that seeds the attributes uses `BOTTOM_RADIUS = 1.0` (lab-stage.ts), while
 *     the vertex program below has `#define BOTTOM_RADIUS .4`. The shader then
 *     computes `radius / BOTTOM_RADIUS`, so a particle seeded at the rim of 1.0
 *     arrives at 2.5x the cone's nominal base radius. That mismatch is upstream
 *     and is what widens the column at the bottom; "fixing" either constant
 *     closes the cone and changes the silhouette.
 *
 *   - `digital-numbers` declares and writes `vUv` and `vPosition` in the vertex
 *     stage and never reads either in the fragment stage. They are interpolators
 *     paid for with nothing to show. Kept verbatim.
 *
 * Dialect: these are WebGL1-style ESSL1 programs (`varying`, `gl_FragColor`,
 * `texture2D`). Upstream runs that way and three.js still compiles ESSL1 into a
 * WebGL2 context, so rewriting to `in`/`out` would only buy a `glslVersion`
 * change. Keep the original form.
 *
 * Note on backticks: this file is full of template literals, and a backtick
 * anywhere inside one — including inside a GLSL comment — would end the string.
 * GLSL comments below therefore use plain quotes only.
 */

/* ---------------------------------------------------------------------------
   lab-base — the projector plinth, and the screen inside its ring
   ---------------------------------------------------------------------------
   One material is shared by two nodes ("base" and "display" in lab-stage.ts),
   which is the point: the cyan ring pulse is a single `uProgress` uniform read
   by both meshes, so the lit screen and the ring around it can never drift out
   of step.

   The ring is built in model space from `vPosition.xz` normalised by RADIUS,
   not from UVs, so it stays circular on a mesh whose atlas is not. The
   `SHADOW_*` band darkens everything below y = -0.4, which is what seats the
   plinth in the floor instead of letting it float over it.

   Upstream's fragment stage also carries a `COLOR_TOP` define that nothing
   reads — see "Quirks preserved on purpose" in the file header. It is left in
   the program, not commented out, so the GLSL below is a byte-for-byte copy.
--------------------------------------------------------------------------- */

export const labBaseVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;

  uniform float uProgress;

  void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

      vPosition = position;
      vUv = uv;
  }
`;

export const labBaseFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;

  uniform sampler2D uDiffuseMap;
  uniform float uProgress;

  #define COLOR_TOP vec3(0.,0.38,0.69)
  #define COLOR_CYAN vec3(0.27, 1.0, 1.0)

  #define SHADOW_START -0.4
  #define SHADOW_END 0.
  #define SHADOW_COLOR vec3(.0, 0., 0.1)
  #define SHADOW_OPACITY 0.5

  #define RADIUS 2.11

  #define INNER_RADIUS 0.435
  #define OUTER_RADIUS 0.455
  #define RING_WIDTH 0.005
  #define RIGHT_BLOOM_WIDTH 0.045

  void main() {

      vec4 diffuse = texture2D(uDiffuseMap, vUv);

      // Calculate distance from origin using model position, normalized by radius
      float dist = length(vPosition.xz) / RADIUS;

      // Create smooth ring mask (hollow circle)
      float ring = smoothstep(INNER_RADIUS, INNER_RADIUS + RING_WIDTH, dist) *
                  smoothstep(OUTER_RADIUS + RING_WIDTH, OUTER_RADIUS, dist);
      float ringBloom = smoothstep(INNER_RADIUS, INNER_RADIUS + RIGHT_BLOOM_WIDTH, dist) *
                  smoothstep(OUTER_RADIUS + RIGHT_BLOOM_WIDTH, OUTER_RADIUS, dist);
      ring += ringBloom * 0.5;

      float centerCircle = smoothstep(0.4, 0.1, dist);
      ring += centerCircle * 0.5;
      ring = min(1., ring);

      float shadow = smoothstep(SHADOW_END, SHADOW_START, vPosition.y);

      // Mix base color with cyan color based on ring mask
      vec3 color = mix(diffuse.rgb, COLOR_CYAN, ring * (0.1 + 0.9 * uProgress));
      color = mix(color, SHADOW_COLOR, shadow * SHADOW_OPACITY);

      gl_FragColor = vec4(color, 1.0);
  }
`;

/* ---------------------------------------------------------------------------
   lab-electric — the three flickering scan lines on the screen
   ---------------------------------------------------------------------------
   Three fixed heights (0.25, 0.5, 0.75 in UV space) each get their own sine
   flicker, phase-shifted by PI * 0.33 so the lines never pulse together. The
   `MIN_LINE_STRENGTH` floor is the whole reason the panel is never fully dark:
   each line keeps a 0.1 multiplier regardless of `uOpacity`, and only the part
   above that floor responds to scroll velocity. `uOpacity = 0` therefore leaves
   three faint static lines rather than an empty screen.
--------------------------------------------------------------------------- */

export const labElectricVertexShader = /* glsl */ `
  varying vec2 vUv;

  uniform float uTime;

  void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

      vUv = uv;
  }
`;

export const labElectricFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;

  #define LINE_WIDTH 0.05
  #define WAVE_COUNT 50.0
  #define PI 3.14159265359
  #define MIN_LINE_STRENGTH 0.1
  #define LINE_STRENGTH_SPEED 6.0

  #define COLOR vec3(0.3, 1., 1.)

  void main() {
      // Three horizontal lines at different y positions
      float baseStrength1 = smoothstep(LINE_WIDTH, 0.0, abs(vUv.y - 0.25));
      float baseStrength2 = smoothstep(LINE_WIDTH, 0.0, abs(vUv.y - 0.5));
      float baseStrength3 = smoothstep(LINE_WIDTH, 0.0, abs(vUv.y - 0.75));

      // Strength animation patterns with phase offsets for independent flickering
      float strengthPattern1 = sin(vUv.x * WAVE_COUNT * 0.5 + uTime * LINE_STRENGTH_SPEED) * 0.5 + 0.5;
      float strengthPattern2 = sin(vUv.x * WAVE_COUNT * 0.5 + uTime * LINE_STRENGTH_SPEED + PI * 0.33) * 0.5 + 0.5;
      float strengthPattern3 = sin(vUv.x * WAVE_COUNT * 0.5 + uTime * LINE_STRENGTH_SPEED + PI * 0.66) * 0.5 + 0.5;

      strengthPattern1 = smoothstep(0.0, 0.5, strengthPattern1);
      strengthPattern2 = smoothstep(0.0, 0.5, strengthPattern2);
      strengthPattern3 = smoothstep(0.0, 0.5, strengthPattern3);

      // Map patterns to range between MIN_LINE_STRENGTH and 1.0
      // The MIN_LINE_STRENGTH is always visible, only the animated part above it is affected by uOpacity
      float animatedPart1 = (1.0 - MIN_LINE_STRENGTH) * strengthPattern1;
      float animatedPart2 = (1.0 - MIN_LINE_STRENGTH) * strengthPattern2;
      float animatedPart3 = (1.0 - MIN_LINE_STRENGTH) * strengthPattern3;

      // Combine: MIN_LINE_STRENGTH (always visible) + animated part (affected by uOpacity)
      float multiplier1 = MIN_LINE_STRENGTH + animatedPart1 * uOpacity;
      float multiplier2 = MIN_LINE_STRENGTH + animatedPart2 * uOpacity;
      float multiplier3 = MIN_LINE_STRENGTH + animatedPart3 * uOpacity;

      // Apply animated strength to each line and combine
      float strength = baseStrength1 * multiplier1 + baseStrength2 * multiplier2 + baseStrength3 * multiplier3;

      gl_FragColor = vec4(COLOR, strength);
  }
`;

/* ---------------------------------------------------------------------------
   lab-particles — the column of dust rising through the hologram
   ---------------------------------------------------------------------------
   The motion is entirely procedural, driven off the per-particle attributes
   that lab-stage.ts seeds: `offset` staggers each particle's phase, `speed`
   varies its climb rate, `angle` / `radius` place it on the base disc, `drift`
   slides it sideways as it rises, `noiseOffset` decorrelates the wobble, and
   `size` scales the point sprite. One particle is cheap; fifty of them with
   independent phases read as a volume.

   Read the two radius defines together with the JS: the attribute was seeded
   against a bottom radius of 1.0 and the shader divides by .4, so the cone
   opens wider at its base than the constants alone suggest. That is upstream's
   look and is reproduced on purpose - see the file header.

   `color` is not declared here. The material sets `vertexColors: true`, so
   three.js injects the attribute declaration and the `varying` plumbing; the
   assignment `vColor = color` is all the program needs to do.

   Alpha fades in over the first tenth of the climb and out over the last
   tenth, then the whole thing is scaled by 0.3 - the particles are meant to be
   felt more than seen.
--------------------------------------------------------------------------- */

export const labParticlesVertexShader = /* glsl */ `
  attribute float offset;
  attribute float angle;
  attribute float radius;
  attribute float speed;
  attribute vec2 drift;
  attribute vec3 noiseOffset;
  attribute float size;

  varying vec3 vColor;
  varying float vAlpha;

  uniform float uTime;
  uniform float uScaleMultiplier;

  #define BOTTOM_RADIUS .4
  #define TOP_RADIUS 2.0
  #define CONE_HEIGHT 5.0
  #define SPEED 0.1

  // Simple noise function for organic movement
  float noise(float x) {
    return sin(x) * 0.5 + sin(x * 2.3) * 0.3 + sin(x * 4.7) * 0.2;
  }

  void main() {
    // Calculate progress based on time and offset with individual speed variation (0.0 to 1.0)
    float t = mod((uTime * SPEED * speed + offset), 4.0) / 4.0;

    // Calculate vertical position with organic variation
    float yNoise = noise(uTime * 0.5 + noiseOffset.y) * 0.1;
    float y = t * CONE_HEIGHT + yNoise;

    // Calculate radius at current height (linear interpolation)
    float currentRadius = mix(BOTTOM_RADIUS, TOP_RADIUS, t);

    // Add organic radius variation
    float radiusNoise = noise(uTime * 0.3 + noiseOffset.y * 0.5) * 0.08;
    currentRadius += radiusNoise;

    // Calculate current radial distance based on initial radius proportion
    float currentDist = (radius / BOTTOM_RADIUS) * currentRadius;

    // Add organic angular variation (swirling motion)
    float angleVariation = noise(uTime * 0.4 + noiseOffset.x) * 0.25;
    float organicAngle = angle + angleVariation;

    // Add horizontal organic movement using noise
    float xNoise = noise(uTime * 0.6 + noiseOffset.x) * 0.2;
    float zNoise = noise(uTime * 0.7 + noiseOffset.z) * 0.2;

    // Calculate position in cone shape with organic movement
    vec3 pos;
    pos.x = cos(organicAngle) * currentDist + drift.x * t + xNoise;
    pos.y = y;
    pos.z = sin(organicAngle) * currentDist + drift.y * t + zNoise;

    float baseSize = 0.2;
    float particleSize = baseSize * size;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = particleSize * uScaleMultiplier * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // Calculate alpha based on progress for fade in/out using smoothstep
    // Fade in: 0.0 to 0.1
    // Full opacity: 0.1 to 0.9
    // Fade out: 0.9 to 1.0
    float fadeIn = smoothstep(0.0, 0.1, t);
    float fadeOut = 1.0 - smoothstep(0.9, 1.0, t);
    float alpha = fadeIn * fadeOut;

    vColor = color;
    vAlpha = alpha * 0.3;
  }
`;

export const labParticlesFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Circular particle shape
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) {
      discard;
    }

    // Soft edge
    float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;

    gl_FragColor = vec4(vColor, alpha);
  }
`;

/* ---------------------------------------------------------------------------
   lab-shine — the light volume around the projector
   ---------------------------------------------------------------------------
   The mesh is drawn with `depthTest: false` and `depthWrite: false` on
   `DoubleSide`, i.e. it is a glow pass that is deliberately ignorant of the
   scene's depth. That is why it must be last in the render order (30): with
   depth testing off, the only thing keeping it from painting over the base is
   that it is submitted after it.

   The vertex stage folds a travelling two-axis sine (`vWave`) into a vertical
   ramp whose steepness depends on `uProgress`, and the fragment stage turns
   that ramp into alpha. `vLightY` is signed, so the `(1.0 - vLightY)` term
   below the mesh's midline is what keeps the glow from clipping to black in
   the middle of the volume.
--------------------------------------------------------------------------- */

export const labShineVertexShader = /* glsl */ `
  varying float vLightY;
  varying float vWave;

  uniform float uTime;
  uniform float uProgress;

  void main() {

    vec3 transformed = position;
    //transformed.y *= uProgress;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);

    // Create 2D wave effect using x and z positions
    float waveX = sin(position.x * 10.0 + uTime * 2.0);
    float waveZ = sin(position.z * 10.0 + uTime * 2.5);
    float wave = (waveX + waveZ) * 0.5 * .2;
    vWave = wave * -1.;
    vLightY = position.y * (2. - uProgress) * 0.5 - wave;
  }
`;

export const labShineFragmentShader = /* glsl */ `
  varying float vLightY;
  varying float vWave;

  uniform float uProgress;

  #define COLOR vec3(0.1,0.808,1.)

  void main() {
    // Reduce opacity where wave is positive (y going down)
    float waveOpacity = 1.0 - smoothstep(0.0, 0.25, vWave);
    gl_FragColor = vec4(COLOR, (1. - vLightY) * 0.3 * waveOpacity * uProgress);
  }
`;

/* ---------------------------------------------------------------------------
   digital-numbers — the three digit tiles floating in front of the display
   ---------------------------------------------------------------------------
   An InstancedMesh of three planes, all sharing this one program. `frame` is a
   per-instance attribute (an InstancedBufferAttribute on the shared
   PlaneGeometry), so each tile indexes its own cell of the 4x3 atlas below
   without any texture swapping: `column = frame mod 4`, `row = frame / 4`,
   then the row is flipped because the atlas is authored top-down.

   UV_PADDING insets the sample by one percent on every side. Without it the
   bilinear tap at a cell border bleeds the neighbouring digit into the tile.
--------------------------------------------------------------------------- */

export const digitalNumbersVertexShader = /* glsl */ `
  attribute float frame;

  varying vec2 vUv;
  varying vec2 vFrameUv;
  varying vec3 vPosition;

  #define TOTAL_COLS 4.0
  #define TOTAL_ROWS 3.0
  #define UV_PADDING 0.01

  void main() {
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);

      vPosition = position;
      vUv = uv;

      // Calculate frame UV coordinates
      float column = mod(frame, TOTAL_COLS);
      float row = floor(frame / TOTAL_COLS);

      // Flip Y if texture starts from top-left (common in texture atlases)
      row = (TOTAL_ROWS - 1.0) - row;

      // Calculate frame bounds
      float frameWidth = 1.0 / TOTAL_COLS;
      float frameHeight = 1.0 / TOTAL_ROWS;
      float frameLeft = column * frameWidth;
      float frameBottom = row * frameHeight;

      // Apply padding to UV coordinates within the frame
      vec2 paddedUv = uv * (1.0 - UV_PADDING * 2.0) + UV_PADDING;

      // Map padded UV to frame coordinates
      vFrameUv.x = frameLeft + paddedUv.x * frameWidth;
      vFrameUv.y = frameBottom + paddedUv.y * frameHeight;
  }
`;

export const digitalNumbersFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vFrameUv;
  varying vec3 vPosition;

  uniform sampler2D uTexture;
  uniform vec3 uColor;

  void main() {
      vec4 textureColor = texture2D(uTexture, vFrameUv);
      gl_FragColor = vec4(textureColor.rgb * uColor, textureColor.a);
  }
`;
