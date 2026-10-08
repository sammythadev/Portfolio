---
name: Engineered Restraint
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c7c6c6'
  on-secondary: '#2f3131'
  secondary-container: '#484949'
  on-secondary-container: '#b8b8b8'
  tertiary: '#ffffff'
  on-tertiary: '#342f2e'
  tertiary-container: '#eae0dd'
  on-tertiary-container: '#6a6361'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#eae0dd'
  tertiary-fixed-dim: '#cec5c2'
  on-tertiary-fixed: '#1f1b19'
  on-tertiary-fixed-variant: '#4b4644'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
  signal-fault: '#ff4d1c'
  signal-fault-light: '#e5360a'
  surface-card: '#0a0a0a'
  surface-hover: '#171717'
  border-line: '#262626'
  text-dim: '#6b6b6b'
typography:
  display:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 52px
    letterSpacing: -0.045em
  display-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.035em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.035em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.025em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 25.6px
    letterSpacing: -0.01em
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
    letterSpacing: -0.005em
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-tag:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses high-order engineering discipline, density, and precision. Built for an AI systems engineer and developer portfolio, the aesthetic mirrors strict infrastructure tooling: austere, content-focused, and unapologetically monochrome. There are no ornamental gradients, blurred glass overlays, or visual novelties; personality stems entirely from typographic tightness, razor-sharp hairline framing, and calibrated negative space.

Visual principles:
- **Structural Minimalism:** Pure black `#000000` canvas paired with stark low-contrast boundaries (`#262626`). Surfaces do not pop through artificial elevation; they partition space through calibrated luminance stepping.
- **Single Fault Vector:** Color is strictly forbidden from decorative usage. Chromatic energy is reserved solely for critical system states, live fault indicators, or machine health warnings via a piercing hyper-red signal.
- **Instrumental Friction:** Interactions feel direct, mechanical, and unlagged. Motion obeys strict utility—instant command palette rendering, snappy micro-compressions (`scale(0.97)`), and 1px crisp geometry.

## Colors

The palette operates in strict binary discipline. The primary foreground (`#ededed`) provides clean optical contrast against the deep black foundation (`#000000`) without the harsh vibration of pure `#ffffff`. Secondary (`#a1a1a1`) and dim (`#6b6b6b`) tiers establish structural reading hierarchy without introducing hue.

### Application Rules
- **Canvas & Surfaces:** Base canvas is `#000000`. Structural cards and container frames sit at `#0a0a0a`. Interactive hover states shift immediately to `#171717`.
- **Boundaries:** All borders, dividers, and framing rules are strictly 1px solid `#262626`.
- **Fault Signal (`#ff4d1c`):** Reserved entirely for alert states, telemetry fault logs, active system breaks, or critical metrics. It must never be applied to buttons, generic chips, decorative badges, or branding elements.
- **Light Theme Parity:** Handled system-wide without manual toggle icons: background shifts to `#ffffff`, text to `#171717`, muted to `#666666`, border to `#eaeaea`, cards to `#fafafa`, hover to `#f2f2f2`, and signal shifts to `#e5360a`.

## Typography

The type system pairs Geist's technical neo-grotesque geometry with a dense, monospaced programmatic sub-layer. Headings feature aggressive negative tracking (`-0.035em` to `-0.045em`) to evoke Swiss infrastructure manuals and high-performance developer documentation.

### Execution Rules
- **Headlines:** Set in Geist SemiBold (600). Titles must be compact with tight line height to feel structural rather than editorial.
- **Body:** Scaled strictly at 16px with a 1.6 line-height (`25.6px`) for optimal terminal-grade legibility across technical prose and engineering overviews.
- **Monospace Labels:** All meta attributes, status badges, timestamps, commit hashes, metrics, and tags strictly use the monospaced label layer. Monospace text is styled uppercase or raw code case with zero typographic ambiguity.

## Layout & Spacing

Layout conforms to a rigid, content-constrained structure centered on a maximum container width of `1080px`. The vertical rhythm is predictable, deterministic, and modular.

### Layout Mechanics
- **Grid Architecture:** Desktop views utilize a disciplined 12-column sub-grid or 2/3-column modular cards separated by `gutter` (`1.5rem` / `24px`). Mobile layouts collapse to a single column with `1rem` margins.
- **Rhythm Scales:** Internal card padding scales between `space-md` (`16px`) for dense utility blocks and `space-lg` (`24px`) for primary case study showcases.
- **Viewport Adaptation:** Outer margin scales down gracefully from desktop `margin` (`32px`) to mobile `margin-sm` (`16px`). Section vertical spacing stays fixed at `space-xl` (`40px`) to preserve high information density without visual desertion.

## Elevation & Depth

This system outright eliminates standard box-shadow elevations, drop-shadows, and blur-heavy skeuomorphism. Depth is strictly planar, engineered via two clean primitives: **hairline containment** and **surface luminance shifts**.

### Principles
- **Hairline Framing:** All containers, dialogs, inputs, and section boundaries use a single, unwavering 1px border (`#262626`).
- **Planar Tiers:** 
  1. Base Layer: Screen background (`#000000`).
  2. Frame/Card Layer: Structured containers (`#0a0a0a`).
  3. Interactive / Active Tier: Dynamic hover fills (`#171717`).
- **Cursor Spotlight (Exception):** Primary project panels utilize a subtle cursor-tracking radial luminance gradient that reveals structural hairline borders on pointer hover. The effect is strictly restrained to a faint 10% white luminance mask—never colored, never saturated.
- **Command Palette Depth:** Modals do not float with diffuse shadows; they cut cleanly through an opaque 80% blackened backdrop overlay with a razor-thin 1px border perimeter.

## Shapes

The geometry uses a deliberate, hierarchical corner radius scale to reflect architectural enclosure—smaller inner items feature tighter radii than their parent frames.

### Hierarchy
- **Buttons, Tags & Interactive Chips:** Strict `8px` corner radius. Matches compact tactile expectation.
- **Command Palette & Sub-Frames:** `12px` corner radius. Used for command execution dialogs, inner image containers, and nested media cards.
- **Spotlight Panels & Primary Cards:** `16px` corner radius. Anchors major project highlights and system breakdown sections.
- **Form Controls:** Checkboxes and micro toggles use a tight `4px` or `8px` radius to prevent visual bloat.

## Components

### Buttons
- **Primary:** Background `#ededed`, text `#000000`, font Geist SemiBold (14px), 8px radius, height 36px, horizontal padding `14px`. On press: `transform: scale(0.97)`.
- **Secondary / Outline:** Background `transparent`, border 1px solid `#262626`, text `#ededed`. Hover: background `#171717`.
- **Motion:** Transitions stay strictly under `150ms` using `cubic-bezier(0.23, 1, 0.32, 1)`.

### Tags & Chips
- Monospace font (`JetBrains Mono`, 11px), height 22px, radius 8px, 1px border `#262626`, background `#0a0a0a`, text `#a1a1a1`.
- Technology icon integration: Brand SVGs rendered via mask or monochrome fill; missing assets fallback to text label tiles.

### Cards & Project Frames
- Background `#0a0a0a`, border 1px solid `#262626`, radius 12px or 16px, padding `20px` to `24px`.
- Aspect ratio for primary project preview containers is fixed at `16:10`.

### Form Fields & Inputs
- Background `#000000`, 1px solid border `#262626`, text `#ededed`, placeholder `#6b6b6b`, 8px radius, height 36px.
- Focus state: border color promotes to `#a1a1a1` with zero fuzzy glow ring.

### Command Palette (cmdk style)
- Modal frame: radius 12px, border 1px solid `#262626`, background `#0a0a0a`.
- Zero animation entry on trigger (`Cmd/Ctrl + K`) to ensure instant zero-latency utility. Items list with 8px radius hover pads (`#171717`).

### Telemetry / Fault Indicators
- Status indicator: 6px solid circular pip. Nominal state: `#6b6b6b`. Fault or live exception: `#ff4d1c` with immediate non-diffused clarity.