/**
 * A numeric read of the design, because a screenshot cannot be diffed and a
 * claim about "confusing" cannot be argued with. Everything here is measured
 * from the live DOM and computed styles at three viewports:
 *
 *   - information architecture: section order, which sections have no heading,
 *     which nav links point at nothing, how deep the page is
 *   - wayfinding: how many interactive elements are in the first screen, how
 *     many competing labels there are, whether a scroll cue exists
 *   - legibility: every distinct font size, and the contrast ratio of every text
 *     node against the background it actually sits on
 *   - touch: interactive elements under the 24px / 44px thresholds on a phone
 *   - layout: horizontal overflow, elements wider than the viewport
 *   - decoration: how many pill badges, how much always-running animation
 *
 *   node scripts/audit/design.mjs
 */
import { launch, sleep, VIEWPORTS, line, hr } from "./lib.mjs";

const browser = await launch();

/** WCAG relative luminance + contrast ratio. */
const CONTRAST_FN = `
function parse(c) {
  const m = c.match(/rgba?\\(([^)]+)\\)/);
  if (!m) return null;
  const parts = m[1].split(",").map((n) => parseFloat(n));
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}
function lum({ r, g, b }) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function over(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a,
  };
}
function bgOf(el) {
  let node = el;
  let acc = null;
  while (node && node !== document.documentElement) {
    const c = parse(getComputedStyle(node).backgroundColor);
    if (c && c.a > 0) acc = acc ? over(acc, c) : c;
    if (acc && acc.a >= 1) return acc;
    node = node.parentElement;
  }
  return acc ?? { r: 0, g: 0, b: 0, a: 1 };
}
function ratio(el) {
  const fg = parse(getComputedStyle(el).color);
  if (!fg) return null;
  const bg = bgOf(el);
  if (!bg) return null;
  const f = over(fg, bg);
  const L1 = lum(f);
  const L2 = lum(bg);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
`;

try {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 120000 });
    await sleep(2500);

    const report = await page.evaluate((contrastSrc) => {
      eval(contrastSrc);

      const interactive = [...document.querySelectorAll("a, button, [role=button], input, summary")];
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY) };
      };

      const smallTargets = interactive
        .map((el) => ({ el, b: box(el) }))
        .filter(({ b }) => b.w > 0 && (b.w < 44 || b.h < 44))
        .map(({ el, b }) => ({
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
          tag: el.tagName.toLowerCase(),
          w: b.w,
          h: b.h,
        }));

      const tiny = interactive
        .map((el) => ({ el, b: box(el) }))
        .filter(({ b }) => b.w > 0 && (b.w < 24 || b.h < 24))
        .map(({ el, b }) => `${el.tagName.toLowerCase()}:${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)} ${b.w}x${b.h}`);

      const textNodes = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (text.length < 2) continue;
        const parent = node.parentElement;
        if (!parent) continue;
        const r = parent.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const cs = getComputedStyle(parent);
        if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
        const c = ratio(parent);
        if (c === null) continue;
        textNodes.push({
          text: text.slice(0, 46),
          size: parseFloat(cs.fontSize),
          weight: cs.fontWeight,
          ratio: Number(c.toFixed(2)),
          cls: parent.className?.toString().slice(0, 40),
        });
      }

      const sizes = {};
      for (const t of textNodes) sizes[t.size] = (sizes[t.size] ?? 0) + 1;

      const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({
        level: h.tagName,
        text: h.textContent.trim().replace(/\s+/g, " ").slice(0, 60),
      }));

      const sections = [...document.querySelectorAll("section, main > div")].map((el) => ({
        id: el.id || null,
        name: el.getAttribute("data-section-name") || null,
        height: Math.round(el.getBoundingClientRect().height),
        hasHeading: !!el.querySelector("h1,h2,h3"),
        heading: el.querySelector("h1,h2,h3")?.textContent.trim().slice(0, 50) ?? null,
        textLen: el.textContent.trim().length,
      }));

      const navLinks = [...document.querySelectorAll("nav a")].map((a) => {
        const href = a.getAttribute("href");
        const target = href?.startsWith("#") ? document.querySelector(href) : null;
        return {
          label: a.textContent.trim(),
          href,
          resolves: href?.startsWith("#") ? !!target : href?.startsWith("/"),
          height: box(a).h,
        };
      });

      const pills = document.querySelectorAll(
        ".rounded-full, [class*='rounded-full']"
      ).length;

      const forever = [...document.querySelectorAll("*")].filter((el) => {
        const cs = getComputedStyle(el);
        return cs.animationName !== "none" && cs.animationIterationCount === "infinite";
      }).length;

      const doc = document.documentElement;

      return {
        height: doc.scrollHeight,
        viewportHeight: innerHeight,
        screens: Number((doc.scrollHeight / innerHeight).toFixed(1)),
        overflowX: doc.scrollWidth > innerWidth,
        scrollWidth: doc.scrollWidth,
        innerWidth,
        headings,
        sections,
        navLinks,
        interactiveInFold: interactive.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top < innerHeight && r.bottom > 0 && r.width > 0;
        }).length,
        interactiveTotal: interactive.filter((el) => box(el).w > 0).length,
        smallTargets,
        tinyTargets: tiny,
        sizes,
        lowContrast: textNodes
          .filter((t) => t.ratio < (t.size >= 18 || Number(t.weight) >= 700 ? 3 : 4.5))
          .sort((a, b) => a.ratio - b.ratio)
          .slice(0, 25),
        textCount: textNodes.length,
        pills,
        foreverAnimations: forever,
        hasScrollCue:
          !!document.querySelector("[class*='scroll'], [data-scroll-cue]") ||
          [...document.querySelectorAll("*")].some((el) =>
            /scroll/i.test(el.className?.toString?.() ?? "") && el.getBoundingClientRect().width < 300
          ),
      };
    }, CONTRAST_FN);

    hr(`${name} (${viewport.width}x${viewport.height})`);
    line(`page height          : ${report.height}px = ${report.screens} screens`);
    line(`horizontal overflow  : ${report.overflowX ? `YES (${report.scrollWidth} > ${report.innerWidth})` : "no"}`);
    line(`interactive in fold  : ${report.interactiveInFold} of ${report.interactiveTotal} on the page`);
    line(`scroll cue present   : ${report.hasScrollCue ? "yes" : "NO"}`);
    line(`rounded-full pills   : ${report.pills}`);
    line(`infinite animations  : ${report.foreverAnimations}`);

    line(`\nheadings (${report.headings.length}):`);
    for (const h of report.headings) line(`  ${h.level}  ${h.text}`);

    line(`\nsections (${report.sections.length}):`);
    for (const s of report.sections) {
      line(`  h=${String(s.height).padStart(5)}  heading=${s.hasHeading ? "y" : "NO"}  id=${s.id ?? "-"} name=${s.name ?? "-"}  "${s.heading ?? ""}"`);
    }

    line(`\nnav (${report.navLinks.length}):`);
    for (const n of report.navLinks) line(`  "${n.label}" -> ${n.href}  resolves=${n.resolves}  height=${n.height}px`);

    line(`\nfont sizes in use: ${JSON.stringify(report.sizes)}`);

    line(`\ntap targets under 44px: ${report.smallTargets.length} of ${report.interactiveTotal}`);
    const grouped = {};
    for (const t of report.smallTargets) {
      const key = `${t.tag} ${t.w}x${t.h}`;
      grouped[key] = (grouped[key] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(grouped)) line(`  ${v} x ${k}`);
    if (report.tinyTargets.length) {
      line(`  UNDER 24px (WCAG 2.5.8 fail): ${report.tinyTargets.join(", ")}`);
    }

    line(`\ncontrast failures (${report.lowContrast.length} of ${report.textCount} text nodes):`);
    for (const t of report.lowContrast) {
      line(`  ${String(t.ratio).padStart(5)}:1  ${String(t.size).padStart(4)}px  "${t.text}"`);
    }

    await page.close();
  }
} finally {
  await browser.close();
}
