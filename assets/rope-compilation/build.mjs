// build.mjs — renders the rope compilation reel and encodes it as an animated GIF.
//
//   node build.mjs [output.gif] [--preview]
//
// The GIF is written to output.gif (default: rope-compilation.gif next to this
// file). --preview also writes a contact sheet of representative frames.
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { buildPalette, mapFrame, assembleGif } from "./lib/gif.mjs";
import { frameSvg, W, H, CLIP_FRAMES, CLIP_COUNT } from "./lib/render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOTAL = CLIP_FRAMES * CLIP_COUNT;
const DELAY_CS = 8; // centiseconds -> 12.5 fps
const OUT = resolve(HERE, process.argv[2] ?? "rope-compilation.gif");
const WANT_PREVIEW = process.argv.includes("--preview");

async function renderFrames() {
  const frames = [];
  for (let f = 0; f < TOTAL; f++) {
    const svg = frameSvg(f);
    const { data, info } = await sharp(Buffer.from(svg), { density: 72 })
      .flatten({ background: "#000000" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== W || info.height !== H) {
      throw new Error(`unexpected frame size ${info.width}x${info.height}, wanted ${W}x${H}`);
    }
    let rgb = data;
    if (info.channels === 4) {
      rgb = Buffer.alloc(info.width * info.height * 3);
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        rgb[j] = data[i];
        rgb[j + 1] = data[i + 1];
        rgb[j + 2] = data[i + 2];
      }
    }
    frames.push({ data: rgb, width: info.width, height: info.height });
    process.stderr.write(`\rrendered ${f + 1}/${TOTAL} frames`);
  }
  process.stderr.write("\n");
  return frames;
}

async function writePreview(frames) {
  const cols = 4;
  const rows = 3;
  const cw = Math.round(W / 2);
  const ch = Math.round(H / 2);
  const picks = [0, 12, 24, 36, 48, 60, 72, 84, 96, 104, 112, 117];
  const composites = [];
  for (let i = 0; i < picks.length; i++) {
    const buf = await sharp(frames[picks[i]].data, {
      raw: { width: W, height: H, channels: 3 },
    })
      .resize(Math.round(cw), Math.round(ch))
      .png()
      .toBuffer();
    composites.push({
      input: buf,
      left: Math.round((i % cols) * cw),
      top: Math.round(Math.floor(i / cols) * ch),
    });
  }
  await sharp({
    create: {
      width: Math.round(cols * cw),
      height: Math.round(rows * ch),
      channels: 3,
      background: "#000",
    },
  })
    .composite(composites)
    .png()
    .toFile(resolve(HERE, "preview.png"));
  process.stderr.write(`preview -> ${resolve(HERE, "preview.png")}\n`);
}

const frames = await renderFrames();
if (WANT_PREVIEW) await writePreview(frames);

const palette = buildPalette(frames, 256);
const cache = new Map();
const indexed = frames.map((f) => ({ indices: mapFrame(f, palette, cache) }));

const gif = assembleGif({
  frames: indexed,
  palette,
  width: W,
  height: H,
  delayCs: DELAY_CS,
  loop: 0,
});
await writeFile(OUT, gif);

const paletteSpread = palette.length;
process.stderr.write(
  `wrote ${OUT} — ${TOTAL} frames, ${(gif.length / 1024).toFixed(0)} KB, ${paletteSpread} colours, ${W}x${H}, ${DELAY_CS}cs delay\n`,
);
