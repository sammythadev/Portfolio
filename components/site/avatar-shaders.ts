/**
 * Avatar shaders — matcap body and textured head.
 *
 * Ported from the interactive portfolio at github.com/davidhckh/portfolio-2025 by
 * David Heckhoff, licensed CC BY-NC-SA 4.0. Original: https://david-hckh.com
 *
 * The avatar is lit entirely by matcaps — a shader that looks up a pre-baked
 * lighting sphere from the view-space normal, with no lights in the scene at
 * all. That is what keeps it consistent against a pure-black background while
 * still reading as a solid, shaded figure.
 *
 * Two details carried over verbatim, because they are the whole effect:
 *
 *   - `vModelProgress` is a per-vertex height ramp: `(worldY + 0.2) / 4.7`.
 *     The fragment stage smoothsteps it against `uProgress`, so the model is
 *     *revealed bottom-up* by a moving edge rather than faded in as a whole.
 *     This is what makes the avatar appear to materialise out of the floor
 *     during the scroll.
 *
 *   - `applyAmbient` lifts the shadowed side with a cold blue as `uAmbientStrength`
 *     rises, so the figure warms as the camera approaches it.
 *
 * Porting notes:
 *   - Upstream writes `varying`/`gl_FragColor` because its GLSL pipeline is
 *     WebGL1. three.js compiles these through its own preprocessor, which still
 *     accepts that syntax when the material stays on GLSL1 — so the original
 *     form is kept rather than rewritten to `in`/`out`, which would require
 *     `glslVersion: GLSL3` and a rewrite of the skinning includes below.
 *   - Upstream declares both `vViewNormal` and `vNormal` in the fragment stage
 *     and samples the matcap with the latter. Only `vNormal` is defined in the
 *     vertex stage, so `vViewNormal` is dropped here: it is unused, and an
 *     undeclared varying costs a link slot for nothing.
 */

export const avatarMatcapVertexShader = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vModelProgress;

  void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>

    #include <project_vertex>

    /*
      Reconstruct the skinned normal by hand.

      three.js has no stock varying that carries this: "vNormal" is written
      pre-skinning, so on an animated character the lighting would swim across
      the surface as the mesh deforms. Each of the four bone matrices is
      applied to the normal by its skin weight and summed, which is the same
      construction "skinnormal_vertex" uses internally.
    */
    vec4 skinnedNormal = vec4(0.0);
    skinnedNormal += boneMatX * vec4(normal, 0.0) * skinWeight.x;
    skinnedNormal += boneMatY * vec4(normal, 0.0) * skinWeight.y;
    skinnedNormal += boneMatZ * vec4(normal, 0.0) * skinWeight.z;
    skinnedNormal += boneMatW * vec4(normal, 0.0) * skinWeight.w;

    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    vViewPosition = viewPosition.xyz;
    vNormal = skinnedNormal.xyz;

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    // Upstream's ramp, verbatim. It is a height band in world units, which is
    // why the mesh must be left at its authored scale — see avatar-stage.
    vModelProgress = (worldPosition.y + 0.2) / 4.7;
  }
`;

export const avatarMatcapFragmentShader = /* glsl */ `
  uniform sampler2D uMatcap;
  uniform float uProgress;
  uniform float uAmbientStrength;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vModelProgress;

  #define SMOOTH_WIDTH 0.002
  #define AMBIENT_COLOR vec3(0.0, 0.016, 0.063)

  void main() {
    vec3 viewDir = normalize(vViewPosition);

    /*
      Build a view-aligned basis from the view direction. Projecting the normal
      onto it gives matcap UVs, which is why the lighting stays locked to the
      camera: rotating the model does not slide the highlight, it rotates the
      surface through a fixed environment.
    */
    vec3 x = normalize(vec3(viewDir.z, 0.0, -viewDir.x));
    vec3 y = cross(viewDir, x);
    vec2 uv = vec2(dot(x, vNormal), dot(y, vNormal)) * 0.495 + 0.5;

    vec3 matcapColor = texture2D(uMatcap, uv).rgb;

    // The bottom-up reveal. At uProgress <= 0 the model is fully visible, so the
    // figure is never hidden on first frame.
    float s = smoothstep(uProgress, uProgress + SMOOTH_WIDTH, vModelProgress);
    float progress = mix(s, 1.0, step(uProgress, 0.0));

    matcapColor += AMBIENT_COLOR * uAmbientStrength;

    gl_FragColor = vec4(matcapColor, progress);
  }
`;

export const avatarHeadVertexShader = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>

  varying vec2 vUv;
  varying float vModelProgress;

  void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>

    #include <project_vertex>

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    // Upstream's ramp, verbatim. It is a height band in world units, which is
    // why the mesh must be left at its authored scale — see avatar-stage.
    vModelProgress = (worldPosition.y + 0.2) / 4.7;
    vUv = uv;
  }
`;

/**
 * The head texture is a sprite sheet: several face expressions laid out in a
 * grid, and the fragment stage crops one cell based on the progress value so
 * the character's face changes as the scroll advances.
 */
export const avatarHeadFragmentShader = /* glsl */ `
  uniform sampler2D uHeadTexture;
  uniform float uProgress;
  uniform float uAmbientStrength;

  varying vec2 vUv;
  varying float vModelProgress;

  #define SMOOTH_WIDTH 0.002
  #define AMBIENT_COLOR vec3(0.0, 0.016, 0.063)

  void main() {
    float s = smoothstep(uProgress, uProgress + SMOOTH_WIDTH, vModelProgress);
    float progress = mix(s, 1.0, step(uProgress, 0.0));

    vec4 texel = texture2D(uHeadTexture, vUv);

    gl_FragColor = vec4(texel.rgb + AMBIENT_COLOR * uAmbientStrength, progress);
  }
`;

/**
 * Face — upstream's `avatar-face` shaders.
 *
 * The face is a flat plane carrying a 4x4 expression atlas (face-spritesheet.png)
 * and it is drawn with `depthTest` and `depthWrite` both off so it always lands
 * on top of the head. Leaving it on the loader's default material — which is
 * what this port did at first — renders it as an unlit black rectangle pasted
 * across the character's skull the moment the camera sees the model from behind.
 *
 * The atlas row is flipped in the shader (`ROWS - 1 - row`) because the
 * spritesheet keeps the loader's default `flipY = true`, unlike every other
 * avatar texture. Changing either one without the other turns the face upside
 * down.
 */
export const avatarFaceVertexShader = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>

  varying vec2 vUv;
  varying float vModelProgress;

  void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>

    #include <project_vertex>

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vModelProgress = (worldPosition.y + 0.2) / 4.7;
    vUv = uv;
  }
`;

export const avatarFaceFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uFrame;
  uniform float uProgress;

  varying vec2 vUv;
  varying float vModelProgress;

  #define ROWS 4.0
  #define COLUMNS 4.0
  #define SMOOTH_WIDTH 0.002

  void main() {
    float column = mod(uFrame, COLUMNS);
    float row = floor(uFrame / COLUMNS);

    // The atlas is stored top-down; undo that here rather than flipping the
    // texture, so the other avatar textures keep their own orientation.
    row = (ROWS - 1.0) - row;

    vec2 atlasUv = vUv;
    atlasUv.x = (atlasUv.x + column) / COLUMNS;
    atlasUv.y = (atlasUv.y + row) / ROWS;

    vec4 textureColor = texture2D(uTexture, atlasUv);

    float s = smoothstep(uProgress, uProgress + SMOOTH_WIDTH, vModelProgress);
    float progress = mix(s, 1.0, step(uProgress, 0.0));

    gl_FragColor = vec4(textureColor.rgb, progress * textureColor.a);
  }
`;