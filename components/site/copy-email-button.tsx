"use client";

import { useCallback } from "react";

import { showToast } from "@/components/site/toast";
import { Icon } from "@/components/site/icon";

type Props = {
  email: string;
  /** Hide the trailing `(address)` caption — used on narrow viewports. */
  compact?: boolean;
};

/** Copies the address to the clipboard and confirms via the shared toast. */
export function CopyEmailButton({ email, compact = false }: Props) {
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(email);
      showToast(`Copied: ${email}`);
    } catch {
      showToast("Clipboard unavailable");
    }
  }, [email]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className="px-3.5 py-1.5 rounded-lg border border-border-line bg-black/80 hover:bg-surface-hover text-on-surface font-body-sm text-[13px] active:scale-[0.97] transition-[background-color,transform] duration-150 ease-out flex items-center gap-1.5"
    >
      <Icon name="content_copy" className="text-[16px] text-text-dim" />
      <span>Copy Email</span>
      {!compact ? (
        <span className="font-label-tag text-[10px] text-text-dim font-mono">
          ({email})
        </span>
      ) : null}
    </button>
  );
}