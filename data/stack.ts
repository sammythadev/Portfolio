export type StackItem = {
  /**
   * The brand name alone, e.g. "PostgreSQL".
   *
   * These used to carry their qualifiers inline — "PostgreSQL (Neon, RDS)",
   * "NestJS (DI, modules, guards)" — which forced the label to wrap or clip in
   * a two-up grid. Now that each row is prefixed with the real brand mark, the
   * mark identifies the technology and the name no longer has to explain it, so
   * the qualifier moves to `detail` and renders as secondary text.
   */
  name: string;
  /** Optional qualifier. Rendered below the name, never inside it. */
  detail?: string;
  /** Proficiency tier as labelled in the reference design. */
  tier: string;
};

import type { IconName } from "@/components/site/icon";

export type StackLayer = {
  /**
   * Stable identity for the layer, used as the React key and available as an
   * anchor target. It is deliberately NOT rendered: the cards previously
   * printed it as "LAYER 01", "LAYER 02", ... which is the section-numbering
   * eyebrow the anti-slop rules ban. Each card already carries a distinct icon
   * and title, so the ordinal added nothing but decoration.
   */
  id: string;
  title: string;
  icon: IconName;
  items: StackItem[];
};

/** Four-layer capability matrix, derived from the published tech stack. */
export const stackLayers: StackLayer[] = [
  {
    id: "backend-architecture",
    title: "Backend Architecture & APIs",
    icon: "hub",
    items: [
      { name: "NestJS", detail: "DI, modules, guards", tier: "CORE" },
      { name: "Express.js", detail: "REST services", tier: "CORE" },
      { name: "GraphQL", detail: "schema design", tier: "WORKING" },
      {
        name: "JWT",
        detail: "OAuth 2.0 · TOTP 2FA",
        tier: "PROD",
      },
    ],
  },
  {
    id: "data-persistence",
    title: "Data & Persistence",
    icon: "dns",
    items: [
      { name: "PostgreSQL", detail: "Neon, RDS", tier: "PROD" },
      { name: "Drizzle ORM", detail: "typed schema", tier: "PROD" },
      { name: "MongoDB", detail: "document store", tier: "WORKING" },
      { name: "Prisma", detail: "Sequelize · Mongoose", tier: "WORKING" },
    ],
  },
  {
    id: "ai-infrastructure",
    title: "AI & Inference Infrastructure",
    icon: "psychology",
    items: [
      { name: "OpenAI", detail: "gateway & provider routing", tier: "CORE" },
      { name: "LangChain", detail: "RAG agent pipelines", tier: "CORE" },
      { name: "OpenAI APIs", detail: "compatible surface", tier: "CORE" },
      { name: "Claude Code", detail: "agent tooling & scripts", tier: "WORKING" },
    ],
  },
  {
    id: "delivery-infrastructure",
    title: "Delivery & Infrastructure",
    icon: "sync_alt",
    items: [
      { name: "Docker", detail: "Compose", tier: "PROD" },
      { name: "Kubernetes", detail: "cluster orchestration", tier: "WORKING" },
      { name: "GitHub Actions", detail: "CI/CD", tier: "PROD" },
      {
        name: "Terraform",
        detail: "AWS · GCP · Vercel",
        tier: "WORKING",
      },
    ],
  },
];

/** Short capability tags shown over the hero media. */
export const heroTags = [
  "Backend Architecture",
  "Docker & Kubernetes",
  "LLM Agent Systems",
  "Event-Driven Services",
  "CI/CD & Reliability",
] as const;

export const heroHeadline =
  "Building backend systems, AI infrastructure, and the pipelines that ship them.";

export const heroSubline =
  "Designing typed service APIs, event-driven architectures, and LLM-backed agent infrastructure that stays observable and reliable in production.";

export const roleBadge = "Backend · DevOps · AI Infrastructure";