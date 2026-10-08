/**
 * Why the hero video does or does not exist.
 *
 * The gates in `use-hero-video.ts` are invisible from the outside: when one
 * refuses, nothing is rendered and no request is made, so "no video" looks
 * exactly like "video still loading". This replicates each gate's arithmetic in
 * the page and prints the inputs and the verdict, one scenario per browser so
 * nothing leaks between runs.
 *
 *   node scripts/audit/gates.mjs
 */
import { launch, sleep, line, hr, VIEWPORTS } from "./lib.mjs";

const GATE = {
  minBytesPerSecond: 150 * 1024,
  maxRttMs: 400,
  blockedEffectiveTypes: ["slow-2g", "2g", "3g"],
  minDeviceMemoryGb: 2,
};

async function run(name, { viewport, network, reducedMotion, saveData, mobile }) {
  const browser = await launch({ mobile });
  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORTS[viewport]);

    if (reducedMotion)
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    if (saveData)
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          get: () => ({ saveData: true, effectiveType: "4g" }),
        });
      });

    if (network) {
      const cdp = await page.createCDPSession();
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        uploadThroughput: network.downloadThroughput,
        ...network,
      });
    }

    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
    await sleep(6000);

    const report = await page.evaluate((gate) => {
      const nav = navigator;
      const conn = nav.connection;
      const entry = performance
        .getEntriesByType("resource")
        .find((e) => e.name.endsWith("/me.jpeg"));

      const probe = (() => {
        if (!entry) return { verdict: "NO ENTRY — not measurable" };
        const bytes = entry.transferSize || entry.encodedBodySize;
        const issuedAt = entry.requestStart || entry.startTime;
        const rttMs = Math.round(entry.responseStart - issuedAt);
        const downloadMs = entry.responseEnd - entry.responseStart;
        if (!bytes) return { verdict: "no bytes recorded (cache)" };
        if (downloadMs <= 0) return { verdict: `downloadMs=${downloadMs} — measured as instant` };
        return {
          bytes,
          rttMs,
          downloadMs: Math.round(downloadMs),
          bytesPerSecond: Math.round((bytes * 1000) / downloadMs),
          verdict:
            rttMs > gate.maxRttMs || (bytes * 1000) / downloadMs < gate.minBytesPerSecond
              ? "REJECTS the video"
              : "allows the video",
        };
      })();

      const consent = {
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        saveData: !!conn?.saveData,
        effectiveType: conn?.effectiveType ?? "(absent)",
        updateSlow: matchMedia("(update: slow)").matches,
        deviceMemory: nav.deviceMemory ?? "(absent)",
      };
      consent.verdict =
        consent.reducedMotion ||
        consent.saveData ||
        gate.blockedEffectiveTypes.includes(consent.effectiveType) ||
        consent.updateSlow ||
        (typeof nav.deviceMemory === "number" && nav.deviceMemory < gate.minDeviceMemoryGb)
          ? "REJECTS the video"
          : "allows the video";

      const hero = document.querySelector("#scroll-hero-trigger");
      const rect = hero?.getBoundingClientRect();
      const visibleH = rect ? Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0)) : 0;
      const ratio = rect && rect.height ? visibleH / rect.height : 0;
      const img = hero?.querySelector("img");

      return {
        consent,
        probe,
        heroBox: rect ? { top: Math.round(rect.top), h: Math.round(rect.height), ratio: Number(ratio.toFixed(3)) } : null,
        heroHalfVisible: ratio >= 0.5,
        image: img ? { complete: img.complete, naturalWidth: img.naturalWidth } : null,
        videoInDom: document.querySelectorAll("video").length,
      };
    }, GATE);

    hr(name);
    line(`consent   : ${JSON.stringify(report.consent)}`);
    line(`probe     : ${JSON.stringify(report.probe)}`);
    line(`hero box  : ${JSON.stringify(report.heroBox)}  (gate needs ratio >= 0.5 → ${report.heroHalfVisible})`);
    line(`image     : ${JSON.stringify(report.image)}`);
    line(`video     : ${report.videoInDom} element(s) in DOM`);
  } finally {
    await browser.close();
  }
}

await run("desktop 1440x900, unrestricted", { viewport: "desktop" });
await run("desktop 1440x900, 400 kbps + 300ms", {
  viewport: "desktop",
  network: { latency: 300, downloadThroughput: (400 * 1024) / 8 },
});
await run("desktop 1440x900, 4 Mbps + 60ms", {
  viewport: "desktop",
  network: { latency: 60, downloadThroughput: (4 * 1024 * 1024) / 8 },
});
await run("phone 390x844 (touch, hover:none)", { viewport: "phone", mobile: true });
await run("desktop, prefers-reduced-motion", { viewport: "desktop", reducedMotion: true });
await run("desktop, save-data", { viewport: "desktop", saveData: true });
