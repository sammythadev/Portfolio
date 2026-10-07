/**
 * Room detail shaders — desktops, message popup, music notes, shadow catcher
 * and the penguin's heart.
 *
 * Ported verbatim from the interactive portfolio at github.com/davidhckh/portfolio-2025
 * by David Heckhoff, licensed CC BY-NC-SA 4.0. Original: https://david-hckh.com
 *
 * These five shaders are the whole visual difference between the room reading as
 * baked artwork and reading as a *place where something is happening*. Each one
 * is carried over line-for-line, `#define` constants included, because the
 * constants are the artwork's placement inside its spritesheet — nudging
 * `FRAME_X` by a tenth of a cell puts a music note on the visitor's face.
 *
 * Upstream writes `varying`/`gl_FragColor` because its pipeline is WebGL1.
 * three.js still accepts that syntax for materials left on GLSL1, so the
 * original form is kept rather than rewritten to `in`/`out` (see the same note
 * in avatar-shaders.ts).
 *
 * Two upstream quirks are preserved on purpose and are worth knowing before
 * editing anything here:
 *
 *   - The popup and heart vertex stages *patch `modelViewMatrix` in place* to
 *     billboard a quad: the view rotation is kept and columns 0/1 are
 *     overwritten with a constant scale. That is why the sprites face the camera
 *     at a fixed world size, and why the geometry they are drawn with must stay
 *     a unit plane at the origin — the translation lives in the mesh, not the
 *     matrix.
 *
 *   - The popup/heart/notes all read from the SAME spritesheet texture, which is
 *     left at the loader's default `flipY = true`. Their row lookups therefore
 *     subtract the frame row from `TOTAL_ROWS - 1.0` to walk the atlas
 *     bottom-up. Flipping the texture instead would turn every other sprite
 *     consumer in the scene upside down, so the flip is done per-shader.
 *
 * No backticks may appear anywhere below: this whole file is a set of template
 * literals, and one stray backtick terminates the shader source.
 */

/* glsl */
export const desktopsVertexShader = /* glsl */ `
attribute float scrollIntensity;
attribute float messageIntensity;

varying vec2 vUv;
varying float vScrollIntensity;
varying float vMessageIntensity;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    vUv = uv;
    vScrollIntensity = scrollIntensity;
    vMessageIntensity = messageIntensity;
}
`;

/**
 * The two desktop screens.
 *
 * Upstream draws both screens as one merged mesh, so a uniform can no longer
 * address a single screen. The per-vertex `scrollIntensity` / `messageIntensity`
 * attributes are what restore that targeting: plane 0 carries
 * (scroll 1, message 0) and plane 1 carries (scroll 0, message 1), baked in
 * room-details.ts before the merge. That is why the "ghost scrolling" only ever
 * affects the left screen and the message row only ever appears on the right
 * one.
 */
export const desktopsFragmentShader = /* glsl */ `
uniform sampler2D uTexture;
uniform float uScrollDepth;
uniform float uMessageIntensity;

varying vec2 vUv;
varying float vScrollIntensity;
varying float vMessageIntensity;

void main() {
    vec2 scrollUv = vec2(vUv.x, vUv.y + uScrollDepth * vScrollIntensity);
    vec4 color = texture2D(uTexture, scrollUv);

    vec2 messageUv = vec2(vUv.x, vUv.y + 0.5);
    vec4 messageColor = texture2D(uTexture, messageUv);

    color = mix(color, messageColor, vMessageIntensity * messageColor.a * uMessageIntensity);

    gl_FragColor = vec4(color.rgb, 1.0);
}
`;

/**
 * Message popup — one cell of the icon spritesheet, billboarded.
 *
 * `uProgress` does double duty: it carries the sprite up and toward the camera
 * (`transformed.y/z += .75 * uProgress`) while the alpha is faded in over the
 * first quarter and out across the last hundredth. Both the motion and the
 * opacity come from the same scalar, which is why the popup cannot be left
 * "half shown" — the state is one number, animated 0 to 1 over two seconds by
 * room-details.ts.
 */
export const messagePopupVertexShader = /* glsl */ `
varying vec2 vUv;
varying float vAlpha;

uniform float uProgress;

#define TOTAL_COLS 4.
#define TOTAL_ROWS 4.
#define FRAME_X 0.
#define FRAME_Y 0.
#define SCALE 0.5

void main() {
    mat4 spriteViewMatrix = modelViewMatrix;

    spriteViewMatrix[0][0] = 1.0 * SCALE;
    spriteViewMatrix[0][1] = 0.0;
    spriteViewMatrix[0][2] = 0.0;

    spriteViewMatrix[1][0] = 0.0;
    spriteViewMatrix[1][1] = 1.0 * SCALE;
    spriteViewMatrix[1][2] = 0.0;

    vec3 transformed = position;

    transformed.y += .75 * uProgress;
    transformed.z += .75 * uProgress;

    gl_Position = projectionMatrix * spriteViewMatrix * vec4(transformed, 1.0);

    // Frame UVs
    vUv = uv;
    vUv.x = (uv.x + FRAME_X) / TOTAL_COLS;
    vUv.y = (uv.y + (TOTAL_ROWS - 1.0 - FRAME_Y)) / TOTAL_ROWS;

    // Alpha fade in/out
    float fadeIn = smoothstep(0.0, 0.25, uProgress);   
    float fadeOut = smoothstep(1.0, 0.99, uProgress);  
    vAlpha = fadeIn * fadeOut;
}
`;

export const messagePopupFragmentShader = /* glsl */ `
varying vec2 vUv;
varying float vAlpha;

uniform sampler2D uTexture;

void main() {
    vec4 color = texture2D(uTexture, vUv);

    gl_FragColor = vec4(color.rgb, vAlpha * color.a);
}
`;

/**
 * Music notes — three staggered streams rising out of the speaker.
 *
 * The mesh is ONE geometry merged from three unit planes; `aIndex` is the
 * per-plane constant (0, 1/3, 2/3) that offsets each stream's phase by a third
 * of a cycle, which is what makes three notes rather than one note drawn three
 * times. `uTime` can therefore run forever: `fract()` wraps the progress, and
 * `uOpacity` only ever fades the whole effect in or out when the visitor mutes
 * the room.
 */
export const notesVertexShader = /* glsl */ `
attribute float aIndex;

varying vec2 vUv;
varying float vAlpha;

uniform sampler2D uTexture;
uniform float uTime;

#define TOTAL_COLS 4.
#define TOTAL_ROWS 4.
#define FRAME_X 0.
#define FRAME_Y 3.
#define SCALE 0.4
#define PI 3.14159

vec2 rotate2D(vec2 pos, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * pos.x - s * pos.y, s * pos.x + c * pos.y);
}

void main() {
    mat4 spriteViewMatrix = modelViewMatrix;

    float progress = fract(uTime * 0.15 + aIndex);

    float scale = SCALE * (1.0 - progress * 0.4);

    spriteViewMatrix[0][0] = 1.0 * scale;
    spriteViewMatrix[0][1] = 0.0;
    spriteViewMatrix[0][2] = 0.0;

    spriteViewMatrix[1][0] = 0.0;
    spriteViewMatrix[1][1] = 1.0 * scale;
    spriteViewMatrix[1][2] = 0.0;

    vec3 transformed = position;

    vec2 pos = position.xy;
    float rotationAngle = sin(progress * PI * 6.0) * PI * 0.1;
    pos = rotate2D(pos, rotationAngle);
    transformed.xy = pos;

    transformed.x += progress * 2.5;
    transformed.y += progress * 6.;

    gl_Position = projectionMatrix * spriteViewMatrix * vec4(transformed, 1.0);

    // Frame UVs
    vUv = uv;
    vUv.x = (uv.x + FRAME_X) / TOTAL_COLS;
    vUv.x += 0.25 * (aIndex * 3.);
    vUv.y = (uv.y + (TOTAL_ROWS - 1.0 - FRAME_Y)) / TOTAL_ROWS;

    // Alpha fade in/out
    float fadeIn = smoothstep(0.0, 0.15, progress);   
    float fadeOut = smoothstep(1.0, 0.7, progress);  
    vAlpha = fadeIn * fadeOut;
}
`;

export const notesFragmentShader = /* glsl */ `
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

/**
 * Shadow catcher — a baked ambient-occlusion sheet, not a real shadow.
 *
 * The scene has no lights and cannot cast a shadow, so the room GLB ships a
 * flat plate carrying a pre-rendered occlusion map: the RED channel is the
 * "lightness" of the surface, mixed between the beige background and a darker
 * beige. That is the entire reason the desk, chair and plant read as sitting on
 * the carpet rather than floating over it.
 *
 * The two colours are uniforms rather than constants because upstream reassigns
 * them on every frame in `onBeforeRender` — see the note in room-details.ts,
 * where that quirk is reproduced. This stage is also the only one here that
 * writes opaque output, and it is drawn with `depthWrite`/`depthTest` disabled at
 * `renderOrder = -1000`, so it lands behind every other object.
 */
export const shadowCatcherVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    vUv = uv;
}
`;

export const shadowCatcherFragmentShader = /* glsl */ `
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

/**
 * Heart — the same billboard trick as the popup, on a different atlas cell.
 *
 * `FRAME_X 2.` selects the heart in the first row, and `uProgress` grows the
 * sprite while lifting it up and back. Upstream drives it from the penguin's
 * click timeline at the same moment the bird jumps, which is why the two share a
 * clock in room-details.ts.
 */
export const heartVertexShader = /* glsl */ `
varying vec2 vUv;
varying float vAlpha;

uniform float uProgress;

#define TOTAL_COLS 4.
#define TOTAL_ROWS 4.
#define FRAME_X 2.
#define FRAME_Y 0.
#define SCALE 0.35

void main() {
    mat4 spriteViewMatrix = modelViewMatrix;

    float scale = SCALE * (0.6 + uProgress * 0.4);

    spriteViewMatrix[0][0] = 1.0 * scale;
    spriteViewMatrix[0][1] = 0.0;
    spriteViewMatrix[0][2] = 0.0;

    spriteViewMatrix[1][0] = 0.0;
    spriteViewMatrix[1][1] = 1.0 * scale;
    spriteViewMatrix[1][2] = 0.0;

    vec3 transformed = position;

    transformed.x += .2 * uProgress;
    transformed.y += 1.5 * uProgress;
    transformed.z += .3 * uProgress;
    
    gl_Position = projectionMatrix * spriteViewMatrix * vec4(transformed, 1.0);

    // Frame UVs
    vUv = uv;
    vUv.x = (uv.x + FRAME_X) / TOTAL_COLS;
    vUv.y = (uv.y + (TOTAL_ROWS - 1.0 - FRAME_Y)) / TOTAL_ROWS;

    // Alpha fade in/out
    float fadeIn = smoothstep(0.0, 0.25, uProgress);   
    float fadeOut = smoothstep(1.0, 0.99, uProgress);  
    vAlpha = fadeIn * fadeOut;
}
`;

export const heartFragmentShader = /* glsl */ `
varying vec2 vUv;
varying float vAlpha;

uniform sampler2D uTexture;

void main() {
    vec4 color = texture2D(uTexture, vUv);
    
    gl_FragColor = vec4(color.rgb, vAlpha * color.a);
}
`;
