---
name: nextjs-fonts-metadata
description: Font loading and SEO metadata in the Next.js App Router — next/font (self-hosted, zero layout shift, CSS variables), when to use next/font/local vs /google, font-display, subsets, and the split between the metadata and viewport exports. Use when adding or changing fonts, title/description, OpenGraph, Twitter cards, themeColor, or sitemap/robots.
---

# Fonts & Metadata

Reference: `node_modules/next/dist/docs/app/api-reference/components/font`
and `.../generate-metadata` (installed **16.3.8**). Installed docs win.

## next/font

`next/font` self-hosts fonts at build time: no external request, no
FOUT/FOUC, automatic `font-display: swap`, and zero-cost layout shift via
size-adjusted fallback metrics.

```tsx
import { Geist, JetBrains_Mono } from "next/font/google";

const geist = Geist({
  variable: "--font-geist",   // expose as a CSS variable
  subsets: ["latin"],
  display: "swap",
});
```

Apply the `variable` on `<html>` and consume it in CSS. This repo does exactly
that in `app/layout.tsx`, with the variables wired into Tailwind's `@theme` in
`app/globals.css`:

```css
@theme {
  --font-display: var(--font-geist), ui-sans-serif, system-ui, sans-serif;
  --font-label-tag: var(--font-jetbrains-mono), ui-monospace, monospace;
}
```

which yields utilities like `font-display`, `font-label-tag`, `font-body-sm`.

## Rules

- **Never `<link>` Google Fonts.** It costs a render-blocking round trip and
  causes FOUT. Use `next/font`.
- One loader call per family. Reuse the CSS variable across many components.
- Declare `subsets` explicitly; omit it and you ship every subset.
- `weight`/`style` must be specified for non-variable fonts. Variable fonts
  (Geist, JetBrains Mono here) need neither.
- Keep the font stack in `@theme`, not in JSX.

## Not every icon font is available

`next/font/google` only exposes fonts in its bundled metadata — checked here,
and **Material Symbols is not among them** (1942 fonts, no `Material Symbols`;
only `Noto Sans Symbols` / `Noto Sans Symbols 2`).

That's why this repo uses **`react-icons`** instead: a static `material-symbols-outlined`
class with ligature text required a `<link>` to Google's icon stylesheet.
`components/site/icon.tsx` maps the ligature names to `react-icons/md`
components, which is tree-shakeable and needs no external request. Sizes still
follow `font-size` because react-icons emits a `1em` SVG.

If you need an icon that isn't in the map, add it there and type it as
`IconName` so typos fail typecheck.

## Metadata

Static pages export `metadata`; dynamic ones export `generateMetadata`.

```tsx
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),   // required for relative OG/image URLs
  title: "...",
  description: "...",
  authors: [...], creator: "...",
  openGraph: { type, url, siteName, title, description },
  twitter: { card: "summary_large_image", title, description },
};
```

Set `metadataBase` once in the root layout. When child routes are added, set
`title: { default, template }` on the root so children inherit a suffix.

## viewport is a separate export

`themeColor` and `colorScheme` belong on **`viewport`**, not `metadata`:

```tsx
export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};
```

Also export `viewport` from any segment that scrolls-lock or needs independent
theme colour.

## robots.ts and sitemap.ts

File conventions — `app/robots.ts` and `app/sitemap.ts` are already present and
compile to `/robots.txt` and `/sitemap.xml`. Keep the `SITE_URL` constant in one
place (`app/layout.tsx`) so these three files can't drift.