export type ProjectStat = {
  label: string;
  value: string;
};

import type { IconName } from "@/components/site/icon";

/*
  These entries deliberately carry no `image` field.

  Each project used to ship an Unsplash stock photograph: smiling students
  behind the Tutorly matching engine, a server rack behind the LLM gateway, a
  laptop behind Kubernetes. None were screenshots of the software and none had
  any connection to the project they labelled, so the gallery's most prominent
  surface was making claims the work could not back up.

  Panel art is now generated from this data in
  `components/site/project-panels.tsx`: a bipartite graph for Tutorly, a cluster
  boundary for kubernetes-demo, the gateway and service topology for
  patient-microservices, the request path for ciap-boilerplate, and the provider
  fan-out for freellmapi.

  If you add real screenshots later, key them off `spec` and keep the mapping in
  project-panels.tsx so the preview still derives from this file.
*/

export type Project = {
  /** Monospace slug shown in the panel header, e.g. `tutorly.core/bipartite-v1`. */
  spec: string;
  /** Short name used as the collapsed vertical label. */
  title: string;
  /** Full human-readable title for the detail matrix. */
  heading: string;
  /** Badge shown next to the heading. */
  domain: string;
  /** Icon glyph shown in the panel header. */
  icon: IconName;
  description: string;
  tech: string[];
  link: string;
  linkLabel: string;
  /** Honest, verifiable technical attributes — no invented benchmarks. */
  stats: ProjectStat[];
};

export const projects: Project[] = [
  {
    spec: "tutorly.core/bipartite-v1",
    title: "Tutorly Engine",
    heading: "Tutorly, Student-Tutor Matching Platform",
    domain: "Full Stack",
    icon: "alt_route",
    description:
      "Student-tutor matchmaking platform for Nigerian secondary schools. Greedy bipartite matching over tutor availability, subject coverage and schedule overlap, with a tenant-aware backend and a Next.js frontend.",
    tech: ["Next.js", "TypeScript", "NestJS", "PostgreSQL", "Drizzle", "Tailwind"],
    link: "https://github.com/sammythadev/student-tutor-platform",
    linkLabel: "View Repository",
    stats: [
      { label: "target", value: "tutors x students bipartite graph" },
      { label: "approach", value: "greedy + schedule overlap" },
      { label: "audience", value: "WAEC / NECO / JAMB / IGCSE" },
      { label: "tenancy", value: "multi-school, role-based access" },
    ],
  },
  {
    spec: "mesh.spec.k8s.io/v1alpha1",
    title: "kubernetes-demo",
    heading: "kubernetes-demo",
    domain: "Infrastructure",
    icon: "cloud",
    description:
      "Kubernetes cluster demonstrator covering workload scheduling, service networking and rollout behaviour. Used as a working reference for operating containerised services and reading cluster state.",
    tech: ["Kubernetes", "Docker", "YAML"],
    link: "https://github.com/sammythadev/kubernetes-demo",
    linkLabel: "View Repository",
    stats: [
      { label: "scope", value: "workload + service networking" },
      { label: "tooling", value: "kubectl, declarative manifests" },
      { label: "focus", value: "rollout behaviour and observability" },
      { label: "status", value: "reference implementation" },
    ],
  },
  {
    spec: "gateway.grpc.mesh/v1",
    title: "patient-microservices",
    heading: "Patient Management Microservices",
    domain: "Distributed Systems",
    icon: "hub",
    description:
      "Event-driven patient management platform built with Spring Boot, Kafka, gRPC and PostgreSQL behind an API Gateway. Distributed services with JWT authentication and asynchronous domain events.",
    tech: ["Java", "Spring Boot", "Kafka", "gRPC", "PostgreSQL", "Docker"],
    link: "https://github.com/sammythadev/patient-management-microservice",
    linkLabel: "View Repository",
    stats: [
      { label: "transport", value: "gRPC internal, REST at the gateway" },
      { label: "events", value: "Kafka async domain events" },
      { label: "auth", value: "JWT at the edge" },
      { label: "storage", value: "PostgreSQL per service" },
    ],
  },
  {
    spec: "boilerplate.nestjs/v11",
    title: "ciap-boilerplate",
    heading: "CIAP, Production NestJS Boilerplate",
    domain: "Backend",
    icon: "code_blocks",
    description:
      "Production-ready NestJS v11 boilerplate: PostgreSQL via Drizzle ORM, JWT plus Google OAuth, role-based and tenant-aware access control, secure refresh-token rotation, and a Jest test harness.",
    tech: ["NestJS", "TypeScript", "PostgreSQL", "Drizzle", "OAuth 2.0", "Jest"],
    link: "https://github.com/sammythadev/ciap-boilerplate",
    linkLabel: "View Repository",
    stats: [
      { label: "runtime", value: "NestJS v11 on Node.js" },
      { label: "schema", value: "PostgreSQL via Drizzle ORM" },
      { label: "auth", value: "JWT + Google OAuth, RBAC, tenant-aware" },
      { label: "tests", value: "Jest harness included" },
    ],
  },
  {
    spec: "llm.gateway.openai/v1",
    title: "freellmapi",
    heading: "freellmapi, Free-Tier LLM Gateway",
    domain: "AI Infrastructure",
    icon: "psychology",
    description:
      "OpenAI-compatible proxy that aggregates free-tier API keys from roughly 14 AI providers behind a single endpoint, with key rotation and quota-aware routing so local agent workflows keep running past a single provider's limits.",
    tech: ["Node.js", "OpenAI-compatible API", "LLM routing", "Key rotation"],
    link: "https://github.com/sammythadev/freellmapi",
    linkLabel: "View Repository",
    stats: [
      { label: "surface", value: "OpenAI-compatible endpoint" },
      { label: "providers", value: "~14 free-tier keys aggregated" },
      { label: "routing", value: "quota-aware with rotation" },
      { label: "purpose", value: "unbroken local agent workflows" },
    ],
  },
];

/** Unauthenticated, read-only telemetry surfaced in the SYSTEM panel. */
export const systemTelemetry = [
  { label: "PUBLIC REPOS", value: "37", hint: "github.com/sammythadev" },
  { label: "REPO STARS", value: "47", hint: "across all repositories" },
  { label: "PRIMARY STACK", value: "Node / TS", hint: "NestJS + Express" },
  { label: "INFRA", value: "Docker", hint: "K8s, CI/CD, Terraform" },
] as const;