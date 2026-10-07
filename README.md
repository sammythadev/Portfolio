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

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `pnpm dev`             | Start the Turbopack dev server                    |
| `pnpm build`           | Create an optimized production build              |
| `pnpm start`           | Serve the production build                        |
| `pnpm lint`            | Run ESLint (`eslint-config-next` flat)            |
| `pnpm typecheck`       | Run `tsc --noEmit`                                |
| `pnpm optimize:models` | Rebuild the 3D asset in `public/models/`          |

## 3D model pipeline

The workstation inspection stage (`#stack`) renders a real glTF asset rather
than hand-built boxes. The commit-friendly source is **not** the file that ships:

```
assets/models/desktop-computer-pack.glb   12.2 MB  source (git-tracked)
        │  pnpm optimize:models
        ▼
public/models/workstation.glb              239 KB  what the browser fetches
```

`scripts/optimize-models.mjs` runs glTF Transform with meshopt geometry
compression, WebP textures and a 2048px texture cap. The source export is
texture-dominated — a single 4096×4096 PNG is 8.7 MB of the 12.2 MB, while the
geometry is only ~2.5k triangles — so the win is almost entirely texture work.
The modeled node names, materials and scene graph are preserved
(`--flatten/--join/--palette/--simplify false`).

Loading is deferred: `three`'s loader, the meshopt decoder and the model request
are all triggered by an `IntersectionObserver` only when the stage is approached,
so a visitor who never scrolls that far downloads none of it.

**Asset attribution.** `Desktop Computer Pack - Free Low Poly` by
[LagzDesign](https://sketchfab.com/LagzDesign) is licensed
[CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/). The licence requires
attribution, which is surfaced in the stage UI. Keep it there if you keep the
model.

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
## Attribution

The **Playground** section is a derivative of
[davidhckh/portfolio-2025](https://github.com/davidhckh/portfolio-2025) by
David Heckhoff, used under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Ported elements, all of which keep their upstream credit comments in source:

- **`room.glb`** and **`room.webp`** — the desk, chair, carpet, plant, penguin,
  corkboard and monitors, with upstream's placement
  (`position (2, 0, 0)`, `rotation.y -2.3`, exiting to `(4.5, 5.7, 0)` at scale
  `0.85`) and its shared unlit texture-atlas material.
- **`avatar.glb`**, the four **`matcap-*.webp`** textures, **`head.webp`** and
  **`face-spritesheet.png`** — with upstream's matcap, head and face shaders, its
  per-mesh material assignment, and its `mesh.rotation.z = 0` orientation fix-up.
- **The grid floor** — `PlaneGeometry(18, 18, 18, 18)` with upstream's vertex and
  fragment shaders, including the 18-cell pattern, the upward bow, the edge fade
  and the travelling centre circle.
- **The camera system** — the scene-weight crossfade model
  (`weight = in * (1 - out)`) and the weighted-average waypoint blend, with
  upstream's waypoint values for both landscape and portrait.
- **The character's scroll move** — x `2 -> 0` and z `0 -> 6` while turning from
  `-2.3 + PI/2` to `-PI`.

Upstream's transition timings, shader constants and colour values are reproduced
unchanged. The only deliberate deviations are the site's accent colour in place
of upstream's blue, and holding the avatar's bottom-up reveal at its
fully-visible floor (upstream uses it to dissolve the model across a longer
scroll than this section provides).

Upstream requires that derivative works preserve the credit comments, carry this
attribution section, and show a visible reference to the original. The visible
on-page credit lives at the bottom of the Playground section in
`components/site/playground.tsx`.

The implementation is a rewrite rather than a port: the original is Vue 3 on
Vite, this is React on Next.js App Router. What was taken is the idea of gating
a heavy interactive section behind its own progress screen.

### Other third-party assets

- **Desktop Computer Pack** 3D model by LagzDesign, CC BY 4.0, used in the
  Playground's workstation stage. Attribution is rendered alongside the stage.
