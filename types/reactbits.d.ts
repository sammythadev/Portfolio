/**
 * Ambient types for the vendored React Bits components in
 * `components/reactbits/`.
 *
 * The components ship as plain `.jsx` with no type declarations, so without this
 * file TypeScript infers prop types from the destructuring alone and reports
 * false errors (e.g. `style`/`children` appearing required). The component
 * sources themselves stay byte-identical to upstream.
 *
 * Signatures mirror the documented props from `design/design-src.txt`.
 */
declare module "@/components/reactbits/GooeyNav" {
  import type { ComponentType } from "react";

  export type GooeyNavItem = { label: string; href: string };

  const GooeyNav: ComponentType<{
    items?: GooeyNavItem[];
    animationTime?: number;
    particleCount?: number;
    particleDistances?: [number, number];
    particleR?: number;
    timeVariance?: number;
    colors?: number[];
    initialActiveIndex?: number;
    /**
     * Not upstream. The header passes the section currently in view so the pill
     * tracks where the visitor is rather than where they last clicked; `-1`
     * means "nothing is current" and parks the pill off screen.
     */
    activeIndex?: number;
  }>;

  export default GooeyNav;
}

declare module "@/components/reactbits/DecryptedText" {
  import type { ComponentType } from "react";

  const DecryptedText: ComponentType<{
    text: string;
    speed?: number;
    maxIterations?: number;
    sequential?: boolean;
    revealDirection?: "start" | "end" | "center";
    useOriginalCharsOnly?: boolean;
    characters?: string;
    className?: string;
    parentClassName?: string;
    encryptedClassName?: string;
    animateOn?: "hover" | "view" | "click";
    clickMode?: "once" | "restart" | "whileHover";
  }>;

  export default DecryptedText;
}

declare module "@/components/reactbits/ScrollExpand" {
  import type { CSSProperties, ReactNode } from "react";

  const ScrollExpand: (props: {
    src?: string;
    mediaType?: "image" | "video";
    poster?: string;
    alt?: string;
    title?: string;
    scrollHint?: string;
    startWidth?: number;
    startHeight?: number;
    startRadius?: number;
    endRadius?: number;
    mediaZoom?: number;
    scrollDistance?: number;
    holdDistance?: number;
    smoothing?: number;
    overlayScrim?: number;
    useWindowScroll?: boolean;
    enabled?: boolean;
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
  }) => ReactNode;

  export default ScrollExpand;
}

declare module "@/components/reactbits/DitherVeil" {
  import type { CSSProperties } from "react";

  const DitherVeil: (props: {
    src?: string;
    fit?: "cover" | "contain";
    pattern?: "floyd" | "atkinson" | "bayer" | "noise" | "lines";
    pixelSize?: number;
    levels?: number;
    palette?: "duotone" | "rgb" | "mono";
    inkColor?: string;
    paperColor?: string;
    contrast?: number;
    brightness?: number;
    revealRadius?: number;
    softness?: number;
    linger?: number;
    rimColor?: string;
    rim?: number;
    reverse?: boolean;
    wander?: boolean;
    clickBurst?: boolean;
    className?: string;
    style?: CSSProperties;
  }) => ReactNode;

  export default DitherVeil;
}

declare module "@/components/reactbits/CometDial" {
  import type { ComponentType } from "react";

  const CometDial: ComponentType<{
    value?: number;
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    label?: string;
    accent?: string;
    ink?: string;
    size?: number;
    sweep?: number;
    thickness?: number;
    speed?: number;
    tapBounce?: number;
    flickBounce?: number;
    momentum?: number;
    cometReach?: number;
    cometWidth?: number;
    disabled?: boolean;
    onChange?: (value: number) => void;
    onChangeEnd?: (value: number) => void;
    className?: string;
  }>;

  export default CometDial;
}