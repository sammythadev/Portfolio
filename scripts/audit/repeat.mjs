/**
 * How often the hero video actually shows up.
 *
 * The gate is data-dependent, so a single run proves nothing. This runs the
 * same cold visit N times in fresh browsers and counts how many times the
 * element was mounted, how many times it was revealed, and how long the visitor
 * waited for it. `--warm` pre-fills the HTTP cache so the difference between a
 * cold and a warm visit is visible.
 *
 *   node scripts/audit/repeat.mjs [--n=8] [--ms=9000] [--warm]
 */
import { launch, installVideoRecorder, sleep, line, hr } from "./lib.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const N = Number(args.n ?? 8);
const MS = Number(args.ms ?? 9000);
const warm = !!args.warm;

const results = [];

for (let i = 1; i <= N; i += 1) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await installVideoRecorder(page);

    if (warm) {
      // Same browser context, one throwaway visit first so the JPEG and the mp4
      // are in the HTTP cache before the measured one.
      await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 120000 });
      await sleep(4000);
      await page.goto("about:blank");
      await sleep(300);
    }

    const t0 = Date.now();
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
    const t1 = Date.now();

    let mounted = false;
    let revealedAt = null;
    let playingAt = null;
    let unmounted = false;
    let endedUp = null;

    while (Date.now() - t0 < MS) {
      await sleep(150);
      const s = await page.evaluate(() => {
        const v = document.querySelector("video");
        const img = document.querySelector("#scroll-hero-trigger img");
        const entry = performance.getEntriesByType("resource").find((e) => e.name.endsWith("/me.jpeg"));
        return {
          has: !!v,
          shown: v?.hasAttribute("data-shown") ?? false,
          paused: v?.paused ?? null,
          rs: v?.readyState ?? -1,
          imgComplete: img?.complete ?? false,
          jpegBps: entry && entry.responseEnd > entry.responseStart
            ? Math.round((((entry.transferSize || entry.encodedBodySize) * 1000) / (entry.responseEnd - entry.responseStart)))
            : null,
        };
      });
      if (s.has) mounted = true;
      if (mounted && !s.has) unmounted = true;
      if (s.shown && revealedAt === null) revealedAt = Date.now() - t0;
      if (s.has && s.paused === false && playingAt === null) playingAt = Date.now() - t0;
      endedUp = s;
    }

    results.push({
      run: i,
      ttfb: t1 - t0,
      mounted,
      unmounted,
      revealedAt,
      playingAt,
      jpegBps: endedUp?.jpegBps,
      finalShown: endedUp?.shown,
    });
    line(
      `run ${String(i).padStart(2)}  ttfb=${String(t1 - t0).padStart(5)}ms  jpeg≈${String(endedUp?.jpegBps ?? "?").padStart(8)}B/s  ` +
        `mounted=${mounted ? "yes" : "NO "}  revealed=${revealedAt === null ? "never" : `${revealedAt}ms`}  ` +
        `playing=${playingAt === null ? "never" : `${playingAt}ms`}`
    );
  } finally {
    await browser.close();
  }
}

hr(`summary (${N} cold visits${warm ? ", warm cache" : ""}, 1440x900, localhost)`.replace("cold visits, warm", "visits,"));
const count = (f) => results.filter(f).length;
line(`clip element mounted : ${count((r) => r.mounted)}/${N}`);
line(`clip ever revealed   : ${count((r) => r.revealedAt !== null)}/${N}`);
line(`clip ever played     : ${count((r) => r.playingAt !== null)}/${N}`);
line(`element later removed: ${count((r) => r.unmounted)}/${N}`);
const waits = results.filter((r) => r.revealedAt !== null).map((r) => r.revealedAt);
if (waits.length) {
  line(`wait before visible  : min ${Math.min(...waits)}ms  max ${Math.max(...waits)}ms`);
}
