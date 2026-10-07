/**
 * What actually happens to the hero video, event by event.
 *
 * Attaches a recorder before the app's JS runs, sits on the page for a
 * configurable duration, and dumps every media event, every request for the
 * clip, and the live state of each <video> in the DOM. Also reports whether the
 * element was ever unmounted, which is how useHeroVideo's `giveUp()` shows up
 * from the outside.
 *
 *   node scripts/audit/probe-video.mjs [--ms=12000] [--viewport=desktop]
 *                                      [--hover] [--harsh] [--url=/]
 */
import { launch, openPage, installVideoRecorder, readVideoState, sleep, line, hr } from "./lib.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const ms = Number(args.ms ?? 12000);
const viewport = args.viewport ?? "desktop";
const url = args.url ?? "/";

const browser = await launch();
try {
  // The recorder must be registered before navigation or it never sees the
  // document the app actually runs in.
  const { page, errors, requests, goto } = await openPage(browser, {
    viewport,
    url,
    deferGoto: true,
  });
  await installVideoRecorder(page);
  await goto();

  // Harsh mode: throttle to a slow 3G-ish link so the watchdog and the
  // "download in background" behaviour are both visible rather than racing a
  // localhost transfer that finishes in 5ms.
  if (args.harsh) {
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (400 * 1024) / 8, // 400 kbps
      uploadThroughput: (400 * 1024) / 8,
    });
  }

  const samples = [];
  const started = Date.now();
  while (Date.now() - started < ms) {
    await sleep(250);
    const s = await page.evaluate(() => {
      const v = document.querySelector("video");
      return {
        t: Math.round(performance.now()),
        exists: !!v,
        readyState: v?.readyState ?? -1,
        networkState: v?.networkState ?? -1,
        buffered: v?.buffered.length
          ? Number(v.buffered.end(v.buffered.length - 1).toFixed(2))
          : 0,
        paused: v?.paused ?? null,
        shown: v?.hasAttribute("data-shown") ?? null,
        currentTime: v ? Number(v.currentTime.toFixed(2)) : null,
      };
    });
    if (JSON.stringify(samples.at(-1)?.s) !== JSON.stringify(s)) samples.push({ at: Date.now() - started, s });
  }

  if (args.hover) {
    hr("hovering the hero");
    await page.hover("#scroll-hero-trigger");
    await sleep(4000);
  }

  const state = await readVideoState(page);

  hr(`video event log (viewport=${viewport}, url=${url}${args.harsh ? ", throttled 400kbps/150ms" : ""})`);
  for (const e of state.events) {
    line(
      `${String(e.t).padStart(6)}ms  ${e.type.padEnd(16)}` +
        (e.readyState !== undefined
          ? ` rs=${e.readyState} ns=${e.networkState} t=${e.currentTime} buf=${e.bufferedEnd}${e.paused === undefined ? "" : ` paused=${e.paused}`}${e.error ? ` ERR=${e.error}` : ""}`
          : "")
    );
  }
  if (!state.events.length) line("(no media events at all — no <video> was ever added to the DOM)");

  hr("media requests");
  for (const r of requests) line(`${r.status}  ${r.bytes ?? "?"}B  ${r.type}  ${r.url}`);
  for (const r of state.requests)
    line(
      `perf: ${r.name}  start=${r.startTime}ms end=${r.responseEnd}ms  transfer=${r.transferSize}B encoded=${r.encodedBodySize}B`
    );
  if (!requests.length && !state.requests.length) line("(no request for any media file)");

  hr("state timeline (only changes shown)");
  for (const s of samples) line(`${String(s.at).padStart(6)}ms  ${JSON.stringify(s.s)}`);

  hr("final DOM state");
  line(JSON.stringify(state.dom, null, 2));
  line(`<video> elements mounted during the run: ${state.mountedCount}`);

  hr("console errors");
  line(errors.length ? errors.join("\n") : "none");
} finally {
  await browser.close();
}
