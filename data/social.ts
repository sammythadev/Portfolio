import type { IconType } from "react-icons";

export type SocialLink = {
  name: string;
  href: string;
  icon: IconType;
  /** Shown in the contact list instead of `name` (e.g. a shortened address). */
  label?: string;
  /** Keep mailto/tel links in the same tab rather than opening a new one. */
  external?: boolean;
};