import { launch, sleep, line, hr } from "./lib.mjs";

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => {
  window.__enters = [];
  const attach = () => {
    if (!document.documentElement) return false;
    new MutationObserver(() => {
      const media = document.querySelector("#scroll-hero-trigger > div");
      if (media && !media.__w) {
        media.__w = true;
        media.addEventListener("pointerenter", () => window.__enters.push("media-wrapper"));
        const section = media.closest("section");
        section?.addEventListener("pointerenter", () => window.__enters.push("section"));
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
    return true;
  };
  if (!attach()) setInterval(() => attach() && clearInterval(), 10);
});
await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 120000 });
await sleep(2500);

const hit = await page.evaluate(() => {
  const section = document.getElementById("scroll-hero-trigger");
  const r = section.getBoundingClientRect();
  const x = Math.round(r.left + r.width / 2);
  const y = Math.round(r.top + r.height / 2);
  const el = document.elementFromPoint(x, y);
  const media = section.querySelector(":scope > div");
  return {
    x, y,
    topElement: `${el?.tagName.toLowerCase()}.${(el?.className ?? "").toString().slice(0, 60)}`,
    isMediaWrapper: el === media,
    mediaWrapperContainsHit: media?.contains(el) ?? null,
  };
});
hr("hit test at the hero centre");
line(JSON.stringify(hit, null, 1));

await page.mouse.move(hit.x, hit.y);
await sleep(600);
line(`after a real mouse move: ${JSON.stringify(await page.evaluate(() => window.__enters))}`);

const shown = await page.evaluate(() => document.querySelector("video")?.hasAttribute("data-shown"));
line(`video shown after hover: ${shown}`);
await browser.close();
