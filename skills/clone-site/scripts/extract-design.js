// clone-site :: design-system extractor
//
// Paste the whole file as the `function` argument of mcp__chrome-devtools__evaluate_script,
// or `page.evaluate(<this file>)` under playwright. Returns a JSON-serializable report.
// Pair it with evaluate_script's `filePath` so the payload lands on disk, not in context.
//
// Design note: colors are weighted by the area they actually paint, not by how many nodes
// reference them. A background on one 1440x700 hero must outrank one on forty 16px icons;
// a raw frequency count inverts exactly that and is why eyeballed clones miss the palette.

() => {
  const P = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;
  const add = (m, k, w = 1) => {
    if (k == null || k === '' || k === 'none' || k === 'normal') return;
    m.set(k, (m.get(k) || 0) + w);
  };
  const top = (m, n = 28) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([value, weight]) => ({ value, weight: P(weight) }));

  const BLANK = /^(transparent|rgba?\(\s*0,\s*0,\s*0,\s*0\s*\))$/i;
  const isBlank = (c) => !c || BLANK.test(c.trim());

  // Sites now author in lab()/oklab() (Tailwind v4 emits it), and computed styles hand it
  // straight back. Rasterize one pixel to recover portable sRGB hex for the token file.
  const _cv = document.createElement('canvas');
  _cv.width = _cv.height = 1;
  const _cx = _cv.getContext('2d', { willReadFrequently: true });
  const _hexCache = new Map();
  // An invalid value leaves fillStyle untouched, so black and garbage would look alike.
  // Validate through a throwaway style declaration first.
  const _probe = document.createElement('span').style;
  const _isColor = (css) => {
    _probe.color = '';
    _probe.color = css;
    return _probe.color !== '';
  };
  const toHex = (css) => {
    if (!css || /gradient|url\(/.test(css)) return null;
    if (_hexCache.has(css)) return _hexCache.get(css);
    let out = null;
    if (_isColor(css)) {
      try {
        _cx.clearRect(0, 0, 1, 1);
        _cx.fillStyle = css;
        _cx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = _cx.getImageData(0, 0, 1, 1).data;
        const hex = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
        out = a < 255 ? `${hex} @${P(a / 255, 2)}` : hex;
      } catch {
        out = null;
      }
    }
    _hexCache.set(css, out);
    return out;
  };

  // Tailwind v4 and shadcn both author colour in oklch, and this project's globals.css
  // follows suit — so emit that form too and skip a hand conversion at token time.
  const toOklch = (css) => {
    const hex = toHex(css);
    if (!hex) return null;
    const [, r8, g8, b8] = hex.match(/^#(\w\w)(\w\w)(\w\w)/) || [];
    if (!r8) return null;
    const lin = (v) => {
      v = parseInt(v, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = [lin(r8), lin(g8), lin(b8)];
    // sRGB -> LMS (Björn Ottosson's Oklab matrices), cube-rooted, -> Oklab -> Oklch
    const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
    const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
    const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
    const C = Math.sqrt(A * A + B * B);
    const Hdeg = C < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
    const alpha = hex.match(/@([\d.]+)/);
    return `oklch(${P(L * 100, 2)}% ${P(C, 4)} ${P(Hdeg, 2)}${alpha ? ` / ${alpha[1]}` : ''})`;
  };

  // Colour lists carry sRGB alongside the authored value.
  const topColors = (m, n = 28) =>
    top(m, n).map((e) => {
      const hex = toHex(e.value);
      return hex ? { ...e, hex, oklch: toOklch(e.value) } : e;
    });

  // Border keys are "<width> <style> <color>" — hex the colour tail only.
  const topBorders = (m, n = 28) =>
    top(m, n).map((e) => {
      const parts = e.value.split(' ');
      const hex = toHex(parts.slice(2).join(' '));
      return hex ? { ...e, hex } : e;
    });

  // Tailwind's shadow reset paints "rgba(0,0,0,0) 0px 0px 0px 0px" — often several such
  // layers — on huge numbers of nodes. Those are no-ops and would otherwise top the
  // ranking as pure noise. Judge on geometry: strip every colour token, then keep the
  // shadow only if some offset, blur or spread that remains is non-zero.
  const isNoopShadow = (v) => {
    if (!v || v === 'none') return true;
    const geom = v
      .replace(/\b(?:rgba?|hsla?|lab|lch|oklab|oklch|color|color-mix)\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, ' ')
      .replace(/#[0-9a-f]{3,8}\b/gi, ' ');
    return !(geom.match(/-?\d*\.?\d+/g) || []).some((n) => parseFloat(n) !== 0);
  };

  // ---------------------------------------------------------------- accumulators
  const bg = new Map();
  const fg = new Map();
  const bd = new Map();
  const families = new Map();
  const sizes = new Map();
  const weights = new Map();
  const leading = new Map();
  const tracking = new Map();
  const typeCombos = new Map();
  const padding = new Map();
  const margin = new Map();
  const gaps = new Map();
  const radii = new Map();
  const shadows = new Map();
  const transitions = new Map();
  const transforms = new Map();
  const grids = new Map();
  const widths = new Map();

  let visible = 0;
  let widest = 0;

  // ---------------------------------------------------------------- element walk
  for (const el of document.querySelectorAll('*')) {
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'LINK') continue;

    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;

    const r = el.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    if (w < 1 || h < 1) continue;

    visible++;
    const area = w * h;

    // Background: weighted by painted box area.
    if (!isBlank(s.backgroundColor)) add(bg, s.backgroundColor, area);
    if (s.backgroundImage !== 'none' && /gradient/.test(s.backgroundImage)) {
      add(bg, s.backgroundImage.slice(0, 180), area);
    }

    // Text color: weighted by ink, not by box. A 2000px wrapper inheriting a color
    // paints no glyphs, so box area would badly over-count it.
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('').length;
    if (own > 0 && !isBlank(s.color)) {
      const px = parseFloat(s.fontSize) || 16;
      add(fg, s.color, own * px);

      add(families, s.fontFamily, own);
      add(sizes, `${P(px, 1)}px`, own);
      add(weights, s.fontWeight, own);
      const lh = s.lineHeight === 'normal' ? 'normal' : `${P(parseFloat(s.lineHeight) / px, 2)}`;
      add(leading, lh, own);
      add(tracking, s.letterSpacing, own);
      add(
        typeCombos,
        `${P(px, 1)}px / ${s.fontWeight} / lh ${lh} / ls ${s.letterSpacing} / ${s.fontFamily.split(',')[0].replace(/["']/g, '')}`,
        own,
      );
    }

    // Borders: weighted by the stroke area actually drawn.
    const bw = parseFloat(s.borderTopWidth) || 0;
    if (bw > 0 && !isBlank(s.borderTopColor)) {
      add(bd, `${P(bw, 1)}px ${s.borderTopStyle} ${s.borderTopColor}`, (w + h) * 2 * bw);
    }

    if (s.borderRadius && s.borderRadius !== '0px') add(radii, s.borderRadius, area);
    if (s.boxShadow !== 'none' && !isNoopShadow(s.boxShadow)) add(shadows, s.boxShadow, area);

    if (s.transitionDuration !== '0s') {
      add(transitions, `${s.transitionProperty} ${s.transitionDuration} ${s.transitionTimingFunction}`);
    }
    if (s.transform !== 'none') add(transforms, s.transform.slice(0, 90));

    for (const side of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight']) {
      const v = parseFloat(s[side]);
      if (v > 0) add(padding, `${P(v, 1)}px`);
    }
    for (const side of ['marginTop', 'marginBottom']) {
      const v = parseFloat(s[side]);
      if (v > 0) add(margin, `${P(v, 1)}px`);
    }
    if (s.display === 'grid' || s.display === 'flex' || s.display === 'inline-flex') {
      for (const g of [s.rowGap, s.columnGap]) {
        const v = parseFloat(g);
        if (v > 0) add(gaps, `${P(v, 1)}px`);
      }
    }
    if (s.display === 'grid' && s.gridTemplateColumns !== 'none') {
      const cols = s.gridTemplateColumns.split(' ').length;
      add(grids, `${cols} cols :: ${s.gridTemplateColumns.slice(0, 110)}`);
    }

    // Content container width: the recurring inner width is the layout's max-width,
    // even when it is expressed as a percentage or a clamp().
    if (w > 320 && w < innerWidth - 1 && h > 40) {
      add(widths, `${Math.round(w)}px`, 1);
      if (w > widest) widest = w;
    }
  }

  // ---------------------------------------------------------------- stylesheets
  // Same-origin sheets only; cross-origin .cssRules throws. Anything unreadable here
  // is still observable through computed styles above, so a miss is not fatal.
  const breakpoints = new Set();
  const keyframes = new Set();
  let sheetsRead = 0;
  let sheetsBlocked = 0;

  const walkRules = (rules) => {
    for (const rule of rules) {
      if (rule.type === 4 || rule instanceof CSSMediaRule) {
        const c = rule.conditionText || rule.media?.mediaText || '';
        for (const m of c.matchAll(/\((?:min|max)-width:\s*([\d.]+)(px|r?em)\)/g)) {
          const n = parseFloat(m[1]);
          breakpoints.add(Math.round(m[2] === 'px' ? n : n * 16));
        }
        if (rule.cssRules) walkRules(rule.cssRules);
      } else if (rule instanceof CSSKeyframesRule) {
        keyframes.add(rule.name);
      } else if (rule.cssRules) {
        walkRules(rule.cssRules);
      }
    }
  };

  for (const sheet of document.styleSheets) {
    try {
      walkRules(sheet.cssRules);
      sheetsRead++;
    } catch {
      sheetsBlocked++;
    }
  }

  // ---------------------------------------------------------------- :root tokens
  // If the target is token-driven this returns its design system verbatim. Check first.
  const cssVars = {};
  try {
    const rs = getComputedStyle(document.documentElement);
    for (const prop of rs) {
      if (prop.startsWith('--')) cssVars[prop] = rs.getPropertyValue(prop).trim().slice(0, 160);
    }
  } catch {
    /* ignore */
  }

  // ---------------------------------------------------------------- section spine
  // Descend through single-child wrappers first, otherwise every site reports "1 section".
  let host = document.querySelector('main') || document.body;
  let guard = 0;
  while (host.children.length === 1 && host.children[0].children.length > 1 && guard++ < 6) {
    host = host.children[0];
  }

  const sections = [...host.children]
    .map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (s.display === 'none' || r.height < 24) return null;
      const heading = el.querySelector('h1, h2, h3, [role="heading"]');
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: (el.className?.toString?.() || '').slice(0, 110) || null,
        height: Math.round(r.height),
        padTop: s.paddingTop,
        padBottom: s.paddingBottom,
        bg: isBlank(s.backgroundColor) ? null : s.backgroundColor,
        children: el.children.length,
        heading: heading ? heading.textContent.trim().slice(0, 90) : null,
      };
    })
    .filter(Boolean);

  // ---------------------------------------------------------------- assets
  const images = [...document.images]
    .filter((i) => i.getBoundingClientRect().width > 24)
    .slice(0, 60)
    .map((i) => ({
      src: (i.currentSrc || i.src).slice(0, 190),
      rendered: `${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`,
      natural: `${i.naturalWidth}x${i.naturalHeight}`,
      fit: getComputedStyle(i).objectFit,
      alt: (i.alt || '').slice(0, 70) || null,
    }));

  const fonts = [];
  try {
    document.fonts.forEach((f) => {
      if (f.status === 'loaded') fonts.push(`${f.family} ${f.weight} ${f.style}`);
    });
  } catch {
    /* ignore */
  }

  // ---------------------------------------------------------------- report
  const body = getComputedStyle(document.body);

  return {
    meta: {
      url: location.href,
      title: document.title,
      viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
      scrollHeight: document.documentElement.scrollHeight,
      colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      visibleElements: visible,
      sheetsRead,
      sheetsBlocked,
      cssVarCount: Object.keys(cssVars).length,
      capturedAt: new Date().toISOString(),
    },

    // Ranked by painted area / ink, not by node count. Read the head of each list.
    // `hex` is sRGB for the token file; `value` is what the site actually authored.
    colors: { background: topColors(bg), text: topColors(fg), border: topBorders(bd) },

    type: {
      bodyFont: body.fontFamily,
      bodySize: body.fontSize,
      families: top(families, 10),
      // The distinct sizes here ARE the type scale. Do not invent a new ladder.
      sizes: top(sizes, 20),
      weights: top(weights, 10),
      lineHeights: top(leading, 12),
      letterSpacings: top(tracking, 10),
      combos: top(typeCombos, 24),
    },

    // Cluster these to find the base unit (usually 4 or 8). Section rhythm is its
    // own much larger scale — read it off `sections[].padTop/padBottom` instead.
    spacing: { padding: top(padding, 24), margin: top(margin, 20), gap: top(gaps, 16) },

    radii: top(radii, 14),
    // Copy shadow strings verbatim. Guessed shadows are the fastest tell of a clone.
    shadows: top(shadows, 12),
    motion: { transitions: top(transitions, 18), transforms: top(transforms, 12), keyframes: [...keyframes].slice(0, 40) },

    layout: {
      widestContent: Math.round(widest),
      commonWidths: top(widths, 14),
      grids: top(grids, 14),
      breakpoints: [...breakpoints].sort((a, b) => a - b),
    },

    sections,
    images,
    fonts: [...new Set(fonts)],
    cssVars,
  };
}
