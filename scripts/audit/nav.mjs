/**
 * Verification for the wayfinding changes.
 *
 * Checks the things a visitor would notice: is there a menu on a phone, does it
 * open and close, is each row big enough to tap, does the nav say where you are,
 * and does clicking a nav item leave the heading visible rather than tucked
 * under the sticky header.
 *
 *   node scripts/audit/nav.mjs
 */
import { launch, sleep, VIEWPORTS, line, hr } from "./lib.mjs";

const browser = await launch({ mobile: true });
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  line(`${ok ? "ok   " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  /* ---------------------------------------------------------------- phone */
  const phone = await browser.newPage();
  await phone.setViewport(VIEWPORTS.phone);
  await phone.goto("http://localhost:3000/", { waitUntil: "load", timeout: 120000 });
  await sleep(2000);

  hr("phone 390x844");

  const menuButton = await phone.evaluate(() => {
    const btn = [...document.querySelectorAll("header button")].find((b) =>
      /menu/i.test(b.getAttribute("aria-label") ?? "")
    );
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { label: btn.getAttribute("aria-label"), expanded: btn.getAttribute("aria-expanded"), w: Math.round(r.width), h: Math.round(r.height) };
  });
  check("a menu button exists on a phone", !!menuButton, JSON.stringify(menuButton));
  check("menu button is a usable target", (menuButton?.h ?? 0) >= 24, `${menuButton?.w}x${menuButton?.h}`);
  check("menu button is collapsed initially", menuButton?.expanded === "false");

  await phone.click("header button[aria-controls='site-menu']");
  await sleep(400);

  const panel = await phone.evaluate(() => {
    const el = document.getElementById("site-menu");
    if (!el) return null;
    const links = [...el.querySelectorAll("a")];
    return {
      visible: el.getBoundingClientRect().height > 0,
      expanded: document.querySelector("header button[aria-controls='site-menu']")?.getAttribute("aria-expanded"),
      count: links.length,
      labels: links.map((a) => a.textContent.trim().replace(/\s+/g, " ")),
      heights: links.map((a) => Math.round(a.getBoundingClientRect().height)),
      coverHeader: el.getBoundingClientRect().top < 57,
    };
  });
  check("panel opens", !!panel?.visible, JSON.stringify(panel?.labels));
  check("aria-expanded flips to true", panel?.expanded === "true");
  check("panel lists every nav item", (panel?.count ?? 0) >= 5, `${panel?.count} items`);
  check("every row is at least 44px tall", (panel?.heights ?? [0]).every((h) => h >= 44), JSON.stringify(panel?.heights));

  // Escape closes it.
  await phone.keyboard.press("Escape");
  await sleep(300);
  const afterEscape = await phone.evaluate(() => !!document.getElementById("site-menu"));
  check("Escape closes the panel", !afterEscape);

  // A link closes it too.
  await phone.click("header button[aria-controls='site-menu']");
  await sleep(300);
  await phone.click("#site-menu a[href='#stack']");
  await sleep(2500);
  const afterClick = await phone.evaluate(() => ({
    panel: !!document.getElementById("site-menu"),
    url: location.hash,
    stackTop: Math.round(document.getElementById("stack").getBoundingClientRect().top),
  }));
  check("selecting an item closes the panel", !afterClick.panel);
  check("it scrolled to the section", afterClick.url === "#stack", afterClick.url);
  /*
    The sticky header is 57px tall. A heading that lands under it is the classic
    "the link went to the wrong place" bug, so the section top must be at or
    below the header, not behind it.
  */
  check(
    "the target heading is not hidden under the header",
    afterClick.stackTop >= 55,
    `#stack top = ${afterClick.stackTop}px (header is 57px)`
  );

  await phone.close();

  /* -------------------------------------------------------------- desktop */
  const desktop = await browser.newPage();
  await desktop.setViewport(VIEWPORTS.desktop);
  await desktop.goto("http://localhost:3000/", { waitUntil: "load", timeout: 120000 });
  await sleep(2000);

  hr("desktop 1440x900");

  const atTop = await desktop.evaluate(() => ({
    mobileButton: !!document.querySelector("header button[aria-controls='site-menu']")?.getBoundingClientRect().width,
    activeItems: [...document.querySelectorAll(".gooey-nav-container li")].filter((li) => li.classList.contains("active")).map((li) => li.textContent.trim()),
  }));
  check("no hamburger on a large screen", atTop.mobileButton === false);
  check(
    "nothing is claimed as current at the top of the page",
    atTop.activeItems.length === 0,
    JSON.stringify(atTop.activeItems)
  );

  /*
    Put each section's top around 40% of the viewport, which is what a real
    jump to it looks like: above the midline, so the section is the one you are
    in. The last section is exempt — the page cannot scroll far enough to place
    it there, and the bottom-of-page rule is what covers that case.
  */
  const spy = [];
  for (const id of ["projects", "stack", "timeline", "system"]) {
    const clamped = await desktop.evaluate((target) => {
      const el = document.getElementById(target);
      const wanted = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, Math.min(wanted, max)), behavior: "instant" });
      return wanted > max;
    }, id);
    await sleep(900);
    const state = await desktop.evaluate(() => ({
      active: [...document.querySelectorAll(".gooey-nav-container li")].filter((li) => li.classList.contains("active")).map((li) => li.textContent.trim()),
      effectText: document.querySelector(".gooey-nav-container .effect.text")?.textContent ?? null,
    }));
    spy.push({ id, clamped, ...state });
  }
  for (const row of spy) {
    check(
      `nav shows "${row.id}" while it is on screen`,
      row.active.length === 1 && row.active[0].toLowerCase().includes(row.id.slice(0, 5)),
      `active=${JSON.stringify(row.active)} pill=${row.effectText}${row.clamped ? " (scroll clamped at page bottom)" : ""}`
    );
  }

  // Tap targets on the footer + project links.
  const targets = await desktop.evaluate(() =>
    [...document.querySelectorAll("footer a, #projects a")]
      .map((a) => ({ t: a.textContent.trim().slice(0, 24), h: Math.round(a.getBoundingClientRect().height) }))
      .filter((x) => x.h > 0)
  );
  const tooSmall = targets.filter((t) => t.h < 24);
  check(
    "footer and project links meet the 24px minimum target",
    tooSmall.length === 0,
    tooSmall.length ? JSON.stringify(tooSmall) : `${targets.length} links checked`
  );

  await desktop.close();
} finally {
  await browser.close();
}

hr(failures ? `${failures} check(s) failed` : "all checks passed");
process.exitCode = failures ? 1 : 0;
