// lib/gif.mjs — dependency-free GIF89a encoder.
// Median-cut global palette + ordered Bayer dithering + LZW (spec-compliant, no early change).

const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// ---------------------------------------------------------------- palette ---

// Median cut over a 15-bit histogram of every frame, so the palette is shared
// by the whole animation (single global colour table -> smaller file, stable colours).
export function buildPalette(frames, maxColors = 256) {
  const hist = new Map();
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i += 9) {
      const r = d[i] >> 3;
      const g = d[i + 1] >> 3;
      const b = d[i + 2] >> 3;
      const key = (r << 10) | (g << 5) | b;
      hist.set(key, (hist.get(key) || 0) + 1);
    }
  }

  const entries = [];
  for (const [key, count] of hist) {
    entries.push({
      r: (key >> 10) & 31,
      g: (key >> 5) & 31,
      b: key & 31,
      count,
    });
  }
  if (entries.length === 0) entries.push({ r: 0, g: 0, b: 0, count: 1 });

  let boxes = [makeBox(entries)];
  while (boxes.length < maxColors) {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.entries.length < 2) continue;
      const score = box.count * box.range;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    boxes.splice(best, 1, ...splitBox(boxes[best]));
  }

  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const e of box.entries) {
      r += e.r * e.count;
      g += e.g * e.count;
      b += e.b * e.count;
      n += e.count;
    }
    return {
      r: Math.min(255, (r / n) * 8 + 4),
      g: Math.min(255, (g / n) * 8 + 4),
      b: Math.min(255, (b / n) * 8 + 4),
    };
  });
}

function makeBox(entries) {
  let minR = 31;
  let maxR = 0;
  let minG = 31;
  let maxG = 0;
  let minB = 31;
  let maxB = 0;
  let count = 0;
  for (const e of entries) {
    if (e.r < minR) minR = e.r;
    if (e.r > maxR) maxR = e.r;
    if (e.g < minG) minG = e.g;
    if (e.g > maxG) maxG = e.g;
    if (e.b < minB) minB = e.b;
    if (e.b > maxB) maxB = e.b;
    count += e.count;
  }
  const range = Math.max(maxR - minR, maxG - minG, maxB - minB);
  return { entries, count, range, minR, maxR, minG, maxG, minB, maxB };
}

function splitBox(box) {
  const axis =
    box.maxR - box.minR >= box.maxG - box.minG && box.maxR - box.minR >= box.maxB - box.minB
      ? "r"
      : box.maxG - box.minG >= box.maxB - box.minB
        ? "g"
        : "b";
  const sorted = box.entries.slice().sort((a, b) => a[axis] - b[axis]);
  const half = box.count / 2;
  let acc = 0;
  let cut = 0;
  for (let i = 0; i < sorted.length; i++) {
    acc += sorted[i].count;
    cut = i + 1;
    if (acc >= half) break;
  }
  if (cut <= 0 || cut >= sorted.length) cut = Math.floor(sorted.length / 2);
  return [makeBox(sorted.slice(0, cut)), makeBox(sorted.slice(cut))];
}

function nearest(palette, r, g, b) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const dr = r - p.r;
    const dg = g - p.g;
    const db = b - p.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

// Map a frame to palette indices. Ordered dithering is applied only where it
// is actually needed -- across the smooth dark background gradient, where
// quantisation would otherwise show contour banding. Leaving the detailed
// rope pixels undithered avoids injecting noise into them and keeps the file
// small, since dithering is pure high-frequency entropy for the LZW coder.
export function mapFrame(frame, palette, cache, amplitude = 4) {
  const { data, width, height } = frame;
  const out = Buffer.alloc(width * height);
  let i = 0;
  for (let y = 0; y < height; y++) {
    const brow = (y & 7) * 8;
    for (let x = 0; x < width; x++) {
      const o = i * 3;
      const r0 = data[o];
      const g0 = data[o + 1];
      const b0 = data[o + 2];
      // Dark and low-saturation pixels are backdrop: dither them to hide banding.
      const backdrop = r0 < 64 && g0 < 64 && b0 < 72;
      let r = r0;
      let g = g0;
      let b = b0;
      if (backdrop && amplitude > 0) {
        const d = (BAYER8[brow + (x & 7)] / 64 - 0.5) * amplitude;
        r = clamp255(r0 + d);
        g = clamp255(g0 + d);
        b = clamp255(b0 + d);
      }
      const rq = r >> 3;
      const gq = g >> 3;
      const bq = b >> 3;
      const key = (rq << 10) | (gq << 5) | bq;
      let idx = cache.get(key);
      if (idx === undefined) {
        idx = nearest(palette, rq * 8 + 4, gq * 8 + 4, bq * 8 + 4);
        cache.set(key, idx);
      }
      out[i++] = idx;
    }
  }
  return out;
}

// ------------------------------------------------------------------- lzw ---

export function lzwBlocks(indices, minCodeSize = 8) {
  const bytes = [];
  let codeSize = minCodeSize + 1;
  let nextCode = (1 << minCodeSize) + 2;
  let cur = 0;
  let curShift = 0;
  const table = new Map();

  const emit = (code) => {
    cur |= code << curShift;
    curShift += codeSize;
    while (curShift >= 8) {
      bytes.push(cur & 0xff);
      cur >>= 8;
      curShift -= 8;
    }
  };

  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  emit(clearCode);
  let ibCode = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (ibCode << 8) | k;
    const found = table.get(key);
    if (found !== undefined) {
      ibCode = found;
      continue;
    }
    emit(ibCode);
    if (nextCode === 4096) {
      emit(clearCode);
      table.clear();
      nextCode = eoiCode + 1;
      codeSize = minCodeSize + 1;
    } else {
      if (nextCode >= 1 << codeSize) codeSize++;
      table.set(key, nextCode++);
    }
    ibCode = k;
  }
  emit(ibCode);
  emit(eoiCode);
  if (curShift > 0) bytes.push(cur & 0xff);

  const parts = [Buffer.from([minCodeSize])];
  for (let i = 0; i < bytes.length; i += 255) {
    const slice = Buffer.from(bytes.slice(i, i + 255));
    parts.push(Buffer.from([slice.length]), slice);
  }
  parts.push(Buffer.from([0x00]));
  return Buffer.concat(parts);
}

// ------------------------------------------------------------------ file ---

const u16 = (v) => Buffer.from([v & 0xff, (v >> 8) & 0xff]);

export function assembleGif({ frames, palette, width, height, delayCs = 8, loop = 0 }) {
  const parts = [];
  parts.push(Buffer.from("GIF89a", "ascii"));
  parts.push(Buffer.concat([u16(width), u16(height), Buffer.from([0xf7, 0x00, 0x00])]));

  const gct = Buffer.alloc(768);
  palette.forEach((c, i) => {
    gct[i * 3] = c.r | 0;
    gct[i * 3 + 1] = c.g | 0;
    gct[i * 3 + 2] = c.b | 0;
  });
  parts.push(gct);

  // NETSCAPE2.0 application extension -> infinite loop.
  parts.push(
    Buffer.concat([
      Buffer.from([0x21, 0xff, 0x0b]),
      Buffer.from("NETSCAPE2.0", "ascii"),
      Buffer.from([0x03, 0x01]),
      u16(loop),
      Buffer.from([0x00]),
    ]),
  );

  for (const f of frames) {
    // Graphic control extension: disposal 1 (leave in place), no transparency.
    parts.push(
      Buffer.concat([
        Buffer.from([0x21, 0xf9, 0x04, 0x04]),
        u16(delayCs),
        Buffer.from([0x00, 0x00]),
      ]),
    );
    parts.push(
      Buffer.concat([
        Buffer.from([0x2c]),
        u16(0),
        u16(0),
        u16(width),
        u16(height),
        Buffer.from([0x00]),
      ]),
    );
    parts.push(lzwBlocks(f.indices, 8));
  }

  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}
