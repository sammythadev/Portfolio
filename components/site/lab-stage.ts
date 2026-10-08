"use client";

/*
 * Lab stage — the "about" act diorama: the projector plinth, the hologram strip
 * that rises out of it, the particle column, and the three digit tiles.
 *
 *   https://github.com/davidhckh/portfolio-2025 — original by David Heckhoff.
 *   Licensed CC BY-NC-SA 4.0. See README "Attribution" and the visible credit
 *   on /playground. Non-commercial reuse only, and the licence requires the
 *   credit to travel with derivative work, which is why it is repeated here.
 *
 * Composition
 * -----------
 * Upstream's `objects/lab/index.ts` is not a scene, it is an act: one GLB with
 * four named nodes (base, display, electric, shine), three separately built
 * objects (the hologram plane, the particle column, the digit tiles), and a
 * per-frame tick that does nothing but push numbers into uniforms and toggle
 * two visibility flags. This port keeps that shape and hands the caller a group
 * plus one node that deliberately stays outside it:
 *
 *   group      base + display + electric + shine + hologram plane + digits
 *   particles  the Points, for a SECOND scene — see below
 *
 * Everything the caller needs to know about time arrives through `update`.
 * Upstream hangs each piece off `gsap.ticker` and reads its animation state from
 * module globals (`aboutProgress`, `velocity`, `sizes.isLandscape`); here those
 * are arguments, so the act can be scrubbed, paused, replayed or driven by a
 * test harness with gsap not even loaded. Nothing in this file reads a clock.
 *
 * Why the particles are handed back separately
 * --------------------------------------------
 * Upstream adds the Points to `renderTarget.scene` — a different scene, used
 * for the additive pass — and compensates by copying the lab group's position
 * onto the Points every tick (`points.position.copy(lab.group.position)`). That
 * is exactly why `particles` is on the handle instead of inside `group`: it has
 * to be added to another scene, and its only link to the group's transform is
 * that per-frame copy. Putting it in the same scene as the group applies the
 * group transform twice and floats the column away from the projector.
 *
 * Why base and display share ONE material
 * ---------------------------------------
 * `lab/base.ts` assigns a single ShaderMaterial instance to both nodes. The
 * display is the lit screen inside the ring, so sharing the material is what
 * keeps its cyan pulse exactly in step with the ring around it: one uniform,
 * one draw state, two meshes. It also means `display` has no material of its
 * own to dispose, and that `display.material === base.material` is load-bearing
 * rather than an accident.
 *
 * Why `display` and the digits are orientation-gated
 * --------------------------------------------------
 * Both are `visible = sizes.isLandscape` upstream. That is not decoration: the
 * portrait layout lays the act out differently and the screen and the readout
 * overlap the copy, so they are switched off rather than repositioned. Note
 * that upstream asks the WINDOW (`window.matchMedia("(orientation: landscape)")`),
 * not the render canvas — right for its full-screen layout, wrong for an
 * embedded one, which is why `update` takes an explicit override.
 *
 * The seat
 * --------
 * Upstream pins the group at z = 6 in both branches of the about transition
 * (`tl.fromTo(lab.group.position, { x: 0, y: 0, z: 6 }, { ... z: 6 })` — a
 * tween to the value it already has, i.e. a static seat). It is reproduced here
 * so the act lands where upstream's camera expects it; the caller may move the
 * group afterwards, and the particles will follow on the next `update`.
 *
 * Cleanup
 * -------
 * Upstream's `destroy()` only unhooks tickers and leaks the Points, the
 * geometries and the materials — acceptable for a page that lives until the tab
 * closes, not for a Next.js route that can unmount. `dispose()` here releases
 * everything it created, and the GLB's geometries are treated as ours because
 * the loader made them.
 *
 * Not ported
 * ----------
 * The electric panel's touch fallback: upstream listens for `window.scroll`,
 * tracks a delta and lerps a `touchVelocity` toward it, then feeds
 * `velocity * 0.75` into the shader. All of that is scroll-platform code, and
 * this project owns its scroll elsewhere, so `update` takes the resulting
 * `uOpacity` directly.
 *
 * Also nothing from upstream's `common/geometries.ts`: its shared
 * `planeGeometry` singleton is not referenced by any lab or digital-numbers
 * object, both of which build their own `PlaneGeometry`. There is nothing to
 * carry over.
 *
 * See also lab-shaders.ts, which carries the GLSL verbatim and documents the
 * constants this file has to agree with.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  digitalNumbersFragmentShader,
  digitalNumbersVertexShader,
  labBaseFragmentShader,
  labBaseVertexShader,
  labElectricFragmentShader,
  labElectricVertexShader,
  labParticlesFragmentShader,
  labParticlesVertexShader,
  labShineFragmentShader,
  labShineVertexShader,
} from "@/components/site/lab-shaders";

/**
 * One frame of lab state, supplied by the caller. The act owns no clock.
 */
export interface LabUpdate {
  /**
   * The act's own 0..1 scrub position — upstream's `aboutProgress`. Drives the
   * base/display ring pulse, the shine's brightness falloff, the particle
   * scale multiplier and which digits the tiles show. It is NOT the hologram
   * strip's progress; see `hologramProgress`.
   */
  progress: number;
  /**
   * Absolute seconds on the caller's clock — upstream's `gsap.ticker.time`.
   * Every drifting or flickering program reads it, so it must be monotonic
   * across frames: stepping it backwards (or restarting it) snaps the electric
   * lines and the particle cone rather than easing them.
   */
  time: number;
  /**
   * Seconds since the act started. Accepted for shape parity with the other
   * stage handles and currently unused: no lab program has a second clock, and
   * everything upstream animates is either absolute ticker time or act
   * progress. Kept in the type so `update` has one shape across the acts.
   */
  elapsed: number;
  /**
   * Upstream drives the hologram plane from the hologram material's own
   * `uProgress`, which is a different animation from `aboutProgress`. Omitted
   * or 0 parks the strip at START_Y with zero opacity, i.e. invisible.
   */
  hologramProgress?: number;
  /**
   * The electric panel's `uOpacity`, i.e. scroll velocity. Upstream computes it
   * as `velocity * 0.75` with a lerped window-scroll fallback for touch; both
   * of those belong to whoever owns the scroll, so the uniform's value is taken
   * as given. Defaults to 0, which leaves only the 0.1 baseline of each of the
   * three lines — faint but never blank.
   */
  electricOpacity?: number;
  /**
   * Orientation gate for `display` and the digit tiles. Defaults to upstream's
   * own test, `window.matchMedia("(orientation: landscape)")`. Pass it
   * explicitly whenever the render canvas is not the window, because upstream's
   * gate is a media query on the window and knows nothing about the canvas.
   */
  landscape?: boolean;
}

export interface LabHandle {
  /**
   * The act's root: base, display, electric, shine, the hologram plane and the
   * digit tiles. Seat it where the camera expects it (upstream uses z = 6).
   */
  group: THREE.Group;
  /**
   * The particle column. Add it to a SEPARATE scene — it is transformed on its
   * own and copies `group.position` every `update`; see the header.
   */
  particles: THREE.Points;
  update(opts: LabUpdate): void;
  dispose(): void;
}

/* ---------------------------------------------------------------------------
   The hologram plane
   ---------------------------------------------------------------------------
   Upstream's constants from `lab/plane.ts`, verbatim. They describe a strip
   that rises from just under the plinth to just above it while fading in and
   out, and a scale that swells to 1.5x at the midpoint of the hologram's own
   animation and returns to 1x at the end — the swell is what reads as the
   projection "powering up" and settling.
--------------------------------------------------------------------------- */

const START_Y = -0.2;
const END_Y = 4.5;
const FADE_IN_START = 0.2;
const FADE_IN_END = 0.3;
const FADE_OUT_START = 0.7;
const FADE_OUT_END = 0.9;

/** Upstream's `PARTICLE_COUNT`. Enough to read as a volume, cheap to seed. */
const PARTICLE_COUNT = 50;

/**
 * Upstream's orientation test, memoised. `matchMedia` is cheap but this runs
 * once per frame, and upstream caches the same answer on `sizes` at resize
 * time. Defaults to landscape when there is no window, so a headless caller
 * gets the fuller scene.
 */
let landscapeQuery: MediaQueryList | null = null;
const prefersLandscape = () => {
  if (typeof window === "undefined") return true;
  landscapeQuery ??= window.matchMedia("(orientation: landscape)");
  return landscapeQuery.matches;
};

interface DigitalNumbersProps {
  /** How many tiles. Upstream uses 3, which fits a 0..100 readout exactly. */
  count: number;
  parent: THREE.Object3D;
  position: THREE.Vector3;
  scale: number;
  renderOrder?: number;
  color?: THREE.Color;
  /** The 4x3 digit atlas. Loaded by `createLab`, which also disposes it. */
  texture: THREE.Texture;
}

/**
 * The three floating digit tiles — upstream's `objects/digital-numbers`.
 *
 * An InstancedMesh of `count` unit planes, all sharing one shader, with a
 * per-instance `frame` attribute that picks the digit's cell out of the atlas
 * in the vertex stage. Instancing rather than three meshes because the tiles
 * differ only by an attribute and a matrix, which is also what lets the whole
 * readout be updated by writing two floats per frame.
 *
 * Quirks preserved:
 *   - `renderOrder` is accepted by the constructor and then ignored: upstream's
 *     `init()` hard-codes `this.mesh.renderOrder = 22` a second time. Passed 22
 *     from the lab either way, so nothing changes on screen, and it is kept so
 *     the port matches upstream line for line.
 *   - `updateFrames` early-returns when the number has not changed, which
 *     includes the first call (`currentNumber` starts at 0 and the lab calls
 *     `updateFrames(0)`), so the instance attribute is technically never seeded
 *     at init. Every element of a fresh Float32Array is already 0, so the first
 *     readout is correct by accident rather than by construction.
 */
class DigitalNumbers {
  private readonly count: number;
  private readonly position: THREE.Vector3;
  private readonly scale: number;
  private readonly color: THREE.Color;
  private readonly mesh: THREE.InstancedMesh;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly frameAttribute: THREE.InstancedBufferAttribute;
  private readonly uniforms: {
    uTexture: { value: THREE.Texture };
    uColor: { value: THREE.Color };
  };
  private currentNumber = 0;

  constructor(props: DigitalNumbersProps) {
    this.count = props.count;
    this.position = props.position;
    this.scale = props.scale;
    this.color = props.color ?? new THREE.Color(1, 1, 1);

    this.uniforms = {
      uTexture: { value: props.texture },
      uColor: { value: this.color },
    };

    this.geometry = new THREE.PlaneGeometry(1, 1);

    /*
      The atlas' two texture flags are NOT set here even though upstream only
      touches them inside this class: `generateMipmaps` and the colour space are
      applied in `createLab`, next to the other two textures, so all three can be
      audited side by side. The colour space in particular has to be written
      explicitly there — see the note in `createLab`.
    */
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: this.uniforms,
      vertexShader: digitalNumbersVertexShader,
      fragmentShader: digitalNumbersFragmentShader,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.count);

    // Upstream sets the passed-in render order and then overwrites it with a
    // literal on the next line. Reproduced deliberately — see the class doc.
    this.mesh.renderOrder = props.renderOrder || 22;
    this.mesh.scale.set(this.scale, this.scale, this.scale);

    const centerIndex = Math.floor(this.count / 2);
    const spacing = 0.92;

    const matrix = new THREE.Matrix4();
    for (let i = 0; i < this.count; i++) {
      /*
        Only X is offset. Centring on the middle instance keeps the readout
        symmetrical about the mesh's own origin, which is what lets the lab
        place all three tiles with one position vector instead of three.
      */
      const offset = (i - centerIndex) * spacing;
      matrix.makeTranslation(offset, 0, 0);
      this.mesh.setMatrixAt(i, matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;

    // Per-instance, not per-vertex: it rides on the shared plane geometry as an
    // InstancedBufferAttribute, so one attribute feeds every instance.
    const frameArray = new Float32Array(this.count);
    this.frameAttribute = new THREE.InstancedBufferAttribute(frameArray, 1);
    this.geometry.setAttribute("frame", this.frameAttribute);

    this.mesh.renderOrder = 22;
    this.mesh.position.copy(this.position);

    props.parent.add(this.mesh);
  }

  /**
   * Point the tiles at `number`, zero-padded to the tile count: 7 becomes
   * 0,0,7 and 100 becomes 1,0,0. Leading tiles are blanked to the "0" cell
   * rather than hidden, which is upstream's readout style.
   */
  updateFrames(number: number) {
    if (number === this.currentNumber) return;
    this.currentNumber = number;

    // Convert number to string and get digits
    const numStr = number.toString();
    const digits = numStr.split("").map(Number);

    // Pad with zeros at the beginning to match count
    const paddedDigits: number[] = [];
    for (let i = 0; i < this.count; i++) {
      const digitIndex = i - (this.count - digits.length);
      paddedDigits[i] = digitIndex >= 0 ? digits[digitIndex] : 0;
    }

    // Update frame attribute
    for (let i = 0; i < this.count; i++) {
      this.frameAttribute.setX(i, paddedDigits[i]);
    }

    this.frameAttribute.needsUpdate = true;
  }

  /** Visibility is the caller's business; the lab gates it on orientation. */
  set visible(value: boolean) {
    this.mesh.visible = value;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    // The atlas texture is owned by `createLab` and disposed there.
  }
}

export async function createLab(): Promise<LabHandle> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("/models/lab.glb");

  /*
    Upstream looks the four pieces up by NODE name on the GLB's root, not by
    mesh name, and that distinction matters here: the file's meshes are named
    Circle, Circle.001, Circle.002 and Circle.004, while the nodes carry the
    names that mean something (base, display, electric, shine). three's
    GLTFLoader names an Object3D after its glTF node, so this is the same
    lookup upstream performs:

        resource.scene.children.find((child) => child.name === "base")

    The `instanceof` check and the throw are this port's addition: upstream's
    find would silently yield `undefined` and the act would render an empty
    group, which is indistinguishable from a camera that is pointing the wrong
    way. A missing node is a broken asset and should say so.
  */
  const findNode = (name: string): THREE.Mesh => {
    const node = gltf.scene.children.find((child) => child.name === name);
    if (!(node instanceof THREE.Mesh)) {
      throw new Error(`[lab] lab.glb has no "${name}" mesh node`);
    }
    return node;
  };

  const base = findNode("base");
  const display = findNode("display");
  const electric = findNode("electric");
  const shine = findNode("shine");

  /* ------------------------------------------------------------------
     Textures
     ------------------------------------------------------------------ */

  const textureLoader = new THREE.TextureLoader();
  const [diffuseMap, hologramPlaneTexture, numbersBitmap] = await Promise.all([
    textureLoader.loadAsync("/textures/diffuse-map.png"),
    textureLoader.loadAsync("/textures/hologram-plane.webp"),
    textureLoader.loadAsync("/textures/numbers-bitmap.webp"),
  ]);

  /*
    The base's atlas is read as linear, unflipped and mipmap-less, exactly as
    `lab/base.ts` leaves it. Linear because the ring mask is mixed into the
    texture afterwards in the shader: an sRGB decode there would brighten the
    painted surface relative to the cyan the shader adds. Unflipped because the
    atlas was authored for that convention, and mipmap-less because the surface
    is viewed at a near-constant distance and the mipped levels only soften the
    ring edge the shader draws.
  */
  diffuseMap.colorSpace = THREE.LinearSRGBColorSpace;
  diffuseMap.generateMipmaps = false;
  diffuseMap.flipY = false;
  diffuseMap.needsUpdate = true;

  // Identical settings on the hologram strip, from `lab/plane.ts`. The strip is
  // a flat translucent sheet seen square-on, so mipmaps would only cost memory.
  hologramPlaneTexture.colorSpace = THREE.LinearSRGBColorSpace;
  hologramPlaneTexture.generateMipmaps = false;
  hologramPlaneTexture.flipY = false;
  hologramPlaneTexture.needsUpdate = true;

  /*
    The digit atlas keeps its sRGB colour space — and that has to be stated
    explicitly here even though upstream never writes it. Upstream loads every
    texture through one shared `TextureLoader` wrapper that assigns
    `SRGBColorSpace` at load time, so "untouched" in `digital-numbers/index.ts`
    means sRGB. three's own TextureLoader defaults to NoColorSpace, so leaving
    it alone would render the digits in the wrong colour space. Only
    `generateMipmaps` is switched off, exactly as upstream does: the tiles are
    tiny on screen and the atlas' cell borders must not bleed.
  */
  numbersBitmap.generateMipmaps = false;
  numbersBitmap.colorSpace = THREE.SRGBColorSpace;
  numbersBitmap.needsUpdate = true;

  /* ------------------------------------------------------------------
     Materials
     ------------------------------------------------------------------ */

  /*
    One material for both the base and the display — see the header. The
    uniforms object is kept as a local reference as well, because three stores
    the same object on the material and the tick writes through it.
  */
  const baseUniforms = {
    uDiffuseMap: { value: diffuseMap as THREE.Texture | null },
    uProgress: { value: 0 },
  };

  const baseMaterial = new THREE.ShaderMaterial({
    transparent: true,
    vertexShader: labBaseVertexShader,
    fragmentShader: labBaseFragmentShader,
    uniforms: baseUniforms,
  });

  base.material = baseMaterial;
  display.material = baseMaterial;

  const electricUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
  };

  const electricMaterial = new THREE.ShaderMaterial({
    transparent: true,
    vertexShader: labElectricVertexShader,
    fragmentShader: labElectricFragmentShader,
    uniforms: electricUniforms,
  });

  electric.material = electricMaterial;

  /*
    The shine is the one material with depth state changed. `depthTest: false`
    and `depthWrite: false` on a double-sided mesh turn it into a glow pass that
    ignores the scene's depth entirely — which is why it is submitted last (see
    the render orders below) rather than being sorted by depth like everything
    else. Setting depthTest back to true here would cut the glow off against
    the plinth that it is supposed to wrap around.
  */
  const shineUniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
  };

  const shineMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
    vertexShader: labShineVertexShader,
    fragmentShader: labShineFragmentShader,
    uniforms: shineUniforms,
  });

  shine.material = shineMaterial;

  /*
    Draw order, copied from `lab/index.ts`. This act leans on renderOrder rather
    than depth because the shine does not depth-test and the plane is a
    transparent sheet that must land between the display and the particles:

        base 20 -> display 21 -> digits 22 / particles 22 -> plane 24
        -> electric 25 -> shine 30
  */
  base.renderOrder = 20;
  display.renderOrder = 21;
  electric.renderOrder = 25;
  shine.renderOrder = 30;

  /* ------------------------------------------------------------------
     The particle column
     ------------------------------------------------------------------ */

  /*
    The attributes are seeded exactly as `lab/particles.ts` seeds them: a random
    angle and radius on the base disc, a 0..4 phase offset so the particles are
    not in lockstep, a 0.7..1.3 speed multiplier, a small horizontal drift that
    grows with height in the shader, three noise seeds to decorrelate the wobble,
    and a 0.6..1.4 size multiplier.

    BOTTOM_RADIUS is 1.0 here while the vertex shader defines it as .4. That
    mismatch is upstream and is preserved on purpose (see lab-shaders.ts): the
    shader divides the stored radius by .4, so a particle seeded at the rim of
    this 1.0 disc starts at 2.5x the cone's nominal base radius. Narrowing this
    to .4 would close the bottom of the column and change the silhouette.
  */
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const offsets = new Float32Array(PARTICLE_COUNT); // Offset for animation timing
  const angles = new Float32Array(PARTICLE_COUNT); // Initial angle
  const radii = new Float32Array(PARTICLE_COUNT); // Initial radius at bottom
  const speeds = new Float32Array(PARTICLE_COUNT); // Individual speed multiplier
  const drifts = new Float32Array(PARTICLE_COUNT * 2); // Horizontal drift (x, z)
  const noiseOffsets = new Float32Array(PARTICLE_COUNT * 3); // Noise offsets for organic movement
  const sizes = new Float32Array(PARTICLE_COUNT); // Individual size multiplier

  // Upstream's own blue, picked to match the shine's #define COLOR.
  const blueColor = new THREE.Color(0.1, 0.808, 1.0);

  const BOTTOM_RADIUS = 1.0;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    // Random angle and radius for circular distribution at bottom
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * BOTTOM_RADIUS;

    // Store initial angle and radius
    angles[i] = angle;
    radii[i] = radius;

    // Start at bottom of cone
    positions[i3] = Math.cos(angle) * radius; // x
    positions[i3 + 1] = 0.0; // y (start at bottom)
    positions[i3 + 2] = Math.sin(angle) * radius; // z

    // Random offset for animation timing (so particles don't all start together)
    offsets[i] = Math.random() * 4.0; // Wider range for more variation

    // Individual speed multiplier (0.7 to 1.3 for variation)
    speeds[i] = 0.7 + Math.random() * 0.6;

    // Horizontal drift (small random offsets)
    const driftAmount = 0.3;
    drifts[i * 2] = (Math.random() - 0.5) * driftAmount; // x drift
    drifts[i * 2 + 1] = (Math.random() - 0.5) * driftAmount; // z drift

    // Noise offsets for organic movement variation
    noiseOffsets[i * 3] = Math.random() * 100.0; // x noise offset
    noiseOffsets[i * 3 + 1] = Math.random() * 100.0; // y noise offset
    noiseOffsets[i * 3 + 2] = Math.random() * 100.0; // z noise offset

    // Individual size multiplier (0.6 to 1.4 for organic variation)
    sizes[i] = 0.6 + Math.random() * 0.8;

    // Blue with varying intensities
    const intensity = 0.5 + Math.random() * 0.5; // 0.5 to 1.0 for intensity variation
    const color = blueColor.clone().multiplyScalar(intensity);

    // Add slight hue variation for more organic feel
    const hueVariation = 0.05;
    color.r += (Math.random() - 0.5) * hueVariation;
    color.g += (Math.random() - 0.5) * hueVariation;
    color.b += (Math.random() - 0.5) * hueVariation;
    color.r = Math.max(0.0, Math.min(1.0, color.r));
    color.g = Math.max(0.0, Math.min(1.0, color.g));
    color.b = Math.max(0.0, Math.min(1.0, color.b));

    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  // `color` is declared by three, not by the shader: `vertexColors: true` below
  // is what injects it, and the vertex program just writes it to vColor.
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("offset", new THREE.BufferAttribute(offsets, 1));
  geometry.setAttribute("angle", new THREE.BufferAttribute(angles, 1));
  geometry.setAttribute("radius", new THREE.BufferAttribute(radii, 1));
  geometry.setAttribute("speed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("drift", new THREE.BufferAttribute(drifts, 2));
  geometry.setAttribute("noiseOffset", new THREE.BufferAttribute(noiseOffsets, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const particleUniforms = {
    uTime: { value: 0 },
    uScaleMultiplier: { value: 1.0 },
  };

  const particleMaterial = new THREE.ShaderMaterial({
    vertexShader: labParticlesVertexShader,
    fragmentShader: labParticlesFragmentShader,
    uniforms: particleUniforms,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  });

  /*
    `frustumCulled = false` because the shader moves the points far outside the
    bounding sphere computed from the seed positions — they all start flat on
    the base disc and the cone is built on the GPU, so the geometry's bounds are
    a single disc while the visible column is five units tall. Culling against
    those bounds pops the whole column out of view as the camera turns.
  */
  const particles: THREE.Points = new THREE.Points(geometry, particleMaterial);
  particles.renderOrder = 22;
  particles.frustumCulled = false;

  /* ------------------------------------------------------------------
     Assembly
     ------------------------------------------------------------------ */

  const group = new THREE.Group();
  group.add(base, display, electric, shine);
  /*
    Upstream's static seat for the act, pinned by the about transition to
    z = 6 in both landscape and portrait. The caller may move it.
  */
  group.position.set(0, 0, 6);

  /*
    The hologram strip: a 1.5 x 1 plane laid flat. `rotateX(-PI/2)` is what
    makes the strip a floor-level sheet the digits and the column rise through,
    rather than a poster standing up behind them — and it is why the per-frame
    scale is applied to `scale.x` alone (see `update`).
  */
  const planeGeometry = new THREE.PlaneGeometry(1.5, 1);
  planeGeometry.rotateX(-Math.PI / 2);

  const planeMaterial = new THREE.MeshBasicMaterial({
    map: hologramPlaneTexture,
    transparent: true,
    opacity: 1,
  });

  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.renderOrder = 24;
  /*
    The strip is left in upstream's construction state — opacity 1, at y = 0 —
    and only corrected by the first `update`. Upstream can rely on its ticker
    running before the first paint; here `createLab` is awaited during setup, so
    the caller's render loop starts after this resolves and the first frame it
    draws already carries the applied state. If that ever stops being true, set
    `opacity = 0` and `visible = false` here rather than special-casing `update`.
  */
  group.add(plane);

  const numbers = new DigitalNumbers({
    count: 3,
    parent: group,
    position: new THREE.Vector3(0, -0.23, 1.07),
    scale: 0.17,
    renderOrder: 22,
    color: new THREE.Color("#bae9ff"),
    texture: numbersBitmap,
  });
  // Upstream calls this immediately after construction; it cannot do anything
  // (see the DigitalNumbers doc), but it is kept so the port reads the same.
  numbers.updateFrames(0);

  return {
    group,
    particles,

    update(opts) {
      const { progress, time } = opts;
      const hologramProgress = opts.hologramProgress ?? 0;
      const electricOpacity = opts.electricOpacity ?? 0;
      const landscape = opts.landscape ?? prefersLandscape();

      // The ring pulse on the base AND the screen inside it, from one uniform.
      baseUniforms.uProgress.value = progress;

      shineUniforms.uTime.value = time;
      shineUniforms.uProgress.value = progress;

      electricUniforms.uTime.value = time;
      electricUniforms.uOpacity.value = electricOpacity;

      particleUniforms.uTime.value = time;
      /*
        The column widens as the act advances — 0.75x at the start, 1.0x at the
        end. This is a uniform rather than a group scale on purpose: the glow
        and the point sprites scale without dragging the projector geometry
        along with them.
      */
      particleUniforms.uScaleMultiplier.value = 0.75 + 0.25 * progress;

      /*
        Upstream's only link between the Points and the group: they live in
        different scenes, so the transform cannot be inherited and has to be
        copied — and it copies position only, not rotation or scale, which is
        why the lab group must not be rotated if the column is to stay centred.
      */
      particles.position.copy(group.position);

      display.visible = landscape;

      /* --- hologram strip ------------------------------------------- */

      const yPosition = START_Y + hologramProgress * (END_Y - START_Y);
      // The extra 0.01 lifts the strip clear of the plinth's top face. Flat,
      // coplanar geometry z-fights, and this is upstream's whole fix.
      plane.position.y = yPosition + 0.01;

      // Calculate opacity based on progress - fade in and out
      let opacity = 0;
      if (hologramProgress <= FADE_IN_START) {
        // Before FADE_IN_START: opacity 0
        opacity = 0;
      } else if (hologramProgress <= FADE_IN_END) {
        // Fade in phase: 0.2 to 0.3
        const fadeInProgress = (hologramProgress - FADE_IN_START) / (FADE_IN_END - FADE_IN_START);
        opacity = fadeInProgress;
      } else if (hologramProgress <= FADE_OUT_START) {
        // Fully visible phase: 0.3 to 0.7
        opacity = 1;
      } else if (hologramProgress <= FADE_OUT_END) {
        // Fade out phase: 0.7 to 1.0
        const fadeOutProgress = (hologramProgress - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START);
        opacity = 1 - fadeOutProgress;
      } else {
        // After FADE_OUT_END: opacity 0
        opacity = 0;
      }

      // Calculate scale - fade between 0 (scale=1), 0.5 (scale=1.5) and 1 (scale=1)
      let scale = 1;
      if (hologramProgress <= 0.5) {
        // From 0 to 0.5: scale from 1 to 1.5
        scale = 1 + (hologramProgress / 0.5) * 0.5;
      } else {
        // From 0.5 to 1: scale from 1.5 back to 1
        scale = 1.5 - ((hologramProgress - 0.5) / 0.5) * 0.5;
      }

      /*
        X only. The plane was rotated flat, so its local X is the strip's width
        and its local Z is the strip's depth (the 1-unit side, which points at
        the camera). Scaling both would stretch the strip toward the viewer as
        well as sideways and read as a sheet flying at the lens rather than a
        projection swelling.
      */
      plane.scale.x = scale;
      planeMaterial.opacity = opacity;

      // A fully transparent mesh still costs a draw call, so it is culled here
      // rather than left to the blend stage.
      plane.visible = opacity > 0;

      /* --- digits --------------------------------------------------- */

      numbers.visible = landscape;
      /*
        The readout is the act's own progress as a percentage, floored so the
        digits tick over rather than blur. Driven by `progress`, not by
        `hologramProgress`: the strip's animation and the counter are two
        different clocks upstream, and the counter is the act's.
      */
      numbers.updateFrames(Math.floor(progress * 100));
    },

    dispose() {
      // The Points are in a scene this module never saw; removeFromParent is the
      // only handle it has, and it works whatever the caller added them to.
      particles.removeFromParent();
      geometry.dispose();
      particleMaterial.dispose();

      numbers.dispose();

      planeGeometry.dispose();
      planeMaterial.dispose();

      // base and display share one material, so it is disposed once.
      baseMaterial.dispose();
      electricMaterial.dispose();
      shineMaterial.dispose();

      diffuseMap.dispose();
      hologramPlaneTexture.dispose();
      numbersBitmap.dispose();

      // The GLB's geometries were created by the loader for this handle, so they
      // go with it. Upstream never frees them.
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });

      group.clear();
    },
  };
}
