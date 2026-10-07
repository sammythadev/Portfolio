"use client";

import { useEffect, useState } from "react";

const TOAST_EVENT = "portfolio:toast";

/** Fire a transient notification from anywhere on the client. */
export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }));
}

export function Toast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onToast = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 2200);
    };

    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    /*
      `transition-all` is replaced with the two properties this element actually
      animates. `transition: all` makes the browser watch every animatable
      property, so any future change to a layout-affecting value (width,
      padding) gets animated by accident and costs a layout pass; on a fixed
      element layered over the page that also muddies the timing. Naming
      `transform` and `opacity` keeps the whole thing on the compositor, and the
      exit is deliberately faster than the 2200ms dwell — a dismissal you have
      to wait out feels broken.
    */
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg border border-border-line bg-surface-card text-on-surface font-label-code text-[12px] shadow-lg flex items-center gap-2 z-50 transition-[transform,opacity] duration-200 ease-out ${
        message
          ? "translate-y-0 opacity-100"
          : "translate-y-16 opacity-0 pointer-events-none"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
      <span>{message ?? "Alert"}</span>
    </div>
  );
}