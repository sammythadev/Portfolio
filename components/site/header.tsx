import { Decrypt } from "@/components/site/decrypt";
import { CommandPalette } from "@/components/site/command-palette";
import { HeaderNav } from "@/components/site/header-nav";
import { siteConfig } from "@/data/site";

/*
  The badge previously read "Systems Operational" with a grey dot, implying a
  live availability or incident feed that nothing on this page backs up. It is
  now a plain, true recruiting signal with the accent dot that marks the single
  chromatic highlight on the page.

  `statusBadge` in data/site.ts is left in place because removing it would be a
  wider change than this pass calls for; it is no longer referenced here.
*/
export function Header() {
  return (
    /*
      The header is `sticky` and spans the full width, so a `backdrop-blur` here
      forces the compositor to re-sample and blur the entire strip behind it on
      every frame that anything underneath moves — which, with a fixed WebGL
      canvas and scroll-linked layers, is every frame. The background is already
      a near-opaque `bg-background/90` over pure black, so the blur is visually
      doing almost nothing. It is dropped in favour of a solid fill and a
      slightly stronger border, which is visually identical at a fraction of the
      cost. (The small blurred pills in the hero are bounded, ~100x24px, and
      stay, since their cost is proportional to their own area.)
    */
    <header className="site-header w-full bg-background border-b border-border-line sticky top-0 z-40">
      <div className="flex justify-between items-center w-full px-6 py-3 max-w-[1080px] mx-auto border-x border-border-line">
        <div className="flex items-center gap-3">
          {/*
            `py-1.5`: the wordmark measured 20px tall, under the 24px minimum
            target size (WCAG 2.2, 2.5.8). The negative margin keeps the header
            row the same height it was, so nothing above the fold moves.
          */}
          <a
            className="font-label-code text-[13px] text-primary tracking-tight font-semibold -my-1.5 py-1.5 flex items-center gap-2 group"
            href="#top"
          >
            <Decrypt text={siteConfig.name} animateOn="hover" speed={30} />
          </a>
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border-line bg-surface-card">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-fault" />
            <span className="font-label-tag text-[11px] text-text-dim">
              Open to work
            </span>
          </div>
        </div>

        <HeaderNav />

        <div className="flex items-center gap-2">
          <CommandPalette />
        </div>
      </div>
    </header>
  );
}