export type Milestone = {
  period: string;
  title: string;
  context: string;
  detail: string;
  /** Renders the timeline node as active (current focus). */
  current?: boolean;
};

/**
 * Capability milestones reconstructed from the public repository record
 * (github.com/sammythadev, first commit January 2024). Deliberately framed as
 * focus areas rather than employment history.
 */
export const milestones: Milestone[] = [
  {
    period: "2024 to 2025",
    title: "Full-Stack Foundations",
    context: "web / client-side",
    detail:
      "Started shipping complete applications across HTML, CSS, JavaScript and TypeScript, with React and Next.js front ends over Node.js and Express services and PostgreSQL and MongoDB persistence.",
  },
  {
    period: "2025",
    title: "Backend Architecture",
    context: "services / auth / tenancy",
    detail:
      "Moved into production backend engineering: NestJS service architecture, Drizzle ORM schema design, JWT and Google OAuth authentication, role-based and tenant-aware access control, and secure refresh-token rotation.",
  },
  {
    period: "2026",
    title: "Distributed Systems & Infrastructure",
    context: "kafka / grpc / kubernetes",
    detail:
      "Designed event-driven microservice platforms with Spring Boot, Kafka and gRPC behind an API Gateway, and ran containerised workloads on Kubernetes with CI/CD pipelines and infrastructure-as-code.",
  },
  {
    period: "Now",
    title: "AI Infrastructure",
    context: "LLM / agents / tooling",
    detail:
      "Building LLM infrastructure and agent systems: an OpenAI-compatible gateway that aggregates free-tier providers, RAG agent pipelines, and shared agent tooling, keeping local automation reliable past single-provider limits.",
    current: true,
  },
];