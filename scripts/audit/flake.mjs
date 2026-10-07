/**
 * Is "no clip mounted" a real decision or a flaky one?
 *
 * Prints every input the mount gate reads, next to whether the element ended up
 * in the DOM, for N fresh browsers in a row. Run while the machine is quiet and
 * again while it is busy: if `effectiveType` is the thing that moves, the gate
 * is answering honestly about a loaded machine rather than mis-firing.
 *
 *   node scripts/audit/flake.mjs [--n=6]
 */
import { launch, sleep, line, hr } from "./lib.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const N = Number(args.n ?? 6);

for (let i = 1; i <= N; i += 1) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
    await sleep(6000);
    const s = await page.evaluate(() => {
      const img = document.querySelector("#scroll-hero-trigger img");
      const url = performance.getEntriesByType("resource").find((e) => e.name.endsWith("/me.jpeg"));
      return {
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        updateSlow: matchMedia("(update: slow)").matches,
        saveData: navigator.connection?.saveData ?? null,
        effectiveType: navigator.connection?.effectiveType ?? "(absent)",
        deviceMemory: navigator.deviceMemory ?? "(absent)",
        imgComplete: img?.complete ?? null,
        jpegMs: url ? Math.round(url.responseEnd - url.requestStart) : null,
        video: !!document.querySelector("video"),
      };
    });
    line(
      `${String(i).padStart(2)}  video=${s.video ? "yes" : "NO "}  eff=${String(s.effectiveType).padEnd(6)} ` +
        `save=${s.saveData} mem=${s.deviceMemory} rm=${s.reduced} slow=${s.updateSlow} ` +
        `img=${s.imgComplete} jpeg=${s.jpegMs}ms`
    );
  } finally {
    await browser.close();
  }
}
hr("done");
