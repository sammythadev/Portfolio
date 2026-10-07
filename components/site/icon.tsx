import {
  MdAltRoute,
  MdBlurOn,
  MdClose,
  MdCloud,
  MdCode,
  MdComputer,
  MdContentCopy,
  MdDataObject,
  MdDns,
  MdFolderOpen,
  MdGrid4X4,
  MdHub,
  MdMemory,
  MdMenu,
  MdMonitorHeart,
  MdNorthEast,
  MdOpenInFull,
  MdPsychology,
  MdRestartAlt,
  MdSchedule,
  MdSouth,
  MdSyncAlt,
  MdTerminal,
  MdTouchApp,
  MdWest,
} from "react-icons/md";

import type { IconType } from "react-icons";

/**
 * Material Symbols ligature names used by the design, mapped to `react-icons`
 * (the icon library already configured in `components.json`). Keeps the icon
 * system tree-shakeable and removes the render-blocking Google Fonts request
 * the single-file reference relied on.
 *
 * Size follows `font-size` (react-icons emits a 1em SVG), so existing
 * `text-[16px]`-style utilities keep working unchanged.
 */
export const icons = {
  alt_route: MdAltRoute,
  blur_on: MdBlurOn,
  cloud: MdCloud,
  code_blocks: MdDataObject,
  close: MdClose,
  computer: MdComputer,
  content_copy: MdContentCopy,
  dns: MdDns,
  expand: MdOpenInFull,
  folder_open: MdFolderOpen,
  grid_4x4: MdGrid4X4,
  hub: MdHub,
  memory: MdMemory,
  menu: MdMenu,
  monitor_heart: MdMonitorHeart,
  north_east: MdNorthEast,
  psychology: MdPsychology,
  restart_alt: MdRestartAlt,
  schedule: MdSchedule,
  south: MdSouth,
  sync_alt: MdSyncAlt,
  terminal: MdTerminal,
  touch_app: MdTouchApp,
  west: MdWest,
} satisfies Record<string, IconType>;

/** Valid icon keys — consumed by the data layer so typos fail typecheck. */
export type IconName = keyof typeof icons;

/** Convenience for the one place that still needs a raw code glyph. */
export const CodeGlyph = MdCode;

type Props = {
  name: IconName;
  className?: string;
};

export function Icon({ name, className }: Props) {
  const Glyph = icons[name];
  return <Glyph aria-hidden="true" className={className} />;
}