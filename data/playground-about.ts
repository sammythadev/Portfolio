/**
 * The write-ups shown inside the Playground's 3D act.
 *
 * Structure and placement are taken from davidhckh/portfolio-2025
 * (`features/home/components/BoxDetails|BoxDescription|BoxServices.vue`):
 * three HTML blocks pinned to three world-space points beside the character, and
 * a progress readout. The *content* is Samuel's — the reference's copy is his own
 * biography and service list, and none of it is reproduced here.
 *
 * The points are upstream's, unchanged. They sit at z = 6.75 beside the avatar's
 * seat at z = 6, offset left and right so the blocks flank the figure rather than
 * covering it. Moving them would break that relationship, so they are not tuned.
 */

export interface AboutPoint {
  /** World-space anchor, matching upstream's `new Vector3(...)` arguments. */
  point: readonly [number, number, number];
}

/** Upstream `BoxDetails.vue`: the name plate. */
export const DETAILS_POINT: AboutPoint = { point: [-0.76, 3.6, 6.75] };

/** Upstream `BoxDescription.vue`: the tagline block. */
export const DESCRIPTION_POINT: AboutPoint = { point: [-0.9, 2, 6.75] };

/** Upstream `BoxServices.vue`: the capability list. */
export const SERVICES_POINT: AboutPoint = { point: [0.75, 2.75, 6.75] };

/** Upstream `BoxDetails.vue` shows the location on its own row with a pin. */
export const aboutDetails = {
  name: "Samuel Kasper",
  location: "Earth",
  role: "Software Engineer",
} as const;

/** Upstream `BoxDescription.vue` renders this as an appearing multi-step line. */
export const aboutTagline =
  "I build and operate backend systems that stay correct under load.";

/**
 * Upstream `BoxServices.vue` lists five services. These are the four-layer
 * capability areas this site already states elsewhere, kept to the same count so
 * the block occupies the same space and reveals on the same cadence.
 */
export const aboutServices = [
  "Backend Architecture",
  "Distributed Systems",
  "Cloud & Kubernetes",
  "Data & Persistence",
  "Reliability Engineering",
] as const;

/**
 * Timings from upstream's `setupInAnimation`, verbatim. The three blocks reveal
 * in sequence with equal spacing, each faded in over 0.15s on `power1.out`.
 */
export const ABOUT_REVEAL = {
  detailsDelay: 0,
  descriptionDelay: 0.4,
  servicesDelay: 0.8,
  fadeDuration: 0.15,
} as const;
