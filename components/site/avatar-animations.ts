/**
 * The avatar's animation state machine — upstream's `objects/avatar/animations.ts`
 * with `objects/avatar/face.ts` and the `objects/avatar/left-desktop.ts` trigger
 * cadence folded in.
 *
 * Ported from the interactive portfolio at github.com/davidhckh/portfolio-2025 by
 * David Heckhoff, licensed CC BY-NC-SA 4.0. Original: https://david-hckh.com
 *
 * Why this is a reimplementation and not a copy
 * ---------------------------------------------
 * Upstream owns the frame loop. `animations.init()` builds two `AnimationMixer`s,
 * registers a `gsap.ticker.add(tick)` and expresses everything that has a
 * beginning and an end as a GSAP timeline or a `gsap.delayedCall`: the intro wave,
 * the blink cycle, the wake-up crossfade, the left-desktop trigger, and the tick
 * itself. This port's caller owns the frame loop (`scroll-sequence.tsx` calls
 * `avatar.update(delta, ...)`), so **nothing here imports gsap, starts a timer or
 * schedules anything**. Every timed behaviour is explicit elapsed-time state that
 * advances by the `time` argument of `update()`, which is what lets the caller
 * stop the animation by passing a zero delta (reduced motion) instead of having
 * clips keep running behind a frozen mixer.
 *
 * The timelines, mapped
 * ---------------------
 * | upstream (gsap)                                                     | here |
 * |---------------------------------------------------------------------|------|
 * | `update()` -> `gsap.ticker.deltaRatio(60) / 60` for the mixer delta  | caller's `time` deltas, clamped to 1/30 s (see `MAX_DELTA` — gsap's `lagSmoothing` caps a stall at 33 ms, this caps it the same way) |
 * | `wave()` timeline: `face.wave()` at 0, `fromTo(wavingStrength) at 2.5083` | `advanceWave()` / `advanceFaceWave()`, driven by `waveElapsed` |
 * | `face.scheduleBlinkInterval`: `delayedCall(3 + random * 3)`          | `advanceBlink()` countdown, self-rescheduling before it blinks |
 * | `blink()` timeline: 2 sequential tweens, 0.12 s + 0.2 s             | `blinkPhase` 1 / 2 with `power2Out` reproduced by hand |
 * | `wakeUp()`'s `setTimeout(..., wakeUpDuration * 1000)`               | `wakeUpTimer` countdown |
 * | `face.wakeUp()` timeline: sets at 0 / 0.4 / 0.43 / 0.46            | `faceWakeElapsed` thresholds |
 * | `left-desktop.ts`: `delayedCall(calcDelay())` + a 4.9917 s timeline | `leftDesktopTimer` + `leftDesktopElapsed` |
 *
 * Two upstream quirks are reproduced deliberately and are called out in comments
 * where they live: `tl.fromTo(..., waveDuration - 0.2)` is a timeline *position*
 * (so the fade is gsap's default 0.5 s, not 2.5 s), and the per-frame `.weight`
 * writes in `updateIntro()` / `updateContact()` cancel every `crossFadeTo()` fade
 * on the following frame, because three's `AnimationAction.weight` setter calls
 * `stopFading()`.
 *
 * What is not carried over
 * ------------------------
 * The sound layer (`playSound("gasp")`, the looping keyboard howl, `stopSnoreRepetition()`)
 * and `sleepingSprite.hide()`: this site has no audio on a route the visitor did
 * not ask to make noise on, and the contact scene's floating sprite does not exist
 * in this port. Nothing else about the state machine is dropped.
 */

import * as THREE from "three";

/* -------------------------------------------------------------------------- */
/* Face atlas                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Upstream `face.ts`'s `FRAME_INDEXES`, verbatim: the 4x4 expression atlas in
 * `face-spritesheet.png`, indexed by tile. Indices 5, 6, 7 and 11 are blank tiles
 * upstream never selects; they are kept so the numbering matches the atlas.
 */
export const FACE_FRAME_INDEXES = {
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
} as const;

export type FaceFrameName = keyof typeof FACE_FRAME_INDEXES;

/** Upstream `face.ts`: `delayedCall(3 + Math.random() * 3)`. */
const BLINK_MIN_INTERVAL = 3;
const BLINK_RANDOM_INTERVAL = 3;

/** Upstream `face.ts` blink tweens: `to(3, 0.12)` then `to(0, 0.2)`. */
const BLINK_CLOSE_DURATION = 0.12;
const BLINK_OPEN_DURATION = 0.2;

/** Upstream `face.ts`: `RESET_AFTER = 3` in `face.wave()`. */
const FACE_WAVE_RESET_AFTER = 3;

/** Upstream `face.wakeUp()`: `set` positions 0 / 0.4 / 0.43 / 0.46. */
const FACE_WAKE_STEP_1 = 0.4;
const FACE_WAKE_STEP_2 = 0.43;
const FACE_WAKE_STEP_3 = 0.46;

/** Upstream `left-desktop.ts`: `INTERVAL_DURATION = 7`. */
const LEFT_DESKTOP_INTERVAL = 7;
/** Upstream's `playAnimation` is inserted into its timeline at 0.2 s. */
const LEFT_DESKTOP_PLAY_AT = 0.2;
/** Upstream passes `0.3` as the crossfade for both left-desktop transitions. */
const LEFT_DESKTOP_TRANSITION = 0.3;

/**
 * GSAP's default tween duration (`gsap.defaults().duration === 0.5`). The wave's
 * `wavingStrength` fade uses it because upstream passes the fade's *position*
 * where a duration would go — see `wave()`.
 */
const GSAP_DEFAULT_DURATION = 0.5;

/**
 * The frame delta is clamped, and the clamp is load-bearing rather than
 * defensive: upstream's clock is `gsap.ticker.deltaRatio(60)`, and gsap's
 * `lagSmoothing(500, 33)` reports a 33 ms step after a stall longer than 500 ms
 * instead of the real gap. Without the same cap, returning to a backgrounded tab
 * would teleport the blink timer and the left-desktop cadence forward by however
 * long the tab was hidden.
 */
const MAX_DELTA = 1 / 30;

/** GSAP `power1.out` — `quad.out`, which is gsap's *default* ease. */
const power1Out = (p: number) => 1 - (1 - p) * (1 - p);

/** GSAP `power2.out` — `cubic.out`, used by both blink tweens. */
const power2Out = (p: number) => 1 - Math.pow(1 - p, 3);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/* -------------------------------------------------------------------------- */
/* Factory                                                                     */
/* -------------------------------------------------------------------------- */

export type AvatarAnimationWeights = {
  /** Upstream `avatar.tIdleIntensity.value` — the `t-idle` (typing) blend. */
  tIdleIntensity: number;
  /**
   * Upstream `wavingStrength.value`. Omit it and the handle's own wave timeline
   * drives it, which is what upstream does (`wave()` is the only writer). Pass it
   * only if the caller wants to own that scalar itself; the internal timeline
   * keeps running either way, so `wave()`'s face change still happens.
   */
  wavingStrength?: number;
  /** Upstream `sceneWeights.contact` — switches the whole state machine. */
  contact?: number;
  /** Upstream `sceneWeights.about` — forces the face to `default-0` above 0.1. */
  about?: number;
  /** Upstream `sceneWeights.hero` — the left-desktop trigger needs > 0.95. */
  hero?: number;
  /** Upstream `sizes.visible` — a hidden tab skips the left-desktop trigger. */
  visible?: boolean;
};

export type AvatarAnimationsOptions = {
  /** The loaded avatar root — the mixer is rooted here. */
  mesh: THREE.Object3D;
  /**
   * The hologram `SkinnedMesh`, if one was built. Optional on purpose: upstream
   * dereferences `avatarHologram.getMesh()` unconditionally and `play()` then
   * throws for any key the hologram map lacks, so a port that drops the hologram
   * falls over on its first `play()`. Supporting `null` is the sensible reading
   * of that (see `play()`).
   */
  hologramMesh?: THREE.Object3D | null;
  /** `gltf.animations` — upstream's `resources.items["avatar-model"].animations`. */
  clips: readonly THREE.AnimationClip[];
  /**
   * The face material's uniform object, so the atlas frame selected upstream by
   * `face.tick()` lands on the material this port already built.
   */
  faceUniforms?: { uFrame: { value: number } };
};

export type AvatarAnimationsHandle = {
  /**
   * Renders one frame. `time` is a monotonic clock in seconds owned by the
   * caller; only its deltas are used, so any origin works.
   */
  update: (time: number, weights: AvatarAnimationWeights) => void;
  /** Upstream `play(name, transition)`. `transition` is a crossfade in seconds. */
  play: (name: string, transition?: number) => void;
  /** Upstream `wave()` — plays the intro wave and starts its fade timeline. */
  wave: () => void;
  /** Upstream `wakeUp()` — crossfades the sleeping pose into the contact idle. */
  wakeUp: () => void;
  /** The primary mixer's actions, keyed exactly as upstream keys them. */
  actions: Map<string, THREE.AnimationAction>;
  /** The hologram mixer's actions — a strict subset, as upstream builds it. */
  hologramActions: Map<string, THREE.AnimationAction>;
  getIsAwake: () => boolean;
  /** Upstream `leftDesktop.getIsActive()`. */
  getIsLeftDesktopActive: () => boolean;
  /** Upstream's module-level `activeAction`. */
  getActiveAction: () => string | null;
  /** The tile index currently written to the face material's `uFrame`. */
  getFaceFrame: () => number;
  dispose: () => void;
};

export function createAvatarAnimations({
  mesh,
  hologramMesh = null,
  clips,
  faceUniforms,
}: AvatarAnimationsOptions): AvatarAnimationsHandle {
  const clipsByName = new Map(clips.map((clip) => [clip.name, clip]));

  /**
   * Upstream's `getActionFromMesh`: an animation clip that is missing from the
   * GLB is a build error, not a degrade-quietly case, because every weight in
   * `updateIntro()` / `updateContact()` names one of these clips.
   */
  const getClip = (name: string): THREE.AnimationClip => {
    const clip = clipsByName.get(name);
    if (!clip) throw new Error(`[AvatarAnimations] Action not found: ${name}`);
    return clip;
  };

  const mixer = new THREE.AnimationMixer(mesh);
  const actions = new Map<string, THREE.AnimationAction>();
  const hologramMixer = hologramMesh ? new THREE.AnimationMixer(hologramMesh) : null;
  const hologramActions = new Map<string, THREE.AnimationAction>();

  let activeAction: string | null = null;
  let isAwake = false;

  /* ---- wave state (upstream: the `wave()` timeline) ---- */
  /**
   * Upstream starts at `1` (`wavingStrength = { value: isFeatureEnabled("introWave") ? 1 : 0 }`,
   * and `features.introWave` is on), and the `fromTo`'s `immediateRender` snaps it
   * back to 1 at timeline start, so 1 is also the value while the wave plays out.
   * If the caller overrides `wavingStrength` per frame, this is the fallback.
   */
  let wavingStrength = 1;
  let waveActive = false;
  let waveElapsed = 0;
  /** `waveDuration - 0.2`: where the fade *starts*. */
  let waveFadeStart = 0;
  /** The whole timeline's length: `max(3, waveFadeStart + 0.5)`. */
  let waveTimelineDuration = 0;

  /* ---- face state (upstream: `face.ts` module state) ---- */
  /**
   * The tile index written to the face material. Annotated `number` rather than
   * inferred: `FACE_FRAME_INDEXES` is `as const`, so the initial read is the
   * literal type `0` and the resolved frame would not be assignable to it.
   */
  let faceFrame: number = FACE_FRAME_INDEXES["default-0"];
  let introFrame: FaceFrameName = "default-0";
  let contactFrame: FaceFrameName = "sleeping";
  /** Upstream `blinkFrame.value`, 0..3, continuous between the two tweens. */
  let blinkFrame = 0;
  let blinkPhase: 0 | 1 | 2 = 0;
  let blinkPhaseElapsed = 0;
  /** The self-rescheduling interval, seeded at construction as upstream seeds it. */
  let blinkTimer = BLINK_MIN_INTERVAL + Math.random() * BLINK_RANDOM_INTERVAL;
  /** `face.wakeUp()`'s timeline: null when it is not running. */
  let faceWakeElapsed: number | null = null;

  /* ---- wake-up state (upstream: the `setTimeout`) ---- */
  /** Seconds until the wake-up pose crossfades into the contact idle; < 0 = idle. */
  let wakeUpTimer = -1;

  /* ---- left-desktop state (upstream: `left-desktop.ts`) ---- */
  const leftDesktopDuration = getClip("left-desktop").duration;
  /**
   * `Math.floor(7 + Math.random() * 6 + clip.duration)`. With this GLB's
   * 4.791666666666667 s clip that is 11..17 whole seconds.
   */
  const calcLeftDesktopDelay = () =>
    Math.floor(LEFT_DESKTOP_INTERVAL + Math.random() * 6 + leftDesktopDuration);
  /** Upstream's timeline `duration: clip.duration + 0.2`. */
  const leftDesktopTimelineDuration = leftDesktopDuration + 0.2;
  let leftDesktopTimer = calcLeftDesktopDelay();
  /** Elapsed seconds inside the left-desktop timeline; null when it is not running. */
  let leftDesktopElapsed: number | null = null;
  let leftDesktopPlayed = false;

  /* ---- frame clock ---- */
  let lastTime: number | null = null;

  /* ------------------------------------------------------------------------ */
  /* Action setup — upstream `setupActions()` / `setupHologramActions()`       */
  /* ------------------------------------------------------------------------ */

  /*
    Both tables are reproduced assignment by assignment, including the loop modes
    upstream never sets. three's `AnimationAction` defaults are
    `loop = LoopRepeat`, `repetitions = Infinity`, `clampWhenFinished = false`,
    `weight = 1`, so "not set upstream" is a real value, not an omission:
    `left-desktop` and `wake-up` are `LoopRepeat` with one repetition plus
    `clampWhenFinished` (a one-shot that holds its last frame), and `wake-up`,
    `contact-idle` and `wave` never get a weight written, so they sit at 1 until
    `updateIntro()` / `updateContact()` overwrite it on the first frame.
  */
  const setupActions = () => {
    // idle
    const desktopIdle = mixer.clipAction(getClip("idle"));
    desktopIdle.loop = THREE.LoopPingPong;
    actions.set("desktop-idle", desktopIdle);
    desktopIdle.weight = 1;

    // t-idle
    const tIdle = mixer.clipAction(getClip("t-idle"));
    tIdle.loop = THREE.LoopPingPong;
    actions.set("t-idle", tIdle);
    tIdle.weight = 0;
    tIdle.play();

    // left-desktop — loop deliberately left at three's default (LoopRepeat)
    const leftDesktop = mixer.clipAction(getClip("left-desktop"));
    leftDesktop.repetitions = 1;
    leftDesktop.clampWhenFinished = true;
    actions.set("left-desktop", leftDesktop);
    leftDesktop.weight = 0;

    // sleeping
    const sleeping = mixer.clipAction(getClip("sleeping"));
    sleeping.loop = THREE.LoopPingPong;
    actions.set("sleeping", sleeping);
    sleeping.weight = 1;
    sleeping.play();

    // wake-up — loop left at the default; weight never set upstream (default 1)
    const wake = mixer.clipAction(getClip("wake-up"));
    wake.repetitions = 1;
    wake.clampWhenFinished = true;
    actions.set("wake-up", wake);

    // contact-idle — weight never set upstream (default 1)
    const contactIdle = mixer.clipAction(getClip("contact-idle"));
    contactIdle.loop = THREE.LoopPingPong;
    actions.set("contact-idle", contactIdle);

    // wave — weight never set upstream (default 1)
    const wave = mixer.clipAction(getClip("wave"));
    wave.clampWhenFinished = true;
    wave.loop = THREE.LoopOnce;
    actions.set("wave", wave);
  };

  /*
    The hologram map is a strict subset: no sleeping, no wake-up, no contact-idle.
    That asymmetry is upstream's, and it is why `setWeight()` has to tolerate a
    missing hologram action and why `play()` cannot simply require both maps.
  */
  const setupHologramActions = () => {
    if (!hologramMixer) return;

    // idle
    const desktopIdle = hologramMixer.clipAction(getClip("idle"));
    desktopIdle.loop = THREE.LoopPingPong;
    hologramActions.set("desktop-idle", desktopIdle);
    desktopIdle.weight = 1;
    desktopIdle.play();

    // t-idle
    const tIdle = hologramMixer.clipAction(getClip("t-idle"));
    tIdle.loop = THREE.LoopPingPong;
    hologramActions.set("t-idle", tIdle);
    tIdle.weight = 0;
    tIdle.play();

    // left-desktop — loop left at the default, as upstream
    const leftDesktop = hologramMixer.clipAction(getClip("left-desktop"));
    leftDesktop.repetitions = 1;
    leftDesktop.clampWhenFinished = true;
    hologramActions.set("left-desktop", leftDesktop);
    leftDesktop.weight = 0;

    // wave
    const wave = hologramMixer.clipAction(getClip("wave"));
    wave.clampWhenFinished = true;
    wave.loop = THREE.LoopOnce;
    hologramActions.set("wave", wave);
  };

  /* ------------------------------------------------------------------------ */
  /* play / setWeight                                                          */
  /* ------------------------------------------------------------------------ */

  /**
   * Upstream `play()` — but the "both maps must have the key" `throw` is narrowed
   * to the primary map.
   *
   * Upstream throws when either map is missing the key. In practice it only ever
   * calls `play()` with `desktop-idle`, `left-desktop` (and externally `t-idle` /
   * `wave`) — all four of which exist in both maps — so the hologram half of that
   * check can only ever fire for a key the hologram is *designed* not to have
   * (`sleeping`, `wake-up`, `contact-idle`). Narrowing it means a caller can
   * `play("contact-idle")` and get the primary mixer switching with no hologram
   * counterpart, instead of a crash. A key missing from the primary map still
   * throws, because that is a genuine bug — the name is a typo or the clip is gone.
   */
  const play = (name: string, transition = 0.5) => {
    if (activeAction === name) return;
    const newAction = actions.get(name);
    if (!newAction) throw new Error(`[AvatarAnimations] Action not found: ${name}`);
    const newHologramAction = hologramActions.get(name);

    newAction.reset().play();
    if (newHologramAction) newHologramAction.reset().play();

    if (activeAction) {
      const currentAction = actions.get(activeAction);
      if (currentAction) currentAction.crossFadeTo(newAction, transition);

      const currentHologramAction = hologramActions.get(activeAction);
      if (currentHologramAction && newHologramAction) {
        currentHologramAction.crossFadeTo(newHologramAction, transition);
      }
    }

    activeAction = name;
  };

  /**
   * Upstream `setWeight()`: one key fans out to both mixers, and a key the target
   * map does not have is silently skipped. That skip is what keeps
   * `setWeight("sleeping", 0)` from being an error while the hologram is on screen.
   */
  const setWeight = (key: string, weight: number) => {
    const action = actions.get(key);
    if (action) action.weight = weight;
    const hologramAction = hologramActions.get(key);
    if (hologramAction) hologramAction.weight = weight;
  };

  /* ------------------------------------------------------------------------ */
  /* The three driving formulas — upstream `updateIntro` / `updateContact`     */
  /* ------------------------------------------------------------------------ */

  const updateIntro = (tIdleIntensity: number, waving: number) => {
    setWeight("desktop-idle", (1 - tIdleIntensity) * (1 - waving));
    setWeight("left-desktop", (1 - tIdleIntensity) * (1 - waving));
    setWeight("t-idle", tIdleIntensity);
    setWeight("sleeping", 0);
    setWeight("contact-idle", 0);
    setWeight("wake-up", 0);
    setWeight("wave", waving * (1 - tIdleIntensity));
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

  /* ------------------------------------------------------------------------ */
  /* The wave                                                                  */
  /* ------------------------------------------------------------------------ */

  /**
   * Upstream `wave()`:
   *
   *   waveAction.play();
   *   hologramWaveAction?.play();
   *   tl.add(face.wave());                                          // position 0
   *   tl.fromTo(wavingStrength, {value:1}, {value:0}, waveDuration - 0.2);
   *
   * That fourth argument is the timeline **position**, not a duration — the
   * single most misreadable line in the avatar system. So the fade is gsap's
   * default 0.5 s long and starts at `waveDuration - 0.2` = 2.5083333 s, holding
   * `1` until then, and it ends at 3.0083333 s. The timeline's total length is
   * therefore `max(3, 3.0083333)` = 3.0083333 s, *longer than the 2.7083333 s
   * wave clip*. Reproduced exactly: `waveFadeStart` and `waveTimelineDuration`
   * below carry those two numbers.
   *
   * The `face.wave()` half sets the intro face to `proud-0` at 0 and back to
   * `default-0` at 3 s (see `advanceFaceWave`).
   *
   * `AnimationAction.play()` is a resume, not a reset, so a second `wave()` would
   * not rewind the clip upstream (only `play()` — the function above — resets).
   * This port restarts only the *timeline* clock, which matches that.
   */
  const wave = () => {
    const waveAction = actions.get("wave");
    const hologramWaveAction = hologramActions.get("wave");
    if (!waveAction) return;

    const waveDuration = waveAction.getClip().duration;

    waveFadeStart = waveDuration - 0.2;
    waveTimelineDuration = Math.max(FACE_WAVE_RESET_AFTER, waveFadeStart + GSAP_DEFAULT_DURATION);
    waveElapsed = 0;
    waveActive = true;
    // fromTo's `immediateRender` snaps to the "from" value at timeline start.
    wavingStrength = 1;

    waveAction.play();
    hologramWaveAction?.play();

    // tl.add(face.wave())
    introFrame = "proud-0";
  };

  /**
   * `wavingStrength` over the wave timeline: hold 1, then `1 -> 0` from
   * `waveFadeStart` with gsap's default 0.5 s duration and default ease
   * (`quad.out`). `1 - power1Out(u)` is that ease applied to a 1 -> 0 tween.
   */
  const advanceWave = (delta: number) => {
    if (!waveActive) return;

    waveElapsed += delta;

    if (waveElapsed <= waveFadeStart) {
      wavingStrength = 1;
    } else {
      const progress = Math.min(1, (waveElapsed - waveFadeStart) / GSAP_DEFAULT_DURATION);
      wavingStrength = 1 - power1Out(progress);
    }

    if (waveElapsed >= waveTimelineDuration) {
      waveActive = false;
      wavingStrength = 0;
    }
  };

  /**
   * `face.wave()`: `set(intro: "proud-0", 0)` then `set(intro: "default-0", 3)`.
   *
   * This is checked against `waveElapsed` and not against `waveActive`, because a
   * single frame can step past both 3 s and the timeline's 3.0083333 s end; the
   * 3 s reset must still land on that frame.
   */
  const advanceFaceWave = () => {
    if (introFrame === "proud-0" && waveElapsed >= FACE_WAVE_RESET_AFTER) {
      introFrame = "default-0";
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Blinking — upstream `face.ts`                                             */
  /* ------------------------------------------------------------------------ */

  /** Upstream `canBlink()`, verbatim — it tests the *stored* names, not the tick's. */
  const canBlink = (contact: number) => {
    const isContact = contact > 0.001;
    if (isContact) {
      if (contactFrame.startsWith("proud")) return true;
    } else if (introFrame.startsWith("default")) {
      return true;
    }
    return false;
  };

  /** Upstream `blink()`: a gate and then two tweens on `blinkFrame`. */
  const blink = (contact: number) => {
    if (!canBlink(contact)) return;
    blinkPhase = 1;
    blinkPhaseElapsed = 0;
  };

  /**
   * Upstream `scheduleBlinkInterval()` + `blink()` + the two tweens, as one
   * elapsed-time step.
   *
   * The interval re-schedules *before* it blinks and does so whether or not
   * `blink()` is allowed to run, so a blink suppressed by `canBlink()` still
   * consumes its 3..6 s slot — the next one is still 3..6 s after the suppressed
   * one, never sooner.
   *
   * The phase tween is advanced *before* the timer is tested, so a blink that
   * starts this frame is at `blinkFrame = 0` for it. gsap behaves the same way:
   * a `delayedCall` callback that builds a timeline does not render that timeline
   * until the following tick.
   *
   * Overlapping blinks cannot happen (3 s minimum interval, 0.32 s tween), so a
   * restart of the phase machine is equivalent to gsap layering a second pair of
   * tweens on the same property, and simpler.
   */
  const advanceBlink = (delta: number, contact: number) => {
    if (blinkPhase === 1) {
      blinkPhaseElapsed += delta;
      const progress = Math.min(1, blinkPhaseElapsed / BLINK_CLOSE_DURATION);
      blinkFrame = 3 * power2Out(progress);
      if (progress >= 1) {
        blinkFrame = 3;
        blinkPhase = 2;
        blinkPhaseElapsed = 0;
      }
    } else if (blinkPhase === 2) {
      blinkPhaseElapsed += delta;
      const progress = Math.min(1, blinkPhaseElapsed / BLINK_OPEN_DURATION);
      blinkFrame = 3 * (1 - power2Out(progress));
      if (progress >= 1) {
        blinkFrame = 0;
        blinkPhase = 0;
        blinkPhaseElapsed = 0;
      }
    }

    blinkTimer -= delta;
    if (blinkTimer <= 0) {
      blinkTimer = BLINK_MIN_INTERVAL + Math.random() * BLINK_RANDOM_INTERVAL;
      blink(contact);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Wake-up — upstream `wakeUp()` and `face.wakeUp()`                         */
  /* ------------------------------------------------------------------------ */

  /**
   * Upstream `wakeUp()`, minus the audio and the sleeping sprite.
   *
   * The `setTimeout(..., wakeUpDuration * 1000)` becomes `wakeUpTimer`, counted
   * down in `advanceWakeUp()`. The two `crossFadeTo`s are kept verbatim, including
   * the fact that they are effectively invisible: `updateContact()` writes
   * `weight = 1` to all three actions on the very next frame, and three's weight
   * setter calls `stopFading()`, so sleeping + wake-up + contact-idle end up
   * blending at equal strength. That is upstream's actual behaviour, not a bug
   * this port should silently fix.
   */
  const wakeUp = () => {
    if (isAwake) return;
    isAwake = true;

    const sleepingAction = actions.get("sleeping");
    const wakeUpAction = actions.get("wake-up");
    const contactIdleAction = actions.get("contact-idle");
    if (!sleepingAction || !wakeUpAction || !contactIdleAction) return;

    // crossfade to wake-up
    sleepingAction.crossFadeTo(wakeUpAction, 0.2);
    wakeUpAction.play();

    wakeUpTimer = wakeUpAction.getClip().duration;

    /*
      face.wakeUp() first writes "proud-0" and then immediately schedules
      "contact-transition-0" at position 0. Since gsap renders that `set` on the
      next tick, "proud-0" is the live value only for the remainder of the current
      frame — reproduced here by leaving `contactFrame` on "proud-0" until
      `advanceFaceWake()` runs.
    */
    contactFrame = "proud-0";
    faceWakeElapsed = 0;
  };

  /** Upstream's `setTimeout`: crossfade the wake-up pose into the contact idle. */
  const advanceWakeUp = (delta: number) => {
    if (wakeUpTimer < 0) return;
    wakeUpTimer -= delta;
    if (wakeUpTimer > 0) return;
    wakeUpTimer = -1;

    const wakeUpAction = actions.get("wake-up");
    const contactIdleAction = actions.get("contact-idle");
    if (!wakeUpAction || !contactIdleAction) return;

    wakeUpAction.crossFadeTo(contactIdleAction, 0.5);
    contactIdleAction.play();
  };

  /** `face.wakeUp()`'s timeline: sets at 0 / 0.4 / 0.43 / 0.46. */
  const advanceFaceWake = (delta: number) => {
    if (faceWakeElapsed === null) return;
    faceWakeElapsed += delta;

    if (faceWakeElapsed >= FACE_WAKE_STEP_3) {
      contactFrame = "proud-0";
      faceWakeElapsed = null;
    } else if (faceWakeElapsed >= FACE_WAKE_STEP_2) {
      contactFrame = "contact-transition-2";
    } else if (faceWakeElapsed >= FACE_WAKE_STEP_1) {
      contactFrame = "contact-transition-1";
    } else {
      contactFrame = "contact-transition-0";
    }
  };

  /* ------------------------------------------------------------------------ */
  /* left-desktop — upstream `left-desktop.ts`                                 */
  /* ------------------------------------------------------------------------ */

  /**
   * Upstream's `playAnimation` cadence, as state.
   *
   * The next delay is drawn *before* the guard is tested, exactly as upstream
   * reschedules at the top of `playAnimation`, so a skipped trigger does not push
   * the next one out or pull it in. The sequence it starts is a 4.9917 s timeline
   * (clip duration + 0.2) whose only two events this port needs are the
   * `play("left-desktop", 0.3)` at 0.2 s and the `play("desktop-idle", 0.3)` on
   * complete; upstream's `"keyboard"` sound at 1.6 s and its `desktops.showMessage()`
   * / `messagePopup.show()` side effects belong to scenes this port does not have.
   */
  const advanceLeftDesktop = (delta: number, hero: number, visible: boolean) => {
    if (leftDesktopElapsed !== null) {
      leftDesktopElapsed += delta;

      if (!leftDesktopPlayed && leftDesktopElapsed >= LEFT_DESKTOP_PLAY_AT) {
        leftDesktopPlayed = true;
        play("left-desktop", LEFT_DESKTOP_TRANSITION);
      }

      if (leftDesktopElapsed >= leftDesktopTimelineDuration) {
        leftDesktopElapsed = null;
        leftDesktopPlayed = false;
        play("desktop-idle", LEFT_DESKTOP_TRANSITION);
      }
    }

    leftDesktopTimer -= delta;
    if (leftDesktopTimer > 0) return;

    leftDesktopTimer = calcLeftDesktopDelay();

    // upstream: `if (sceneWeights.hero < 0.95 || !sizes.visible) return;`
    if (hero < 0.95 || !visible) return;

    leftDesktopElapsed = 0;
    leftDesktopPlayed = false;
  };

  /* ------------------------------------------------------------------------ */
  /* Face frame selection — upstream `face.tick()`                             */
  /* ------------------------------------------------------------------------ */

  const faceFrameName = (prefix: "default" | "proud"): FaceFrameName =>
    `${prefix}-${Math.round(blinkFrame)}` as FaceFrameName;

  /**
   * Upstream `face.tick()`, branch for branch:
   *   contact & proud      -> `proud-${round(blinkFrame)}`
   *   contact & !proud     -> the literal contact frame (`sleeping`, then
   *                           `contact-transition-*` during the wake-up)
   *   !contact & about>0.1 -> hard `default-0`, so the face is neutral while the
   *                           About act is in view and blinking is invisible
   *   !contact & !about    -> `default-${round(blinkFrame)}`, or the literal intro
   *                           frame (`proud-0` while the wave holds it)
   */
  const resolveFaceFrame = (contact: number, about: number): number => {
    const isContact = contact > 0.001;

    if (isContact) {
      const name = contactFrame.startsWith("proud") ? faceFrameName("proud") : contactFrame;
      return FACE_FRAME_INDEXES[name];
    }

    if (about > 0.1) return FACE_FRAME_INDEXES["default-0"];

    const name = introFrame.startsWith("default") ? faceFrameName("default") : introFrame;
    return FACE_FRAME_INDEXES[name];
  };

  /* ------------------------------------------------------------------------ */
  /* Per-frame update                                                          */
  /* ------------------------------------------------------------------------ */

  const update = (time: number, weights: AvatarAnimationWeights) => {
    /*
      The caller's clock is absolute and may be anything (a page-lifetime
      timestamp, an accumulated elapsed value). Only its deltas matter, and the
      first call after construction contributes zero so that
      `update(0, ...)`-style warm-ups do not jump the timelines.
    */
    let delta = 0;
    if (lastTime === null) {
      lastTime = time;
    } else {
      delta = Math.min(Math.max(time - lastTime, 0), MAX_DELTA);
      lastTime = time;
    }

    const tIdleIntensity = clamp01(weights.tIdleIntensity);
    const contact = weights.contact ?? 0;
    const about = weights.about ?? 0;
    const hero = weights.hero ?? 0;
    const visible = weights.visible ?? true;

    // Timed state first, so this frame's weights see this frame's timeline values.
    advanceWave(delta);
    advanceFaceWave();
    advanceFaceWake(delta);
    advanceWakeUp(delta);
    advanceBlink(delta, contact);

    const waving = clamp01(weights.wavingStrength ?? wavingStrength);

    if (contact > 0.001) {
      updateContact();
    } else {
      updateIntro(tIdleIntensity, waving);
    }

    /*
      The face frame is resolved from the same weights the state machine just
      used. Upstream's ticker order is hologram -> face -> avatar(animations), so
      the face reads the preceding frame's scene weights; that is a one-frame
      difference in a value that is itself scroll-driven and clamped, and this
      port's caller supplies the weights directly rather than through a shared
      ticker, so resolving it here reads the same number.
    */
    faceFrame = resolveFaceFrame(contact, about);
    if (faceUniforms) faceUniforms.uFrame.value = faceFrame;

    advanceLeftDesktop(delta, hero, visible);

    /*
      Upstream: `const delta = gsap.ticker.deltaRatio(60); mixer.update(delta / 60);`
      — i.e. seconds, not frames, and already smoothed by the ticker. `delta` here
      is the caller's delta in seconds under the same clamp.
    */
    mixer.update(delta);
    hologramMixer?.update(delta);
  };

  /* ------------------------------------------------------------------------ */
  /* Init — upstream `animations.init()`                                       */
  /* ------------------------------------------------------------------------ */

  setupActions();
  setupHologramActions();

  play("desktop-idle");
  wave();

  const dispose = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(mesh);
    actions.clear();

    if (hologramMixer && hologramMesh) {
      hologramMixer.stopAllAction();
      hologramMixer.uncacheRoot(hologramMesh);
    }
    hologramActions.clear();
  };

  return {
    update,
    play,
    wave,
    wakeUp,
    actions,
    hologramActions,
    getIsAwake: () => isAwake,
    getIsLeftDesktopActive: () => leftDesktopElapsed !== null,
    getActiveAction: () => activeAction,
    getFaceFrame: () => faceFrame,
    dispose,
  };
}
