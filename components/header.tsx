"use client";

import { useEffect, useState } from "react";
import { FaBars, FaXmark } from "react-icons/fa6";

import { navItems, siteConfig, socialLinks } from "@/data/site";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Escape closes the menu and returns focus to the trigger for keyboard users.
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  // Prevent background scroll while the mobile sheet is open.
  useEffect(() => {
    if (!isMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMenuOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md transition-[padding,box-shadow] duration-300 supports-[backdrop-filter]:bg-background/70",
        scrolled ? "py-3 shadow-[var(--shadow-soft)]" : "py-5",
      )}
    >
      <div className="container-page flex items-center justify-between gap-4">
        <a
          href="#hero"
          className="text-lg font-bold tracking-tight text-primary sm:text-xl"
        >
          {siteConfig.name}
        </a>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {navItems.map((item) => (
              <li key={item.name}>
                <a
                  href={item.href}
                  className="group relative text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.name}
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 h-0.5 w-0 bg-primary transition-[width] duration-300 group-hover:w-full"
                  />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              aria-label={link.name}
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <link.icon className="size-5" aria-hidden />
            </a>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? (
            <FaXmark className="size-5" aria-hidden />
          ) : (
            <FaBars className="size-5" aria-hidden />
          )}
        </Button>
      </div>

      {isMenuOpen && (
        <div
          id="mobile-menu"
          className="border-t border-border bg-background lg:hidden"
        >
          <nav
            aria-label="Mobile"
            className="container-page max-h-[calc(100dvh-4rem)] overflow-y-auto py-6"
          >
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block rounded-lg px-3 py-3 text-base font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
            <ul className="mt-6 flex items-center justify-center gap-3 border-t border-border pt-6">
              {socialLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    aria-label={link.name}
                    {...(link.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    <link.icon className="size-5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}