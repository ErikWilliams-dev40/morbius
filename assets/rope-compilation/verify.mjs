// verify.mjs — checks the encoded GIF.
//
//   node verify.mjs [file.gif]
//
// Parses the GIF's raw block structure, then decodes every frame with libvips
// (an independent decoder) and compares it against a fresh render of the same
// frame, so a broken encoder cannot pass unnoticed.
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { frameSvg, W, H, CLIP_FRAMES, CLIP_COUNT } from "./lib/render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const gifPath = resolve(HERE, process.argv[2] ?? "rope-compilation.gif");
const buf = await readFile(gifPath);

console.log("signature     :", buf.toString("ascii", 0, 6));
const width = buf.readUInt16LE(6);
const height = buf.readUInt16LE(8);
const packed = buf[10];
console.log(
  "logical screen:",
  width + "x" + height,
  "| global palette:",
  !!(packed & 0x80),
  2 ** ((packed & 7) + 1),
);

let p = 13 + (packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0);
let gce = 0;
let images = 0;
const delays = new Set();
let netscape = false;
let loop = null;
const descs = [];

while (p < buf.length) {
  const b = buf[p];
  if (b === 0x3b) {
    console.log("trailer       : byte", p, "of", buf.length);
    break;
  }
  if (b === 0x21) {
    const label = buf[p + 1];
    if (label === 0xf9) {
      gce++;
      delays.add(buf.readUInt16LE(p + 4));
      p += 8;
      continue;
    }
    if (label === 0xff) {
      const size = buf[p + 2];
      if (buf.toString("ascii", p + 3, p + 14) === "NETSCAPE2.0") {
        netscape = true;
        loop = buf.readUInt16LE(p + 17);
      }
      p += 3 + size;
      while (buf[p] !== 0) p += buf[p] + 1;
      p++;
      continue;
    }
    p += 2;
    while (buf[p] !== 0) p += buf[p] + 1;
    p++;
    continue;
  }
  if (b === 0x2c) {
    images++;
    descs.push({
      w: buf.readUInt16LE(p + 5),
      h: buf.readUInt16LE(p + 7),
      local: !!(buf[p + 9] & 0x80),
      interlaced: !!(buf[p + 9] & 0x40),
    });
    p += 10;
    p++;
    while (buf[p] !== 0) p += buf[p] + 1;
    p++;
    continue;
  }
  throw new Error("unknown block 0x" + b.toString(16) + " at " + p);
}

console.log("image blocks  :", images, "| gce blocks:", gce);
console.log("frame delays  :", [...delays].join(", "), "centiseconds");
console.log("netscape ext  :", netscape, "| loop count:", loop, loop === 0 ? "(infinite)" : "");
console.log(
  "frames full-canvas:",
  descs.every((d) => d.w === width && d.h === height),
);
console.log(
  "interlaced    :",
  descs.some((d) => d.interlaced),
);
console.log("file bytes    :", buf.length);

// Decode with libvips and compare against a fresh render of the same frame.
const decoded = await sharp(buf, { animated: true }).raw().toBuffer({ resolveWithObject: true });
console.log(
  "libvips decoded:",
  decoded.info.width + "x" + decoded.info.height,
  "channels",
  decoded.info.channels,
);

let err = 0;
let n = 0;
let worst = 0;
for (let f = 0; f < images; f++) {
  const src = await sharp(Buffer.from(frameSvg(f)), { density: 72 })
    .flatten({ background: "#000" })
    .raw()
    .toBuffer();
  for (let px = 0; px < W * H; px += 5) {
    const o = px * 3;
    for (let ch = 0; ch < 3; ch++) {
      const d = Math.abs(src[o + ch] - decoded.data[f * W * H * 3 + o + ch]);
      err += d;
      if (d > worst) worst = d;
      n++;
    }
  }
}
console.log("mean abs err  :", (err / n).toFixed(2), "/ 255 | max:", worst);
console.log(
  "duration      :",
  (images * 8) / 100,
  "s (" + CLIP_COUNT + " clips x " + CLIP_FRAMES + " frames)",
);
