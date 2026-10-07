/**
 * The scenario matrix, one browser per scenario.
 *
 * The earlier version reused a single browser and leaked state between runs
 * (an HTTP cache entry from one scenario changes the timing the next scenario
 * measures), which made perfectly healthy runs look broken. Each scenario here
 * gets a fresh browser, so a result is a result.
 *
 * Reports, per scenario: was the clip requested, did it get mounted, did it
 * reveal, did it end up playing — and how long the visitor waited. Also counts
 * aborted/duplicate requests, which is the specific error users were seeing.
 *
 *   node scripts/audit/matrix.mjs [--ms=9000]
 */
import { launch, installVideoRecorder, sleep, line, hr } from "./lib.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const MS = Number(args.ms ?? 9000);

const SCENARIOS = [
  { name: "desktop / unthrottled", viewport: { width: 1440, height: 900 } },
  {
    name: "desktop / 4 Mbps + 60ms (vetoed by the old throughput gate)",
    viewport: { width: 1440, height: 900 },
    network: { latency: 60, downloadThroughput: (4 * 1024 * 1024) / 8 },
  },
  {
    name: "desktop / 3g-emulated (400 kbps + 300ms) — consent declines",
    viewport: { width: 1440, height: 900 },
    network: { latency: 300, downloadThroughput: (400 * 1024) / 8 },
  },
  { name: "phone 390x844 (hover:none, touch)", viewport: { width: 390, height: 844, isMobile: true, hasTouch: true } },
  { name: "laptop 1280x800", viewport: { width: 1280, height: 800 } },
  { name: "desktop / prefers-reduced-motion — must never request", viewport: { width: 1440, height: 900 }, reducedMotion: true },
  { name: "desktop / save-data — must never request", viewport: { width: 1440, height: 900 }, saveData: true },
];

const rows = [];

for (const s of SCENARIOS) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport(s.viewport);
    if (s.reducedMotion)
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    if (s.saveData)
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          get: () => ({ saveData: true, effectiveType: "4g" }),
        });
      });
    if (s.network) {
      const cdp = await page.createCDPSession();
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        uploadThroughput: s.network.downloadThroughput,
        ...s.network,
      });
    }

    const aborted = [];
    page.on("requestfailed", (r) => aborted.push(`${r.url().replace("http://localhost:3000", "")} ${r.failure()?.errorText}`));
    const responseStatuses = [];
    page.on("response", (r) => {
      if (/\.mp4/.test(r.url())) responseStatuses.push(r.status());
    });

    await installVideoRecorder(page);
    const t0 = Date.now();
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });

    let mounted = false;
    let unmounted = false;
    let reveal = null;
    let playing = null;
    let final = null;

    while (Date.now() - t0 < MS) {
      await sleep(120);
      const snap = await page.evaluate(() => {
        const v = document.querySelector("video");
        return {
          has: !!v,
          shown: v?.hasAttribute("data-shown") ?? false,
          paused: v?.paused ?? null,
          rs: v?.readyState ?? -1,
          buffered: v?.buffered.length ? Number(v.buffered.end(v.buffered.length - 1).toFixed(2)) : 0,
          t: v ? Number(v.currentTime.toFixed(2)) : null,
          reqs: window.__media?.requests?.length ?? 0,
          control: !!document.querySelector("#scroll-hero-trigger button[aria-label]"),
        };
      });
      if (snap.has) mounted = true;
      if (mounted && !snap.has) unmounted = true;
      if (snap.shown && reveal === null) reveal = Date.now() - t0;
      if (snap.has && snap.paused === false && playing === null) playing = Date.now() - t0;
      final = snap;
    }

    // Exercise the control if there is one.
    let controlWorks = null;
    if (final?.control) {
      await page.click("#scroll-hero-trigger button[aria-label]");
      await sleep(600);
      const pausedNow = await page.evaluate(() => document.querySelector("video")?.paused);
      await page.click("#scroll-hero-trigger button[aria-label]");
      await sleep(600);
      const resumed = await page.evaluate(() => document.querySelector("video")?.paused);
      controlWorks = `pause=${pausedNow} resume=${!resumed}`;
    }

    const row = {
      name: s.name,
      mounted,
      unmounted,
      reveal,
      playing,
      statuses: responseStatuses.join("/") || "none",
      aborted: aborted.length ? aborted.join(" | ") : "none",
      control: controlWorks ?? "no control rendered",
      final,
    };
    rows.push(row);

    hr(s.name);
    line(`clip mounted        : ${mounted ? "yes" : "NO"}`);
    line(`revealed after      : ${reveal === null ? "never" : `${reveal}ms`}`);
    line(`playing after       : ${playing === null ? "never" : `${playing}ms`}`);
    line(`element unmounted   : ${unmounted ? "YES" : "no"}`);
    line(`mp4 responses       : ${row.statuses}`);
    line(`failed requests     : ${row.aborted}`);
    line(`control             : ${row.control}`);
    line(`final               : ${JSON.stringify(final)}`);
  } finally {
    await browser.close();
  }
}

hr("summary");
for (const r of rows) {
  line(
    `${r.name.padEnd(58)} mounted=${r.mounted ? "y" : "n"} reveal=${String(r.reveal ?? "-").padStart(5)}ms played=${String(r.playing ?? "-").padStart(5)}ms failed=${r.aborted === "none" ? "0" : "!"} st=${r.statuses}`
  );
}
