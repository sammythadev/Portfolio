/**
 * The reference portfolio's project list.
 *
 * Shown at the foot of the playground as an index of where the ported ideas came
 * from. These are David Heckhoff's projects, not mine — every entry links to his
 * own deployment or repository, and the section is explicitly labelled as a
 * reference.
 *
 * Attribution
 * ------------
 * github.com/davidhckh/portfolio-2025 by David Heckhoff, CC BY-NC-SA 4.0. The
 * licence requires that derivative works keep the credit and show a visible
 * reference to the original, which is why this file exists as a labelled index
 * rather than being quietly dropped. The upstream site's own project previews
 * are images and videos; none are reproduced here, so nothing of his media is
 * redistributed — only titles, tag vocabulary, and links, with attribution.
 */

export type ReferenceProject = {
  title: string;
  /** Upstream's own tag vocabulary, verbatim. */
  tags: string[];
  /** Where it lives, when there is a public deployment. */
  href?: string;
  /** One line on what it is, in my words, from the upstream description. */
  note: string;
};

export const referenceProjects: ReferenceProject[] = [
  {
    title: "CubeWar",
    tags: ["three", "node", "websockets", "redis"],
    href: "https://cubewar.io",
    note: "Browser multiplayer game with cube avatars. Full stack, including a client-side timeline system and Redis matchmaking.",
  },
  {
    title: "WebGL Particles",
    tags: ["ogl", "javascript", "glsl"],
    href: "https://particles.david-hckh.com/",
    note: "Particles animated through mathematical and noise functions, blending continuously between 3D shapes. The closest relative to the grid floor above.",
  },
  {
    title: "Quibbo",
    tags: ["three", "node", "kubernetes", "redis", "postgresql"],
    note: "Platform for round-based multiplayer games, with matchmaking, customisable 3D avatars and ranked rewards.",
  },
  {
    title: "Pokédex",
    tags: ["javascript", "html", "css"],
    href: "https://pokedex.david-hckh.com/",
    note: "An early learning project, open source so others can follow the same path. Reads from a public API for async practice.",
  },
  {
    title: "Sharkie",
    tags: ["javascript", "html", "css"],
    href: "https://sharkie.david-hckh.com/",
    note: "2D underwater adventure in vanilla JS and HTML5 Canvas, structured around classes for entities and combat, with parallax backgrounds.",
  },
  {
    title: "StreakOn",
    tags: ["next", "node", "postgresql", "redis"],
    href: "https://www.streakon.app",
    note: "Shared habit streaks for small groups, designed for low-friction mobile check-ins.",
  },
];