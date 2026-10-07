/**
 * The hero clip's contract, checked end to end.
 *
 *   1. it downloads in the background and reveals as soon as it can play through
 *   2. it plays a counted number of passes, not indefinitely
 *   3. after the last pass it dissolves back to the photograph and stays there
 *   4. a hover replay starts it again from zero, and leaving dissolves back
 *   5. no request for the clip is ever aborted or repeated
 *
 * Hover needs a device that claims to have one, and headless Chrome reports
 * `hover: none`, so the media features are emulated before any of this runs.
 *
 *   node scripts/audit/verify-hero.mjs [--passes=4] [--base=http://localhost:3000]
 */
import { launch, installVideoRecorder, sleep, line, hr } from "./lib.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const BASE = args.base ?? "http://localhost:3000";
const PASSES = Number(args.passes ?? 4);

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  line(`${ok ? "ok   " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  /*
    Claim a mouse so the hover path is the one under test. Headless Chrome
    reports `hover: none` / `pointer: coarse`, which is correct for the browser
    but means the hover branch can never be reached. This answers only that one
    query and delegates everything else — including the reduced-motion and
    `update: slow` queries the consent gate reads — to the real implementation.
    (Driving it through CDP's `Emulation.setEmulatedMedia` instead made the
    consent gate refuse the clip outright, which is worse than useless: it tests
    a browser nobody has.)
  */
  await page.evaluateOnNewDocument(() => {
    const real = window.matchMedia.bind(window);
    const FINE_POINTER = "(hover: hover) and (pointer: fine)";
    window.matchMedia = (query) => {
      if (query !== FINE_POINTER) return real(query);
      const list = real(query);
      return new Proxy(list, {
        get(target, prop) {
          if (prop === "matches") return true;
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    };
  });

  const aborted = [];
  const mp4Responses = [];
  page.on("requestfailed", (r) => {
    if (/\.mp4/.test(r.url())) aborted.push(`${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (/\.mp4/.test(r.url())) mp4Responses.push(r.status());
  });

  await installVideoRecorder(page);

  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });

  const read = () =>
    page.evaluate(() => {
      const v = document.querySelector("video");
      return {
        exists: !!v,
        shown: v?.hasAttribute("data-shown") ?? false,
        paused: v?.paused ?? null,
        t: v ? Number(v.currentTime.toFixed(2)) : null,
        loop: v?.loop ?? null,
        ends: window.__media?.events?.filter((e) => e.type === "ended").length ?? 0,
        opacity: v ? Number(getComputedStyle(v).opacity) : null,
      };
    });

  // 1. background download + reveal
  let reveal = null;
  let firstPassEnds = null;
  const deadline = t0 + 20000;
  while (Date.now() < deadline) {
    await sleep(150);
    const s = await read();
    if (!reveal && s.shown && s.paused === false) reveal = Date.now() - t0;
    if (s.ends >= 1) {
      firstPassEnds = Date.now() - t0;
      break;
    }
  }
  hr("playback");
  check("clip reveals and starts on its own", reveal !== null, reveal === null ? "" : `at ${reveal}ms`);
  check("the first pass ends", firstPassEnds !== null, firstPassEnds === null ? "no `ended` within 20s" : `at ${firstPassEnds}ms`);
  check("only one request, nothing aborted", aborted.length === 0 && mp4Responses.length === 1, `responses=${mp4Responses.join("/")} aborted=${aborted.join("/") || "none"}`);

  // 2/3. passes, then handover
  const passTimes = [];
  const passesDeadline = Date.now() + (PASSES + 2) * 12000;
  let state = await read();
  while (state.ends < PASSES && Date.now() < passesDeadline) {
    await sleep(400);
    state = await read();
    if (state.ends > passTimes.length) passTimes.push(Date.now() - t0);
  }
  check(`it plays exactly ${PASSES} passes`, state.ends === PASSES, `${state.ends} ended events: ${passTimes.join(", ")}ms`);

  // The handover: wait for the dissolve to finish and check the photograph is back.
  await sleep(1600);
  state = await read();
  check("it hands back to the photograph after the last pass", !state.shown, `shown=${state.shown} opacity=${state.opacity}`);
  check("and stops", state.paused === true, `paused=${state.paused}`);

  // 4. hover replay
  await page.hover("#scroll-hero-trigger");
  await sleep(1200);
  const hovered = await read();
  check("hover starts it again from the beginning", hovered.shown && hovered.paused === false, JSON.stringify(hovered));
  check("the hover replay restarts at zero", hovered.t !== null && hovered.t < 3, `t=${hovered.t}`);
  check("the hover replay loops", hovered.loop === true, `loop=${hovered.loop}`);

  await page.mouse.move(5, 5);
  await sleep(1400);
  const left = await read();
  check("leaving dissolves back to the photograph", !left.shown && left.paused === true, JSON.stringify(left));

  // 5. no control UI left behind ("Copy Email" is a button and is expected)
  const controls = await page.evaluate(() =>
    [...document.querySelectorAll("#scroll-hero-trigger button")]
      .map((b) => (b.getAttribute("aria-label") ?? "").trim())
      .filter((label) => /pause|play/i.test(label))
  );
  check("no pause/play control on the hero", controls.length === 0, JSON.stringify(controls));

  // Screen state after everything: what is actually painted.
  hr("end state");
  line(JSON.stringify(await read()));
} finally {
  await browser.close();
}

hr(failures ? `${failures} check(s) failed` : "all checks passed");
process.exitCode = failures ? 1 : 0;
