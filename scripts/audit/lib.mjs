/**
 * Shared harness for the audit scripts.
 *
 * Not part of the app — `scripts/audit/` is a scratch space for inspecting the
 * running site. Everything here launches the system Chrome through
 * puppeteer-core (there is no bundled Chromium) and talks to the dev server on
 * :3000.
 */
import puppeteer from "puppeteer-core";

export const CHROME = "/usr/bin/google-chrome";
export const BASE = process.env.AUDIT_BASE ?? "http://localhost:3000";

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  laptop: { width: 1280, height: 800, deviceScaleFactor: 1 },
  tablet: { width: 834, height: 1112, deviceScaleFactor: 1 },
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

export async function launch({ mobile = false } = {}) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: "shell",
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--enable-unsafe-swiftshader",
      // Deterministic: no autoplay heuristics beyond what the page itself does.
      "--autoplay-policy=no-user-gesture-required",
      ...(mobile ? ["--touch-events=enabled"] : []),
    ],
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Opens a page with console/pageerror/request instrumentation attached. */
export async function openPage(browser, { viewport = "desktop", url = "/", deferGoto = false } = {}) {
  const page = await browser.newPage();
  const vp = VIEWPORTS[viewport] ?? VIEWPORTS.desktop;
  await page.setViewport(vp);

  const errors = [];
  const warnings = [];
  const requests = [];

  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error") errors.push(text.slice(0, 300));
    else if (m.type() === "warning") warnings.push(text.slice(0, 300));
  });
  page.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 300)}`));
  page.on("requestfailed", (r) =>
    requests.push({ url: r.url(), status: "FAILED", reason: r.failure()?.errorText })
  );
  page.on("response", (r) => {
    const url = r.url();
    if (/\.(mp4|webm|glb|jpeg|png|webp)(\?|$)/.test(url)) {
      const len = r.headers()["content-length"];
      requests.push({
        url: url.replace(BASE, ""),
        status: r.status(),
        bytes: len ? Number(len) : null,
        type: r.request().resourceType(),
      });
    }
  });

  const goto = () =>
    page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (!deferGoto) await goto();
  return { page, errors, warnings, requests, goto };
}

/**
 * Installs a recorder in the page that watches for <video> elements appearing,
 * then logs every media event on each of them with a timestamp. Installed
 * before the app's JS runs, so nothing is missed.
 */
export async function installVideoRecorder(page) {
  await page.evaluateOnNewDocument(() => {
    const w = window;
    w.__media = { videos: [], events: [], requests: [], t0: performance.now() };

    const now = () => Math.round(performance.now() - w.__media.t0);

    const MEDIA_EVENTS = [
      "loadstart", "durationchange", "loadedmetadata", "loadeddata", "canplay",
      "canplaythrough", "progress", "suspend", "stalled", "waiting", "playing",
      "play", "pause", "seeking", "seeked", "timeupdate", "ended", "error",
      "abort", "emptied", "ratechange", "volumechange",
    ];

    const watch = (v) => {
      if (v.__watched) return;
      v.__watched = true;
      w.__media.videos.push(v);
      w.__media.events.push({ t: now(), type: "MOUNTED", src: v.getAttribute("src") });
      for (const name of MEDIA_EVENTS) {
        if (name === "timeupdate" || name === "progress") continue; // low value, noisy
        v.addEventListener(name, () => {
          w.__media.events.push({
            t: now(),
            type: name,
            readyState: v.readyState,
            networkState: v.networkState,
            currentTime: Number(v.currentTime.toFixed(3)),
            duration: Number.isFinite(v.duration) ? Number(v.duration.toFixed(3)) : String(v.duration),
            bufferedEnd: v.buffered.length
              ? Number(v.buffered.end(v.buffered.length - 1).toFixed(3))
              : 0,
            paused: v.paused,
            error: v.error ? `${v.error.code}:${v.error.message}` : null,
          });
        });
      }
      // Attribute flips are the app's reveal signal.
      new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.attributeName === "data-shown") {
            w.__media.events.push({
              t: now(),
              type: v.hasAttribute("data-shown") ? "REVEALED" : "HIDDEN",
            });
          }
        }
      }).observe(v, { attributes: true, attributeFilter: ["data-shown"] });
    };

    const scan = () => {
      if (!document.documentElement) return false;
      document.querySelectorAll("video").forEach(watch);
      return true;
    };
    /*
      At document-start `document.documentElement` does not exist yet, so an
      observer on it silently throws and the recorder misses every element the
      app later mounts. Poll until it exists, then observe for real — with a
      slow interval as a belt-and-braces rescan, since a <video> can be swapped
      in and out between mutations while the watchdog runs.
    */
    const arm = () => {
      if (!scan()) return false;
      new MutationObserver(scan).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      setInterval(scan, 250);
      return true;
    };
    if (!arm()) {
      const t = setInterval(() => {
        if (arm()) clearInterval(t);
      }, 10);
    }

    // Every request the page makes for media, with timing.
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!/\.(mp4|webm)/.test(e.name)) continue;
        w.__media.requests.push({
          name: e.name.replace(location.origin, ""),
          startTime: Math.round(e.startTime),
          responseEnd: Math.round(e.responseEnd),
          transferSize: e.transferSize,
          encodedBodySize: e.encodedBodySize,
          initiatorType: e.initiatorType,
        });
      }
    }).observe({ entryTypes: ["resource"] });
  });
}

/** Snapshot the recorder state plus the live DOM state of every <video>. */
export async function readVideoState(page) {
  return page.evaluate(() => {
    const w = window;
    const dom = [...document.querySelectorAll("video")].map((v) => ({
      src: v.getAttribute("src") ?? v.currentSrc,
      preload: v.getAttribute("preload"),
      muted: v.muted,
      readyState: v.readyState,
      networkState: v.networkState,
      paused: v.paused,
      currentTime: Number(v.currentTime.toFixed(3)),
      duration: Number.isFinite(v.duration) ? Number(v.duration.toFixed(3)) : String(v.duration),
      bufferedEnd: v.buffered.length
        ? Number(v.buffered.end(v.buffered.length - 1).toFixed(3))
        : 0,
      dataShown: v.hasAttribute("data-shown"),
      opacity: getComputedStyle(v).opacity,
      display: getComputedStyle(v).display,
      loop: v.loop,
      error: v.error ? `${v.error.code}:${v.error.message}` : null,
      inDom: document.contains(v),
    }));
    return {
      events: (w.__media?.events ?? []).slice(-80),
      requests: w.__media?.requests ?? [],
      dom,
      mountedCount: w.__media?.videos?.length ?? 0,
    };
  });
}

export const line = (s = "") => process.stdout.write(`${s}\n`);
export const hr = (title) => line(`\n${"─".repeat(72)}\n${title}\n${"─".repeat(72)}`);
