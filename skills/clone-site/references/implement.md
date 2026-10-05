# Implementing the clone

Read after step 4 of `SKILL.md`, once `tokens.md` exists.

## First: detect the stack you are building into

Do not assume. Two minutes of reading saves a rewrite.

```bash
cat package.json 2>/dev/null | head -60
ls -1 tailwind.config.* postcss.config.* components.json next.config.* vite.config.* \
      svelte.config.* nuxt.config.* astro.config.* 2>/dev/null
ls -1 app/globals.css src/app/globals.css src/index.css src/styles/*.css 2>/dev/null
```

What you are looking for, and what it changes:

| Signal | Implication |
| --- | --- |
| `next` in deps + `app/` dir | App Router. Server components by default — `'use client'` for anything with hooks or motion. |
| `tailwindcss` v4 (`@tailwindcss/postcss`) | Tokens go in CSS via `@theme inline`, **not** in `tailwind.config`. No `content` array. |
| `tailwindcss` v3 | Tokens go in `tailwind.config.{js,ts}` under `theme.extend`. |
| `components.json` | shadcn/ui. Read `style`, `baseColor`, `cssVariables`, `aliases` and match them. |
| `gsap`, `motion`/`framer-motion`, `lenis` | Already available — use them rather than adding a library. |
| no framework, plain `.html` | Write plain CSS custom properties. Do not introduce a build step uninvited. |

Match the conventions already in the repo — file naming, component structure, how existing
components import and compose. A clone that fights the surrounding code is a maintenance problem
even when it looks right.

## Where tokens go

Read the project's existing token layer end to end before adding anything. If it already has a
structure, extend it; do not start a parallel one.

**Tailwind v4** — one `@theme inline` block over CSS custom properties, light and dark together:

```css
@import 'tailwindcss';

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --radius-md: 6px;
  --radius-xl: 12px;
}

:root {
  --background: oklch(100% 0 0);
  --foreground: oklch(14.5% 0 0);
}
.dark {
  --background: oklch(14.5% 0 0);
  --foreground: oklch(98.5% 0 0);
}
```

**Tailwind v3** — the same values under `theme.extend.colors` / `borderRadius` in the config, with
the custom properties still in CSS so dark mode has somewhere to swap.

**No Tailwind** — custom properties on `:root` plus a `[data-theme="dark"]` block. Same discipline:
named tokens, no hex literals at the point of use.

## Token mapping

`extract-design.js` gives every colour in three forms — the authored `value`, sRGB `hex`, and
`oklch`. Use whichever the project already authors in; Tailwind v4 and shadcn both prefer oklch.

| Measured (`design-*.json`) | Goes to (shadcn naming) |
| --- | --- |
| `colors.background[0]` | `--background` |
| `colors.background[1..2]` | `--card`, `--popover`, `--muted` |
| `colors.text[0]` | `--foreground` |
| `colors.text[1..2]` | `--muted-foreground`, then a third level if one genuinely exists |
| `colors.border[0]` | `--border`, `--input` |
| the one saturated hue | `--primary` + `--ring`, with `--primary-foreground` for contrast |
| `radii[0..2]` | `--radius-md` for functional UI, `--radius-xl` for cards |
| `shadows[*]` | Verbatim into `--shadow-*`. Never retype a shadow from memory. |
| `type.families[0]` | `--font-sans`; add the display face separately if headings differ |
| `type.sizes` | The type scale. Keep the target's ladder — do not substitute Tailwind's defaults. |
| `spacing.padding` cluster | Confirm the base unit; Tailwind's 4px default usually already fits |
| `sections[].padTop/padBottom` | Section rhythm — its own scale, typically 64–160px, not the base unit |
| `layout.widestContent` | The container `max-w-*`; add an arbitrary value if it is not a Tailwind step |
| `layout.breakpoints` | Compare against 640/768/1024/1280/1536 and note deliberate differences |

If you captured only one colour scheme, say so rather than inventing the other half.

### If `cssVars` came back populated

A token-driven target hands you its system directly — check there before deriving anything. Two
cautions: strip framework noise (Tailwind v4 emits its entire `--color-red-50…950` palette into
`:root`, none of which is a design decision), and keep only variables the page actually references.
The names are worth reading on their own — they show how the target's designers grouped their
system, which is a shortcut to the right structure.

## Fonts

`fonts` in the JSON lists what actually loaded. Prefer the framework's own font pipeline
(`next/font`, `@fontsource/*`) over copying files. If the face is licensed — Typekit, Monotype, a
foundry CDN — do not copy it. Substitute the closest open face and say which substitution you made.

## Copy discipline

The goal is **visually faithful to the target, translated into real frontend** — not "inspired by".

Preserve: layout logic, spacing rhythm, section ordering, text/image balance, typography mood,
component family, density, and overall visual cleanliness.

## Anti-drift

The named failure mode: measurements are right, the coded result comes out generic. It happens
gradually, one convenient shortcut per section. Specifically do not:

- simplify a distinctive section into a default row of cards
- compress generous spacing into a denser layout because it "looks tighter"
- flatten a strong type hierarchy into uniform sizes
- merge distinct sections into one repeated pattern that was not in the target
- add nested containers, pills, badges, or micro-labels the target does not have
- improve the design mid-build

Re-open `ref-1440.png` every two or three sections and compare. Drift is invisible from inside the
code and obvious from the screenshot.

## Resolving ambiguity

When a detail is unclear, in this order:

1. Preserve the visible design language
2. Preserve layout and spacing logic
3. Preserve the component family
4. Preserve mood and polish level
5. Re-measure that specific element — `evaluate_script` on its selector returns exact values
6. Only then choose the most buildable faithful option

Do not reach for a generic default at step 1. Step 5 is cheap and usually ends the question.

## Motion

Build from `motion.json` (step 3), not from taste. Convert GSAP string easings to `cubic-bezier`
before use; a wrong curve is felt immediately even when the duration is right.

| Target behaviour | Build with |
| --- | --- |
| Hover, press, focus, small state change | CSS transition on `transform`/`opacity` — runs off the main thread |
| Enter/exit, layout change, gesture | `motion` if present, else WAAPI (`element.animate`) |
| Scroll-pinned, scrubbed, stacked sections | `gsap` + ScrollTrigger if present, else `IntersectionObserver` + CSS |
| Page-wide smooth scroll | `lenis`, and only if the target actually has it |

Add a motion library only if the target's behaviour genuinely needs one. Keep UI transitions under
300ms unless the target is demonstrably slower. Honour `prefers-reduced-motion` even when the target
does not — drop movement, keep opacity.

## Before reporting done

Run whatever the project actually defines — check `package.json` scripts rather than guessing:

```bash
npm run typecheck   # or: npx tsc --noEmit
npm run lint
npm run build       # catches RSC / client-boundary mistakes the others miss
```

On Next.js App Router, `'use client'` is required for any component using GSAP, motion, lenis, or
hooks. It is the easiest thing to miss when porting a static page, and `build` is what catches it.
