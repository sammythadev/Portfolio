"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/site/icon";

/*
  Two fixes to this list, both about not making the visitor guess.

  The labels used to mix four phrasings for the same action — "Jump to
  Projects", "View Systems Matrix", "Architecture Timeline", "System
  Telemetry" — and two of them named sections that the header navigation called
  something else, so a search for the word you could see in the nav ("Stack",
  "Timeline") matched nothing. Every entry is now the same verb and the same
  wording as the nav item it lands on.

  "Playground" was missing entirely. It is the one destination that is a
  separate page rather than a section, so it needs a route rather than a
  selector — and it was unreachable from the palette that advertised itself as
  the way to get around.
*/
const COMMANDS = [
  { label: "Jump to Projects", href: "#projects", icon: "folder_open", keys: "G P" },
  { label: "Jump to Stack", href: "#stack", icon: "memory", keys: "G S" },
  { label: "Jump to Timeline", href: "#timeline", icon: "schedule", keys: "G T" },
  { label: "Jump to System", href: "#system", icon: "monitor_heart", keys: "G M" },
  { label: "Open Playground", href: "/playground", icon: "grid_4x4", keys: "G L" },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const navigate = useCallback(
    (href: string) => {
      close();
      if (!href.startsWith("#")) {
        window.location.assign(href);
        return;
      }
      const target = document.querySelector(href);
      if (!target) return;
      /*
        Anchor targets sit under a 57px sticky header, so a plain
        `scrollIntoView` parks the heading underneath it. `scroll-margin-top`
        is the declarative fix and lives on the sections themselves (see
        globals.css); this is the belt to that braces.
      */
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [close],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = COMMANDS.filter((command) =>
    command.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border-line bg-surface-card hover:bg-surface-hover active:scale-[0.97] transition-[background-color,transform] duration-150 ease-out"
      >
        <Icon name="terminal" className="text-text-dim text-[16px]" />
        {/*
          This button used to be labelled, and nothing else, "Cmd+K" — on a
          phone, where there is no Cmd key and no keyboard, and where this was
          the only way to move around the page. The action is named first (it is
          a search), and the shortcut is disclosed on the pointed devices that
          can actually use it.
        */}
        <span className="font-label-tag text-[11px] text-text-dim font-medium">
          Search
        </span>
        <span className="hidden md:inline font-label-tag text-[10px] text-text-dim border border-border-line px-1.5 py-0.5 rounded">
          Cmd+K
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-[2px] z-50 flex items-start justify-center pt-24 px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-xl rounded-xl border border-border-line bg-surface-card p-2 shadow-2xl overflow-hidden font-body-sm"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-line">
              <Icon name="terminal" className="text-text-dim text-[18px]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent border-0 text-primary placeholder:text-text-dim focus:ring-0 focus:outline-none text-[13px] p-0"
                placeholder="Type a command or search systems..."
                type="text"
              />
              <span className="font-label-tag text-[10px] text-text-dim border border-border-line px-1.5 py-0.5 rounded">
                ESC
              </span>
            </div>

            <div className="py-2 space-y-1 max-h-80 overflow-y-auto">
              <div className="px-3 py-1 font-label-tag text-[10px] text-text-dim">
                NAVIGATION
              </div>
              {results.length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-text-dim">
                  No matching command.
                </div>
              ) : (
                results.map((command) => (
                  <button
                    key={command.href}
                    type="button"
                    onClick={() => navigate(command.href)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-hover flex items-center justify-between group transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon name={command.icon} className="text-text-dim group-hover:text-primary text-[18px]" />
                      <span className="text-on-surface group-hover:text-primary text-[13px]">
                        {command.label}
                      </span>
                    </div>
                    <span className="font-label-tag text-[10px] text-text-dim">
                      {command.keys}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}