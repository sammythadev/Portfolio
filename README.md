# Samuel Kasper — Portfolio

Personal portfolio built with **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**, **Tailwind CSS v4**, and **shadcn/ui**-style components.

Full-stack developer with a passion for building scalable, fast, and user-focused applications.

## Stack

- **Frontend:** React.js, Next.js, TypeScript, Tailwind CSS v4
- **Backend:** Node.js, Express, Fastify, PostgreSQL, MongoDB, Redis, Kafka, BullMQ
- **DevOps & Tools:** Docker, Git, CI/CD, Cloudflare R2
- **Other:** Cloud computing, API integrations (REST & GraphQL), database optimization, data analytics

## Getting started

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

## Scripts

| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | Start the Turbopack dev server           |
| `pnpm build`     | Create an optimized production build     |
| `pnpm start`     | Serve the production build               |
| `pnpm lint`      | Run ESLint (`eslint-config-next` flat)   |
| `pnpm typecheck` | Run `tsc --noEmit`                       |

## Project structure

```
app/                  Routes and layouts (App Router)
├── layout.tsx        Root layout: fonts, metadata, viewport, skip link
├── page.tsx          Home page — composes all sections
├── globals.css       Tailwind v4 theme + shadcn semantic tokens
├── not-found.tsx     Branded 404
├── icon.svg          Favicon
├── robots.ts         robots.txt
└── sitemap.ts        sitemap.xml
components/
├── ui/               Reusable primitives (button, card, input, …)
├── header.tsx        "use client" — scroll state + mobile menu
├── hero.tsx          Server component
├── about.tsx         Server component
├── skills.tsx        Server component
├── projects.tsx      Server component
├── contact.tsx       "use client" — validated form
└── footer.tsx        Server component
data/                 Typed content (site, skills, projects, stats, social)
lib/utils.ts          `cn()` class-name helper
public/               Static assets
design/               Design reference material
```

## Architecture notes

- **Server Components by default.** Only `header.tsx` and `contact.tsx` carry
  `"use client"` — they are the only interactive surfaces.
- **Content is data-driven.** Edit `data/*.ts` to change copy, skills, or
  projects; no component edits required.
- **Theming is token-driven.** Brand colors live in `app/globals.css` as
  `oklch` values mapped into Tailwind via `@theme inline`, with a dark mode
  override under `.dark`.
- **Fonts are self-hosted** via `next/font`, eliminating the render-blocking
  Google Fonts request.

## Deploy

Deploys to any Node host or Vercel. Set `siteConfig.url` in `data/site.ts` to
your production domain so metadata, `sitemap.xml`, and `robots.txt` resolve
correctly. 