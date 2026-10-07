---
name: nextjs-rsc-boundary
description: Server/Client Component boundaries in the Next.js App Router — where to put 'use client', how props must be serialisable, why a boundary widens the client bundle, passing Server Components as children, Context across the boundary, and third-party client-only libraries. Use when deciding client vs server, fixing a "use client" placement, or reducing bundle size.
---

# Server / Client Component Boundary

Reference: `node_modules/next/dist/docs/app/getting-started/server-and-client-components`
(installed **16.3.8**) and
`node_modules/next/dist/docs/app/guides/server-and-client-boundary`.
Installed docs win over this skill.

## The rule

Layouts and pages are **Server Components** by default. Add `'use client'` to
declare the boundary between the server and client **module graphs**.

## Why placement matters

Once a file is marked `'use client'`, **all of its imports and everything it
renders are pulled into the client bundle.** The directive marks a *boundary*,
not a per-component switch — you don't need it on every interactive component,
only at the top of the island.

The corollary: a Server Component passed as `children`/another prop is **not**
imported into the client graph. It renders on the server and is handed over as
output. Use this to keep large trees server-side.

## Choose Client only when you need

- State or event handlers (`onClick`, `onChange`)
- Lifecycle logic (`useEffect`)
- Browser-only APIs (`localStorage`, `window`, `navigator`, `clipboard`)
- Custom hooks that depend on the above

Everything else — data access, secrets, static markup — stays on the server.

## Props must be serialisable

Props passed from a Server Component into a Client Component must be
serialisable. Functions and class instances are not. Pass children (rendered
output) instead of callbacks when crossing the boundary upward.

## Context across the boundary

React Context is **not** supported in Server Components. To share context, make
a Client Component that accepts `children` and renders the provider; the parent
Server Component then renders that provider around server-rendered children:

```tsx
// theme-provider.tsx  — 'use client'
'use client';
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value="dark">{children}</Ctx.Provider>;
}
```

Render providers **as deep as possible** in the tree so Next.js can keep static
parts server-rendered. Wrapping the whole `<html>` document defeats the purpose.

## Third-party client-only libraries

A library using client-only features (but without `'use client'`) fails when
imported directly into a Server Component. Fix by wrapping it once in your own
Client Component, then import that wrapper anywhere.

## Applied to this repo

`components/site/motion-layer.tsx` exists specifically to avoid widening the
boundary: page sections stay Server Components while reveal-on-scroll and
cursor-spotlight still work, via delegated `IntersectionObserver` and a single
document-level `mousemove` listener.

Current islands and why (keep this list accurate):

| Island | Reason |
|---|---|
| `hero.tsx` | ScrollExpand scroll progress |
| `spine-conduit.tsx` | three.js RAF loop |
| `workstation-stage.tsx` | three.js RAF loop + pointer tracking |
| `dither-curtain.tsx` | ogl WebGL + pattern state |
| `comet-telemetry.tsx` | scroll listener, CometDial animation |
| `motion-layer.tsx` | delegated observers/listener |
| `command-palette.tsx` | focus + keyboard state |
| `copy-email-button.tsx` | `navigator.clipboard` |
| `toast.tsx` | `window` CustomEvent bus |

Hard rule: Server Components must not import `three`, `ogl`, `motion`, or
`gsap`. Those are client-only and will break the build or bloat the bundle.