/**
 * Screenshots, plus a first-viewport content inventory.
 *
 * Captures the home page and the playground at three viewports: the viewport
 * frame, the full page, and one frame per named section. Alongside each capture
 * it records what was actually inside the fold — the first screen is the only
 * screen most visitors read, so "what is on it" is the design question.
 *
 *   node scripts/audit/shots.mjs [--label=before]
 */
import { launch, sleep, VIEWPORTS, line, hr } from "./lib.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const label = args.label ?? "run";
const outDir = path.join(process.cwd(), "scripts", "audit", "shots", "design", label);
mkdirSync(outDir, { recursive: true });

const browser = await launch();
try {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    if (viewport.isMobile) {
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      );
    }
    await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 120000 });
    await sleep(2500);

    await page.screenshot({ path: path.join(outDir, `${name}-fold.png`) });

    // One frame per section, so each can be read on its own.
    const sections = await page.evaluate(() => {
      const out = [];
      const nodes = document.querySelectorAll("section[id], section[data-section-name], #scroll-hero-trigger");
      nodes.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        out.push({
          i,
          id: el.id || null,
          name: el.getAttribute("data-section-name") || el.id || `section-${i}`,
          top: Math.round(r.top + window.scrollY),
          height: Math.round(r.height),
        });
      });
      return out;
    });

    for (const s of sections) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, s.top - 8));
      await sleep(900);
      await page.screenshot({
        path: path.join(outDir, `${name}-sec-${String(s.i).padStart(2, "0")}-${s.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`),
      });
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(400);
    await page.screenshot({ path: path.join(outDir, `${name}-full.png`), fullPage: true });

    hr(`first viewport @ ${name} (${viewport.width}x${viewport.height})`);
    const fold = await page.evaluate(() => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const results = [];
      document.querySelectorAll("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
        const text = (el.textContent || "").trim().replace(/\s+/g, " ");
        // Only leaf-ish text nodes, so the whole page does not print as one node.
        if (!text) return;
        if (el.children.length > 2) return;
        const cs = getComputedStyle(el);
        results.push({
          tag: el.tagName.toLowerCase(),
          cls: el.className?.toString().slice(0, 60),
          text: text.slice(0, 70),
          size: cs.fontSize,
          color: cs.color,
          top: Math.round(r.top),
        });
      });
      return {
        viewport: { vh, vw },
        count: results.length,
        items: results.slice(0, 40),
      };
    });
    line(`elements with text inside the fold: ${fold.count}`);
    for (const it of fold.items) {
      line(`  ${String(it.top).padStart(5)}px  ${it.size.padStart(6)}  <${it.tag}> ${it.text}`);
    }

    if (name === "desktop") {
      const pg = await browser.newPage();
      await pg.setViewport(viewport);
      await pg.goto("http://localhost:3000/playground", { waitUntil: "load", timeout: 120000 });
      await sleep(6000);
      await pg.screenshot({ path: path.join(outDir, "playground-fold.png") });
      await pg.screenshot({ path: path.join(outDir, "playground-full.png"), fullPage: true });
      await pg.close();
    }

    await page.close();
  }
} finally {
  await browser.close();
}

line(`\nwrote screenshots to scripts/audit/shots/design/${label}/`);
