/*
  Local dither source for the Stack section's <DitherVeil />.

  The curtain previously sampled an Unsplash photograph of a server rack. That
  made the one interactive piece of the Stack section a picture of somebody
  else's hardware, and it cost a cross-origin request to a third-party host
  before the effect could run at all.

  This is a generated blueprint of the four capability layers the section
  actually documents, drawn to match the site's own grid, hairline and fault
  accent. It is deterministic, weighs a few kilobytes, is served same-origin so
  there is no CORS negotiation, and it degrades to something meaningful if the
  WebGL context never comes up.

  The veil applies Floyd-Steinberg or a Bayer matrix to whatever it is given, so
  the source is deliberately high-contrast line art: that is what makes the
  ordered-dither effect legible instead of turning a soft photograph into noise.
*/

const FAULT = "#ff4d1c";
const LINE = "#3f3f3f";
const WIRE = "#6f6f6f";
const INK = "#ededed";
/*
  No quoted family names here, and no `var(--font-jetbrains-mono)`: this string
  is emitted into single-quoted `font-family='...'` attributes, so a quote in
  the stack would terminate the attribute and the data URL would fail to parse.
  A data-URL SVG is also its own document, so page CSS variables do not cascade
  into it and have to be spelled out as concrete families.
*/
const MONO = "ui-monospace, JetBrains Mono, DejaVu Sans Mono, Liberation Mono, monospace";

const esc = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** One documented capability layer, drawn as a labelled block. */
function layer({
  y,
  index,
  label,
  items,
}: {
  y: number;
  index: string;
  label: string;
  items: string[];
}) {
  const rows = items
    .map(
      (item, i) =>
        `<text x="430" y="${y + 76 + i * 26}" fill="${INK}" font-family='${MONO}' ` +
        `font-size="15" letter-spacing="0.06em">${esc(item)}</text>` +
        `<line x1="410" y1="${y + 71 + i * 26}" x2="424" y2="${y + 71 + i * 26}" ` +
        `stroke="${FAULT}" stroke-width="1.5"/>`
    )
    .join("");

  return (
    `<rect x="70" y="${y}" width="880" height="${34 + items.length * 26}" rx="4" ` +
    `fill="#0b0b0b" stroke="${LINE}" stroke-width="1.5"/>` +
    `<text x="96" y="${y + 34}" fill="${FAULT}" font-family='${MONO}' font-size="17" ` +
    `letter-spacing="0.12em">${esc(index)}</text>` +
    `<text x="180" y="${y + 34}" fill="${INK}" font-family='${MONO}' font-size="17" ` +
    `letter-spacing="0.08em">${esc(label)}</text>` +
    `<line x1="96" y1="${y + 48}" x2="926" y2="${y + 48}" stroke="${LINE}" stroke-width="1"/>` +
    rows
  );
}

function buildSvg(): string {
  const layers = [
    {
      index: "01",
      label: "BACKEND ARCHITECTURE",
      items: ["NestJS · Express", "REST · gRPC", "Drizzle ORM"],
      y: 120,
    },
    {
      index: "02",
      label: "DATA PERSISTENCE",
      items: ["PostgreSQL", "Redis", "Kafka event bus"],
      y: 320,
    },
    {
      index: "03",
      label: "AI INFRASTRUCTURE",
      items: ["OpenAI-compatible gateway", "RAG pipelines", "Agent tooling"],
      y: 520,
    },
    {
      index: "04",
      label: "DELIVERY INFRASTRUCTURE",
      items: ["Docker · Kubernetes", "GitHub Actions CI/CD", "Terraform on AWS"],
      y: 720,
    },
  ];

  // Spine: the vertical rail the four layers hang off, echoing the section's
  // own dividers so the dithered version reads as a blueprint of this page.
  const spine =
    `<line x1="40" y1="120" x2="40" y2="920" stroke="${WIRE}" stroke-width="1.5"/>` +
    layers
      .map(
        (l) =>
          `<line x1="40" y1="${l.y + 20}" x2="70" y2="${l.y + 20}" ` +
          `stroke="${WIRE}" stroke-width="1.5"/>`
      )
      .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="940" ` +
    `viewBox="0 0 1020 940">` +
    `<defs><pattern id="bg" width="34" height="34" patternUnits="userSpaceOnUse">` +
    `<path d="M34 0H0V34" fill="none" stroke="#262626" stroke-width="1"/></pattern></defs>` +
    `<rect width="1020" height="940" fill="url(#bg)"/>` +
    spine +
    layers.map(layer).join("") +
    `</svg>`
  );
}

/** Data URL consumed by <DitherVeil src={...} />. */
export const DITHER_SOURCE =
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSvg())}`;