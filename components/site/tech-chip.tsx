/**
 * Technology chip: a real brand mark plus the technology's own name.
 *
 * The stack matrix and the project cards previously rendered every technology as
 * bare text in a generic bordered box. A word tells you what a technology *is*;
 * the mark tells you what it *is* at a glance, and lets the label stand alone
 * instead of carrying parenthetical qualifiers.
 *
 * `techKeyFor` returns `null` for anything without a verified mark. That is a
 * deliberate fallback to text-only rather than a guessed logo — a wrong logo is
 * worse than no logo, so an unmapped technology still reads correctly, just
 * without the glyph.
 */

import { techKeyFor, TechIcon } from "@/components/site/tech-icon";

export function TechChip({
  tech,
  className = "",
  iconClassName = "size-3.5",
}: {
  tech: string;
  className?: string;
  iconClassName?: string;
}) {
  const key = techKeyFor(tech);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border border-border-line bg-surface-container-lowest px-2 py-0.5 font-label-tag text-[11px] text-on-surface-variant ${className}`}
    >
      {key ? (
        <TechIcon className={`${iconClassName} shrink-0`} tech={key} />
      ) : null}
      {tech}
    </span>
  );
}