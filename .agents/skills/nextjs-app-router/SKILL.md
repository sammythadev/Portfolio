---
name: nextjs-app-router
description: Conventions and reference for the Next.js 16 App Router as used in this repo — file conventions, layouts vs pages, route groups, parallel/intercepting routes, metadata files, and the file-system router. Use when adding or reviewing routes, layouts, loading/error boundaries, or SEO files.
---

# Next.js 16 App Router

Authoritative source for this repo is the **installed** docs at
`node_modules/next/dist/docs/` (Next.js **16.3.8**). When this skill and the
installed docs disagree, the installed docs win — training data is stale for
Next.js APIs.

## File conventions

```
app/
  layout.tsx        root layout — required; owns <html>/<body>, fonts, metadata
  page.tsx          route UI
  not-found.tsx     404 (global)
  icon.svg          favicon (file convention, auto-wired)
  robots.ts         /robots.txt
  sitemap.ts        /sitemap.xml
  globals.css       design tokens (@theme) + structural CSS
```

Metadata is also already centralised in `app/layout.tsx` via
`metadataBase`, `openGraph`, and `twitter`. Prefer extending that export over
per-page metadata unless a route genuinely differs.

## Layouts vs pages

- `layout.tsx` wraps its segment and **persists across navigation**. Do not put
  per-request state or `useEffect` work here.
- `page.tsx` renders for a route.
- Layouts do not re-render on navigation, so anything that must change per route
  belongs in `page.tsx` or a leaf.
- This repo is a single route (`/`). `not-found.tsx` is a sibling and is **not**
  wrapped by the root layout's page content — it renders its own `<main>`, so it
  must supply its own layout classes.

## Server vs Client

Default to Server Components. See the `nextjs-rsc-boundary` skill. Quick rule
for this repo: `app/` files are Server Components; `components/site/*` are
Server Components **except** the documented client islands.

## Route groups

`(marketing)/`, `(app)/` etc. wrap routes without affecting the URL. Not used in
this repo (single route) — reach for them only if routes are added.

## Parallel & intercepting routes

`@slot` folders, `(..)` interception, and `@modal` conventions. Not used here.
Needed only if a future route needs parallel rendering or intercepted modals.

## Loading, error, not-found

- `loading.tsx` — Suspense fallback for a segment.
- `error.tsx` — must be a Client Component (receives `error`, `reset`).
- `not-found.tsx` — global 404.

The design has no async data today, so `loading.tsx` / `error.tsx` are absent by
choice. Add them the moment a route fetches.

## Metadata & SEO

- `generateMetadata` for dynamic metadata; static `export const metadata`
  otherwise.
- Set `title.template` on the root layout when adding child routes.
- Keep `metadataBase` set so relative OG/image URLs resolve absolutely.
- `themeColor` and `colorScheme` belong on the `viewport` export, **not**
  `metadata` (this repo already does this correctly).

## Conventions to keep

- Route handlers only if genuinely needed (`app/api/*/route.ts`); prefer
  Server Components for reads.
- `next.config.ts` stays minimal: `reactStrictMode`, `poweredByHeader: false`,
  and `images.remotePatterns` for `images.unsplash.com`.
- Turbopack is the default bundler in 16.x; don't add webpack flags.