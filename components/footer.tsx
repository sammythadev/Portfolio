import { Separator } from "@/components/ui/separator";
import { siteConfig, socialLinks } from "@/data/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-muted py-12">
      <div className="container-page">
        <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {siteConfig.name}. All rights
              reserved.
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground/70">
              Built with Next.js 16 &amp; Tailwind CSS v4
            </p>
          </div>

          <ul className="flex items-center gap-2">
            {socialLinks.map((link) => (
              <li key={link.name}>
                <a
                  href={link.href}
                  aria-label={link.name}
                  {...(link.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="grid size-11 place-items-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <link.icon className="size-5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <Separator className="my-8" />

        <nav aria-label="Footer" className="flex justify-center gap-6 text-sm">
          <a
            href="#hero"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            Back to top
          </a>
          <a
            href={`mailto:${siteConfig.email}`}
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            Email me
          </a>
        </nav>
      </div>
    </footer>
  );
}