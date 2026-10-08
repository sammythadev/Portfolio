"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import GooeyNav from "@/components/reactbits/GooeyNav";
import { Icon } from "@/components/site/icon";
import { useActiveSection } from "@/components/site/use-active-section";
import { navItems } from "@/data/site";

/**
 * Navigation island. The rest of the header markup is static and stays on the
 * server; only what needs client-side state lives here — the GooeyNav pill, its
 * "you are here" state, and the small-screen menu.
 *
 * Small screens
 * -------------
 * There was no navigation below 768px. The nav island was `hidden md:flex` and
 * nothing replaced it, so a phone visitor got a name, a status badge and a
 * button labelled "Cmd+K" — on a device with no Cmd key and no keyboard — with
 * roughly nine screens of content underneath and no way to move through it.
 * Measured: every nav link had a height of 0px at 390px wide.
 *
 * The menu button is a real disclosure: a labelled button with
 * `aria-expanded`/`aria-controls`, a 40px hit area, a panel that closes on
 * Escape, on selection, and on a route change, and rows that are 44px tall so
 * they can actually be tapped. A hamburger is the wrong answer when there is
 * room for a visible menu (NN/g, menu design #1), which is why the full nav is
 * still what renders on every screen that can hold it.
 *
 * The panel is `fixed`, not `absolute`. `.site-header` sets `overflow: clip` to
 * contain a paint artifact, and an absolutely positioned panel would be clipped
 * to the 57px header strip — the same reason the command palette dialog is
 * `fixed`.
 *
 * Route-aware hrefs
 * -----------------
 * `navItems` uses bare anchors (`#projects`) because on the home page they are
 * same-page targets. On `/playground` those anchors point at ids that route does
 * not contain, so "Projects" would resolve to `/playground#projects`: the visitor
 * stays on the playground with nothing scrolled, which reads as a broken link.
 * Any anchor that is not already on the current route is prefixed with it.
 */
export function HeaderNav() {
  const pathname = usePathname();
  /*
    The panel remembers the route it was opened on rather than a boolean, so a
    navigation closes it by construction instead of by an effect that calls
    setState — there is no window in which a stale panel is open over the new
    page, and nothing to keep in sync.
  */
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  const items = navItems.map((item) =>
    item.href.startsWith("#") && pathname !== "/"
      ? { ...item, href: `/${item.href}` }
      : item
  );

  /*
    Only same-page anchors can be "current". On the playground nothing is, so
    the indicator goes quiet rather than lying about where the visitor is.
  */
  const sectionIds = items
    .filter((item) => item.href.startsWith("#"))
    .map((item) => item.href.slice(1));
  const activeSection = useActiveSection(pathname === "/" ? sectionIds : []);
  const activeIndex = items.findIndex((item) => item.href === `#${activeSection}`);

  const close = useCallback(() => setOpenedOn(null), []);
  const toggle = useCallback(
    () => setOpenedOn((current) => (current === pathname ? null : pathname)),
    [pathname]
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <>
      {/*
        Large screens: the visible menu, with the gooey pill parked on the
        section currently in view.
      */}
      <div className="hidden md:flex items-center">
        <GooeyNav
          items={items}
          colors={[1, 2, 3, 4, 3, 2]}
          activeIndex={activeIndex}
        />
      </div>

      {/* Small screens: the disclosure. */}
      <div className="flex md:hidden items-center">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-border-line bg-surface-card px-2.5 text-text-dim transition-colors hover:bg-surface-hover hover:text-primary active:scale-[0.97]"
        >
          <Icon name={open ? "close" : "menu"} className="text-[18px]" />
          <span className="font-label-tag text-[11px] font-medium">
            {open ? "Close" : "Menu"}
          </span>
        </button>
      </div>

      {open ? (
        <div
          id="site-menu"
          className="fixed inset-x-0 top-[var(--header-h)] z-50 border-b border-border-line bg-background md:hidden"
        >
          <nav aria-label="Sections" className="mx-auto max-w-[1080px] px-6 py-2">
            <ul className="divide-y divide-border-line">
              {items.map((item, index) => {
                const isCurrent = item.href === `#${activeSection}`;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={close}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`flex min-h-[44px] items-center justify-between gap-3 font-label-code text-[13px] ${
                        isCurrent ? "text-primary" : "text-text-dim"
                      }`}
                    >
                      <span className={isCurrent ? "font-semibold" : undefined}>
                        {item.label}
                      </span>
                      <span className="flex items-center gap-2">
                        {isCurrent ? (
                          <span className="font-label-tag text-[10px] text-signal-fault">
                            HERE
                          </span>
                        ) : null}
                        <span className="font-label-tag text-[10px] text-text-dim">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  );
}
