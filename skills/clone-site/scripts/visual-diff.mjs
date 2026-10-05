#!/usr/bin/env node
// clone-site :: objective visual diff — zero dependencies
//
//   node visual-diff.mjs ref.png mine.png [--threshold 12] [--bands 24] [--out diff.png]
//
// Exists because the honest version of "does it match" is a number, not a judgement.
// Agents reliably talk themselves into "looks close enough" from two screenshots; a
// percentage and a per-band breakdown cannot be talked into anything.
//
// Chrome/CDP screenshots are 8-bit non-interlaced PNG (colour type 2 or 6), which is
// exactly the case decoded here. Node's zlib does the inflate, so nothing to install.

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decodePng(file) {
  const buf = readFileSync(file);
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error(`${file}: not a PNG`);

  let pos = 8;
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const tag = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (tag === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      interlace = body[12];
    } else if (tag === 'IDAT') {
      idat.push(body);
    } else if (tag === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  if (depth !== 8) throw new Error(`${file}: bit depth ${depth} unsupported (need 8)`);
  if (type !== 2 && type !== 6) throw new Error(`${file}: colour type ${type} unsupported (need 2 or 6)`);
  if (interlace) throw new Error(`${file}: interlaced PNG unsupported`);

  const ch = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4, 255);
  const prev = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);

  for (let y = 0, r = 0; y < h; y++) {
    const filter = raw[r++];
    raw.copy(line, 0, r, r + stride);
    r += stride;

    // Undo the per-scanline filter. Byte-wise, left neighbour is `ch` bytes back.
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      switch (filter) {
        case 0: break;
        case 1: line[i] = (line[i] + a) & 255; break;
        case 2: line[i] = (line[i] + b) & 255; break;
        case 3: line[i] = (line[i] + ((a + b) >> 1)) & 255; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
          break;
        }
        default: throw new Error(`${file}: bad filter ${filter} on row ${y}`);
      }
    }
    line.copy(prev);

    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      out[d] = line[s];
      out[d + 1] = line[s + 1];
      out[d + 2] = line[s + 2];
      out[d + 3] = ch === 4 ? line[s + 3] : 255;
    }
  }
  return { w, h, data: out };
}

// Minimal RGB PNG writer, for the diff mask only.
function encodePng(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (b) => {
    let c = 0xffffffff;
    for (const byte of b) c = table[(c ^ byte) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tag, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(tag, 'ascii'), body]);
    const cr = Buffer.alloc(4);
    cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ compare
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const files = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (files.length < 2) {
  console.error('usage: visual-diff.mjs <ref.png> <mine.png> [--threshold 12] [--bands 24] [--out diff.png]');
  process.exit(2);
}

const THRESH = Number(flag('threshold', 12)); // per-channel, 0-255. 12 ~ 5%, ignores AA noise.
const BANDS = Number(flag('bands', 24));
const OUT = flag('out', null);

const A = decodePng(files[0]);
const B = decodePng(files[1]);

// A height mismatch is itself the finding — vertical rhythm is off somewhere. Compare the
// shared region so the band report still tells you which section drifted.
const w = Math.min(A.w, B.w);
const h = Math.min(A.h, B.h);
const mask = OUT ? Buffer.alloc(w * h * 3) : null;

let differing = 0;
let sumErr = 0;
const bandH = Math.max(1, Math.ceil(h / BANDS));
const bandDiff = new Array(Math.ceil(h / bandH)).fill(0);
const bandTotal = new Array(bandDiff.length).fill(0);

for (let y = 0; y < h; y++) {
  const band = Math.floor(y / bandH);
  for (let x = 0; x < w; x++) {
    const ia = (y * A.w + x) * 4;
    const ib = (y * B.w + x) * 4;
    const dr = Math.abs(A.data[ia] - B.data[ib]);
    const dg = Math.abs(A.data[ia + 1] - B.data[ib + 1]);
    const db = Math.abs(A.data[ia + 2] - B.data[ib + 2]);
    const worst = dr > dg ? (dr > db ? dr : db) : dg > db ? dg : db;
    sumErr += (dr + dg + db) / 3;
    bandTotal[band]++;
    if (worst > THRESH) {
      differing++;
      bandDiff[band]++;
      if (mask) {
        const m = (y * w + x) * 3;
        mask[m] = 255;
        mask[m + 1] = Math.max(0, 255 - worst * 2);
        mask[m + 2] = 0;
      }
    } else if (mask) {
      const g = 235 - Math.round((A.data[ia] + A.data[ia + 1] + A.data[ia + 2]) / 3 / 6);
      const m = (y * w + x) * 3;
      mask[m] = mask[m + 1] = mask[m + 2] = g;
    }
  }
}

const total = w * h;
const pct = (n) => `${((n / total) * 100).toFixed(2)}%`;

console.log(`ref   ${files[0]}  ${A.w}x${A.h}`);
console.log(`mine  ${files[1]}  ${B.w}x${B.h}`);
if (A.w !== B.w || A.h !== B.h) {
  const dh = B.h - A.h;
  console.log(`\n!! size mismatch — compared the shared ${w}x${h} region`);
  console.log(`   height delta ${dh > 0 ? '+' : ''}${dh}px (${((dh / A.h) * 100).toFixed(1)}%) — vertical rhythm is off`);
}

console.log(`\ndiffering pixels  ${differing} / ${total}  (${pct(differing)})  @ threshold ${THRESH}`);
console.log(`mean abs error    ${(sumErr / total).toFixed(2)} / 255`);

console.log('\nby band (top to bottom) — find the section, not the pixel:');
const worstBands = [];
for (let i = 0; i < bandDiff.length; i++) {
  const p = bandTotal[i] ? (bandDiff[i] / bandTotal[i]) * 100 : 0;
  const y0 = i * bandH;
  const bar = '#'.repeat(Math.round(p / 2.5)).padEnd(40, '.');
  console.log(`  y ${String(y0).padStart(5)}-${String(Math.min(h, y0 + bandH) - 1).padStart(5)}  ${bar} ${p.toFixed(1)}%`);
  worstBands.push({ i, y0, y1: Math.min(h, y0 + bandH) - 1, p });
}

worstBands.sort((a, b) => b.p - a.p);
console.log('\nworst three bands:');
for (const b of worstBands.slice(0, 3)) {
  console.log(`  y ${b.y0}-${b.y1}  ${b.p.toFixed(1)}%  <- fix this first`);
}

if (mask) {
  writeFileSync(OUT, encodePng(w, h, mask));
  console.log(`\ndiff mask -> ${OUT}  (red = differing, grey = reference ghost)`);
}

// Rough bands, calibrated on real runs. Anti-aliasing and font hinting alone land
// under ~1.5%, so treat that as the floor rather than a target to beat.
const p = (differing / total) * 100;
const verdict =
  p < 1.5 ? 'MATCH — within rendering noise' :
  p < 4 ? 'CLOSE — check the worst bands for a real difference' :
  p < 12 ? 'DRIFTED — at least one section is materially wrong' :
  'WRONG — structural mismatch, re-read the reference before patching';
console.log(`\nverdict: ${verdict}  (${p.toFixed(2)}%)`);
process.exit(p < 4 ? 0 : 1);
