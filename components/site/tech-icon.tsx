import type { ComponentType, SVGProps } from "react";
import { TbBrandOpenai } from "react-icons/tb";
import {
  SiAnthropic,
  SiAnthropicHex,
  SiApachekafka,
  SiApachekafkaHex,
  SiApollographql,
  SiApollographqlHex,
  SiClaudecode,
  SiClaudecodeHex,
  SiDeno,
  SiDenoHex,
  SiDocker,
  SiDockerHex,
  SiDrizzle,
  SiDrizzleHex,
  SiElasticsearch,
  SiElasticsearchHex,
  SiExpress,
  SiExpressHex,
  SiFastapi,
  SiFastapiHex,
  SiGithub,
  SiGithubHex,
  SiGithubactions,
  SiGithubactionsHex,
  SiGitea,
  SiGiteaHex,
  SiGitlab,
  SiGitlabHex,
  SiGo,
  SiGoHex,
  SiGooglecloud,
  SiGooglecloudHex,
  SiGrafana,
  SiGrafanaHex,
  SiGraphql,
  SiGraphqlHex,
  SiHuggingface,
  SiHuggingfaceHex,
  SiJavascript,
  SiJavascriptHex,
  SiJenkins,
  SiJenkinsHex,
  SiJest,
  SiJestHex,
  SiJetbrains,
  SiJetbrainsHex,
  SiJsonwebtokens,
  SiJsonwebtokensHex,
  SiKubernetes,
  SiKubernetesHex,
  SiLangchain,
  SiLangchainHex,
  SiLinux,
  SiLinuxHex,
  SiMarkdown,
  SiMarkdownHex,
  SiMongodb,
  SiMongodbHex,
  SiNestjs,
  SiNestjsHex,
  SiNetlify,
  SiNetlifyHex,
  SiNextdotjs,
  SiNextdotjsHex,
  SiNginx,
  SiNginxHex,
  SiNodedotjs,
  SiNodedotjsHex,
  SiOllama,
  SiOllamaHex,
  SiOpenstack,
  SiOpenstackHex,
  SiPostgresql,
  SiPostgresqlHex,
  SiPrisma,
  SiPrismaHex,
  SiPrometheus,
  SiPrometheusHex,
  SiPuppeteer,
  SiPuppeteerHex,
  SiPython,
  SiPythonHex,
  SiRabbitmq,
  SiRabbitmqHex,
  SiReact,
  SiReactHex,
  SiRedis,
  SiRedisHex,
  SiRust,
  SiRustHex,
  SiSpringboot,
  SiSpringbootHex,
  SiSqlite,
  SiSqliteHex,
  SiTailwindcss,
  SiTailwindcssHex,
  SiTerraform,
  SiTerraformHex,
  SiTypescript,
  SiTypescriptHex,
  SiVercel,
  SiVercelHex,
  SiVitess,
  SiVitessHex,
} from "@icons-pack/react-simple-icons";

/**
 * Real, brand-coloured tech icons.
 *
 * Source: `@icons-pack/react-simple-icons` — the Simple Icons catalogue packaged
 * as React components. Each brand exports a component (`SiDocker`) that inherits
 * `currentColor`, plus a `…Hex` constant holding the brand's official colour
 * (`SiDockerHex` === `#2496ED`). Rendering `<SiDocker color={SiDockerHex} />`
 * yields the genuine logo in its real brand colour, which is what this design
 * needs — the monochrome variants reduce to flat silhouettes.
 *
 * Simple Icons omits some brands for legal reasons. OpenAI and AWS have no
 * entry, so LLM-gateway work maps to the Ollama mark (the closest available
 * LLM-runtime logo) and there is deliberately no AWS icon — the stack drops the
 * AWS claim rather than substituting a lookalike.
 */
type TechGlyph = {
  Icon: ComponentType<SVGProps<SVGSVGElement> & { color?: string }>;
  color: string;
};

const techIcons = {
  anthropic: { Icon: SiAnthropic, color: SiAnthropicHex },
  apollo: { Icon: SiApollographql, color: SiApollographqlHex },
  claudecode: { Icon: SiClaudecode, color: SiClaudecodeHex },
  deno: { Icon: SiDeno, color: SiDenoHex },
  docker: { Icon: SiDocker, color: SiDockerHex },
  drizzle: { Icon: SiDrizzle, color: SiDrizzleHex },
  elasticsearch: { Icon: SiElasticsearch, color: SiElasticsearchHex },
  express: { Icon: SiExpress, color: SiExpressHex },
  fastapi: { Icon: SiFastapi, color: SiFastapiHex },
  github: { Icon: SiGithub, color: SiGithubHex },
  githubactions: { Icon: SiGithubactions, color: SiGithubactionsHex },
  gitea: { Icon: SiGitea, color: SiGiteaHex },
  gitlab: { Icon: SiGitlab, color: SiGitlabHex },
  go: { Icon: SiGo, color: SiGoHex },
  googlecloud: { Icon: SiGooglecloud, color: SiGooglecloudHex },
  grafana: { Icon: SiGrafana, color: SiGrafanaHex },
  graphql: { Icon: SiGraphql, color: SiGraphqlHex },
  huggingface: { Icon: SiHuggingface, color: SiHuggingfaceHex },
  javascript: { Icon: SiJavascript, color: SiJavascriptHex },
  jenkins: { Icon: SiJenkins, color: SiJenkinsHex },
  jetbrains: { Icon: SiJetbrains, color: SiJetbrainsHex },
  jsonwebtoken: { Icon: SiJsonwebtokens, color: SiJsonwebtokensHex },
  kafka: { Icon: SiApachekafka, color: SiApachekafkaHex },
  kubernetes: { Icon: SiKubernetes, color: SiKubernetesHex },
  langchain: { Icon: SiLangchain, color: SiLangchainHex },
  linux: { Icon: SiLinux, color: SiLinuxHex },
  markdown: { Icon: SiMarkdown, color: SiMarkdownHex },
  mongodb: { Icon: SiMongodb, color: SiMongodbHex },
  jest: { Icon: SiJest, color: SiJestHex },
  nodejs: { Icon: SiNodedotjs, color: SiNodedotjsHex },
  nestjs: { Icon: SiNestjs, color: SiNestjsHex },
  netlify: { Icon: SiNetlify, color: SiNetlifyHex },
  nextjs: { Icon: SiNextdotjs, color: SiNextdotjsHex },
  nginx: { Icon: SiNginx, color: SiNginxHex },
  ollama: { Icon: SiOllama, color: SiOllamaHex },
  /*
    Simple Icons dropped the OpenAI mark upstream, so it is not in the `si` pack
    at any version this project can resolve. Tabler still ships it as a brand
    glyph, and its hex is the same near-black on this canvas, so it sits in the
    catalogue with no visual difference from the neighbours.
  */
  openai: { Icon: TbBrandOpenai, color: "#10a37f" },
  openstack: { Icon: SiOpenstack, color: SiOpenstackHex },
  postgresql: { Icon: SiPostgresql, color: SiPostgresqlHex },
  prisma: { Icon: SiPrisma, color: SiPrismaHex },
  prometheus: { Icon: SiPrometheus, color: SiPrometheusHex },
  puppeteer: { Icon: SiPuppeteer, color: SiPuppeteerHex },
  python: { Icon: SiPython, color: SiPythonHex },
  rabbitmq: { Icon: SiRabbitmq, color: SiRabbitmqHex },
  react: { Icon: SiReact, color: SiReactHex },
  redis: { Icon: SiRedis, color: SiRedisHex },
  rust: { Icon: SiRust, color: SiRustHex },
  springboot: { Icon: SiSpringboot, color: SiSpringbootHex },
  sqlite: { Icon: SiSqlite, color: SiSqliteHex },
  tailwind: { Icon: SiTailwindcss, color: SiTailwindcssHex },
  terraform: { Icon: SiTerraform, color: SiTerraformHex },
  typescript: { Icon: SiTypescript, color: SiTypescriptHex },
  vercel: { Icon: SiVercel, color: SiVercelHex },
  vitess: { Icon: SiVitess, color: SiVitessHex },
} satisfies Record<string, TechGlyph>;

/** Valid tech keys — consumed by the data layer so typos fail typecheck. */
export type TechKey = keyof typeof techIcons;

type Props = {
  tech: TechKey;
  className?: string;
  /** Accessible name. Omit for decorative icons sitting beside visible text. */
  title?: string | null;
};

/**
 * Brands whose official mark is black or near-black.
 *
 * Express ships `#0A0A0A`, JWT `#000000`, Markdown `#000000`. On a pure-black
 * canvas those renders as a barely-visible smudge, so the glyph reads as a
 * rendering bug rather than as a logo. Rather than lose the mark, these are
 * lifted to a light neutral that keeps the shape and hue but actually renders.
 *
 * This is a deliberate deviation from the brand palette, which is normally
 * something to avoid. It is the correct call here because the alternative is an
 * invisible icon, and the distinction is a legibility floor rather than a
 * recolour for taste.
 */
const DARK_MARK_FLOOR = "#c4c7c8";

function legibleOnBlack(color: string): string {
  const hex = color.trim();
  if (!hex.startsWith("#") || hex.length < 7) return color;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Relative luminance per WCAG 2.1.
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  return luminance < 0.06 ? DARK_MARK_FLOOR : color;
}

/** A single brand-coloured tech logo. `className` should carry the size. */
export function TechIcon({ tech, className = "size-4", title = null }: Props) {
  const { Icon, color } = techIcons[tech];
  return (
    <Icon
      color={legibleOnBlack(color)}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
    />
  );
}

/**
 * Maps the free-text technology labels used in `data/` onto verified brand
 * marks. Returns `null` when there is no catalogue entry, so callers can decide
 * between a text-only chip and omitting the icon — never a guessed logo.
 */
const TECH_ALIASES: Record<string, TechKey> = {
  "next.js": "nextjs",
  "nextjs": "nextjs",
  "nest.js": "nestjs",
  nestjs: "nestjs",
  "express.js": "express",
  express: "express",
  react: "react",
  typescript: "typescript",
  javascript: "javascript",
  postgres: "postgresql",
  postgresql: "postgresql",
  mongo: "mongodb",
  mongodb: "mongodb",
  drizzle: "drizzle",
  "drizzle orm": "drizzle",
  prisma: "prisma",
  graphql: "graphql",
  kafka: "kafka",
  grpc: "kafka",
  "spring boot": "springboot",
  springboot: "springboot",
  java: "springboot",
  docker: "docker",
  kubernetes: "kubernetes",
  k8s: "kubernetes",
  terraform: "terraform",
  "ci/cd": "githubactions",
  "github actions": "githubactions",
  jenkins: "jenkins",
  redis: "redis",
  nginx: "nginx",
  vercel: "vercel",
  netlify: "netlify",
  "google cloud": "googlecloud",
  gcp: "googlecloud",
  tailwind: "tailwind",
  "tailwind css": "tailwind",
  jwt: "jsonwebtoken",
  "json web tokens": "jsonwebtoken",
  "oauth 2.0": "jsonwebtoken",
  rust: "rust",
  go: "go",
  python: "python",
  langchain: "langchain",
  "hugging face": "huggingface",
  huggingface: "huggingface",
  ollama: "openai",
  "llm gateway": "openai",
  "openai-compatible api": "openai",
  "openai apis": "openai",
  openai: "openai",
  "llm routing": "openai",
  claude: "claudecode",
  "claude code": "claudecode",
  "agent tooling": "claudecode",
  "agent tooling & scripts": "claudecode",
  prometheus: "prometheus",
  grafana: "grafana",
  elasticsearch: "elasticsearch",
  "key rotation": "redis",
  linux: "linux",
  jest: "jest",
  "node.js": "nodejs",
  nodejs: "nodejs",
  yaml: "markdown",
};

export function techKeyFor(label: string): TechKey | null {
  return TECH_ALIASES[label.trim().toLowerCase()] ?? null;
}