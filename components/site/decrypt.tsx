"use client";

import DecryptedText from "@/components/reactbits/DecryptedText";

type Props = {
  text: string;
  /** `hover` re-scrambles on pointer enter, `view` once when scrolled into view. */
  animateOn?: "hover" | "view";
  className?: string;
  speed?: number;
};

/**
 * Server-friendly wrapper around the React Bits DecryptedText scramble effect.
 * Renders the real text for assistive tech and search engines, and layers the
 * animated cipher on top visually.
 */
export function Decrypt({
  text,
  animateOn = "view",
  className = "",
  speed = 35,
}: Props) {
  return (
    <span className={className} data-decrypt="">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        <DecryptedText
          text={text}
          speed={speed}
          animateOn={animateOn}
          clickMode="once"
          className=""
          encryptedClassName="decrypt-cipher"
        />
      </span>
    </span>
  );
}