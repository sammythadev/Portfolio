import { siteConfig, socialLinks } from "@/data/site";

export function Footer() {
  return (
    <footer className="site-footer w-full bg-background border-t border-border-line relative z-20">
      <div className="flex flex-col md:flex-row justify-between items-center w-full px-6 py-8 max-w-[1080px] mx-auto border-x border-border-line gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-text-dim" />
          <span className="font-label-code text-[12px] text-text-dim">
            © {new Date().getFullYear()} {siteConfig.name}
          </span>
        </div>

        {/*
          `py-1.5` is not decoration. At 11px these links measured 17px tall —
          under the 24x24 minimum target size in WCAG 2.2 (2.5.8), which is
          about the size of the thing you are trying to hit, not about taste.
          The padding takes each one to 29px and the row keeps its rhythm.

          The `min-w-[24px]` covers the other axis: the X link's label is one
          character, so its box was 7px wide however tall the padding made it.
        */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 justify-center">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center py-1.5 text-text-dim hover:text-on-surface font-label-tag text-[11px] transition-colors"
              href={link.href}
              rel="noreferrer"
              target={link.href.startsWith("mailto:") ? undefined : "_blank"}
            >
              {link.short}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}