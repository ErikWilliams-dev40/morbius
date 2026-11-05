// lib/render.mjs — SVG frame renderer for the rope compilation reel.
export const W = 560;
export const H = 315;
export const TAU = Math.PI * 2;
export const CLIP_FRAMES = 24; // frames per clip at 12.5 fps -> 1.92 s
export const CLIP_COUNT = 5;
export const FADE = 8; // frames of cross-dissolve between clips

const FONT = "Helvetica Neue, Helvetica, Arial, DejaVu Sans, sans-serif";

const PAL = {
  manila: { body: "#c69a62", dark: "#6f4d28", light: "#efd9b4", groove: "#5d3f20" },
  nylon: { body: "#2fa9c8", dark: "#0f5f77", light: "#a8e8f6", groove: "#0b4f66" },
  bungee: { body: "#d9a92c", dark: "#7a5a0d", light: "#f3d98a", groove: "#2a2313" },
  dock: { body: "#dde3ea", dark: "#828d9b", light: "#ffffff", groove: "#6f7a88" },
  hemp: { body: "#7b5733", dark: "#3f2c19", light: "#ab7f50", groove: "#33230f" },
};

const num = (v) => Math.round(v * 100) / 100;

export function pathData(pts) {
  let d = `M ${num(pts[0][0])} ${num(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${num(pts[i][0])} ${num(pts[i][1])}`;
  return d;
}

function normals(pts) {
  const ns = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    ns.push([-ty / l, tx / l]);
  }
  return ns;
}

// Cumulative arc length at each point of a polyline. Twist is measured in
// pixels along the rope, not in samples, so the lay stays consistent whether
// the path is 120px or 900px long.
function arcLengths(pts) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) {
    s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return s;
}

// One helical strand riding along the centre path: the lateral offset follows
// a sine wave in arc length, which is exactly what a laid rope looks like.
function strandPath(pts, s, amp, pitch, offset, dir) {
  const ns = normals(pts);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const off = amp * Math.sin((TAU * (dir * s[i] + offset)) / pitch);
    out.push([pts[i][0] + ns[i][0] * off, pts[i][1] + ns[i][1] * off]);
  }
  return out;
}

// A three-strand rope: three helices of the same hand, a third of a lay apart.
function threeStrand(pal) {
  return [
    { off: 0, dir: 1, color: pal.groove, width: 0.15, opacity: 0.85 },
    { off: 1 / 3, dir: 1, color: pal.light, width: 0.12, opacity: 0.6 },
    { off: 2 / 3, dir: 1, color: pal.groove, width: 0.15, opacity: 0.85 },
  ];
}

// A braided sheath: two families of helices running in opposite hands, which
// cross each other and read as a woven diamond pattern.
function braidStrand(pal) {
  return [
    { off: 0, dir: 1, color: pal.groove, width: 0.12, opacity: 0.8 },
    { off: 0.5, dir: 1, color: pal.groove, width: 0.12, opacity: 0.8 },
    { off: 0.25, dir: -1, color: pal.groove, width: 0.12, opacity: 0.8 },
    { off: 0.75, dir: -1, color: pal.groove, width: 0.12, opacity: 0.8 },
    { off: 0.12, dir: 1, color: pal.light, width: 0.06, opacity: 0.4 },
  ];
}

// Draws one rope: drop shadow, dark casing, body colour, optional bands,
// twisted strands, then a lit and a shaded crescent for a cylindrical read.
export function rope(pts, o) {
  const { id, w, pal, strands = [], bands, pitch = 30, spin = 0 } = o;
  const d = pathData(pts);
  const defs = [
    `<mask id="${id}-clip" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></mask>`,
    `<mask id="${id}-hi" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" transform="translate(-2.2,-2.8)" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#000" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></mask>`,
    `<mask id="${id}-lo" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#000" stroke-width="${w}" transform="translate(-2.2,-2.8)" stroke-linecap="round" stroke-linejoin="round"/></mask>`,
    `<filter id="${id}-b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>`,
  ];

  let body = `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="${w + 9}" stroke-linecap="round" stroke-linejoin="round" transform="translate(3,7)" filter="url(#${id}-b)"/>`;
  body += `<path d="${d}" fill="none" stroke="${pal.dark}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  body += `<path d="${d}" fill="none" stroke="${pal.body}" stroke-width="${w - 2.6}" stroke-linecap="round" stroke-linejoin="round"/>`;

  if (bands) {
    body += `<g mask="url(#${id}-clip)"><path d="${d}" fill="none" stroke="${bands.color}" stroke-width="${w - 3}" stroke-dasharray="${bands.dash}" stroke-dashoffset="${bands.offset || 0}" stroke-linecap="butt"/></g>`;
  }

  if (strands.length) {
    const s = arcLengths(pts);
    const amp = (w / 2) * 0.86;
    let z = "";
    for (const st of strands) {
      const zp = strandPath(pts, s, amp, pitch, st.off * pitch + spin, st.dir);
      z += `<path d="${pathData(zp)}" fill="none" stroke="${st.color}" stroke-width="${num(w * st.width)}" stroke-linecap="round" stroke-linejoin="round" opacity="${st.opacity}"/>`;
    }
    body += `<g mask="url(#${id}-clip)">${z}</g>`;
  }

  body += `<g mask="url(#${id}-lo)"><rect width="${W}" height="${H}" fill="${pal.dark}" opacity="0.6"/></g>`;
  body += `<g mask="url(#${id}-hi)"><rect width="${W}" height="${H}" fill="${pal.light}" opacity="0.38"/></g>`;

  return { defs, body };
}

export function ring(x, y, r = 9) {
  return `<g><rect x="${num(x - 17)}" y="${num(y - 4)}" width="34" height="8" rx="3" fill="#79838f"/><circle cx="${num(x)}" cy="${num(y)}" r="${r}" fill="none" stroke="#c8d2de" stroke-width="3.4"/><circle cx="${num(x)}" cy="${num(y)}" r="${num(r - 4)}" fill="none" stroke="#5d6772" stroke-width="1.4"/></g>`;
}

export function knot(p, pal) {
  return `<g><circle cx="${num(p[0])}" cy="${num(p[1])}" r="11" fill="${pal.dark}"/><circle cx="${num(p[0])}" cy="${num(p[1])}" r="7.5" fill="${pal.body}"/><path d="M ${num(p[0] - 10)} ${num(p[1] + 3)} C ${num(p[0] - 5)} ${num(p[1] - 9)} ${num(p[0] + 7)} ${num(p[1] - 8)} ${num(p[0] + 10)} ${num(p[1] - 1)}" fill="none" stroke="${pal.light}" stroke-width="2.6" stroke-linecap="round" opacity="0.75"/></g>`;
}

// ------------------------------------------------------------ scene helpers ---

// Fibres splaying out of a cut rope end.
function fray(p, pal, n, len = 8) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const a = -0.75 + (1.5 * i) / (n - 1);
    s += `<path d="M ${num(p[0])} ${num(p[1])} L ${num(p[0] + Math.sin(a) * len)} ${num(p[1] + Math.cos(a) * len)}" stroke="${pal.light}" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>`;
  }
  return s;
}

function boltPlate(x, y, w = 26) {
  return `<g><rect x="${num(x - w / 2)}" y="${num(y - 4)}" width="${w}" height="8" rx="3" fill="#6f7a87"/><rect x="${num(x - 3)}" y="${num(y + 3)}" width="6" height="12" fill="#59636f"/></g>`;
}

// ------------------------------------------------------- clip 1: manila ---

function sceneManila(q, id) {
  const defs = [];
  const body = [];
  const p = (TAU * q) / CLIP_FRAMES;

  // A swinging rope, tapering from the anchor down to the working end.
  const hang = (ax, L, amp, ph) => {
    const pts = [];
    const N = 130;
    const ang = amp * Math.sin(p + ph) + 0.3 * amp * Math.sin(3 * p + ph);
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const a = ang * s;
      const sway = 7 * Math.sin(Math.PI * s) * Math.sin(p + ph + 0.5);
      pts.push([ax + Math.sin(a) * L * s + sway, 56 + Math.cos(a) * L * s]);
    }
    return pts;
  };

  const A = hang(172, 150, 0.3, 0);
  const B = hang(420, 108, 0.22, 2.2);
  const ra = rope(A, {
    id: id + "m1",
    w: 21,
    pal: PAL.manila,
    strands: threeStrand(PAL.manila),
    pitch: 38,
    spin: 38 * (q / CLIP_FRAMES),
  });
  const rb = rope(B, {
    id: id + "m2",
    w: 17,
    pal: PAL.manila,
    strands: threeStrand(PAL.manila),
    pitch: 32,
    spin: 32 * (q / CLIP_FRAMES),
  });
  defs.push(...ra.defs, ...rb.defs);
  body.push(ra.body, rb.body);
  body.push(boltPlate(172, 56, 24), boltPlate(420, 56, 24));
  body.push(knot(A[A.length - 1], PAL.manila));
  body.push(fray(A[A.length - 1], PAL.manila, 4, 7));
  body.push(knot(B[B.length - 1], PAL.manila));
  body.push(fray(B[B.length - 1], PAL.manila, 3, 5));
  return { defs, body: body.join("") };
}

// ------------------------------------------------ clip 2: nylon kernmantle ---

function sceneNylon(q, id) {
  const defs = [];
  const body = [];
  const p = (TAU * q) / CLIP_FRAMES;

  // The main line drapes in a lazy S from an eye bolt down to a carabiner.
  const x0 = 88;
  const y0 = 66;
  const x1 = 448;
  const y1 = 198;
  const drape = [];
  const N = 190;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const belly = 52 * Math.sin(Math.PI * s);
    const ripple = 13 * Math.sin(2 * Math.PI * s + p) * Math.sin(Math.PI * s);
    drape.push([x0 + (x1 - x0) * s + ripple, y0 + (y1 - y0) * s + belly]);
  }

  // A bight hung over its own peg: both strands leave the peg and curve into
  // a U, which is how a folded rope actually hangs.
  const bx = 462;
  const by = 66;
  const bight = [];
  const M = 150;
  for (let i = 0; i <= M; i++) {
    const t = i / M;
    const sw = 6 * Math.sin(p) * Math.sin(Math.PI * t);
    bight.push([bx + 22 * Math.sin(Math.PI * t) + sw, by + 92 * (1 - Math.cos(Math.PI * t))]);
  }

  const rd = rope(drape, {
    id: id + "n1",
    w: 16,
    pal: PAL.nylon,
    strands: braidStrand(PAL.nylon),
    pitch: 30,
    spin: 30 * (q / CLIP_FRAMES),
  });
  const rb = rope(bight, {
    id: id + "n2",
    w: 13,
    pal: PAL.nylon,
    strands: braidStrand(PAL.nylon),
    pitch: 24,
    spin: -24 * (q / CLIP_FRAMES),
  });
  defs.push(...rd.defs, ...rb.defs);
  body.push(rd.body, rb.body);
  body.push(boltPlate(x0, y0 - 10, 22), boltPlate(bx, by - 12, 18));

  // A carabiner clipped to the low end of the drape.
  const end = drape[N];
  body.push(
    `<g><rect x="${num(end[0] - 4)}" y="${num(end[1] - 3)}" width="8" height="14" rx="3" fill="#8d97a4"/><ellipse cx="${num(end[0])}" cy="${num(end[1] + 16)}" rx="9" ry="12" fill="none" stroke="#c2ccd9" stroke-width="3.6"/><rect x="${num(end[0] - 8)}" y="${num(end[1] + 6)}" width="16" height="4" rx="2" fill="#9aa5b3"/></g>`,
  );
  return { defs, body: body.join("") };
}

// ---------------------------------------------------- clip 3: shock cord ---

function sceneCord(q, id) {
  const defs = [];
  const body = [];
  const p = (TAU * q) / CLIP_FRAMES;

  const cord = (ax, ph, base, travel) => {
    const stretch = 0.5 - 0.5 * Math.cos(p + ph);
    const L = base + stretch * travel;
    const pts = [];
    const N = 130;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const bulge = 22 * Math.sin(Math.PI * s) * Math.sin(p + ph + 0.9);
      const ripple = 3 * Math.sin(s * 15 + p * 2 + ph) * s;
      pts.push([ax + bulge + ripple, 56 + L * s]);
    }
    return { pts, stretch };
  };

  const A = cord(178, 0, 104, 40, 15);
  const B = cord(392, 2.4, 78, 30, 12);
  const ra = rope(A.pts, {
    id: id + "c1",
    w: 15,
    pal: PAL.bungee,
    strands: braidStrand(PAL.bungee),
    pitch: 19,
    spin: 19 * (q / CLIP_FRAMES),
    bands: { color: PAL.bungee.groove, dash: "5 11", offset: -A.stretch * 16 },
  });
  const rb = rope(B.pts, {
    id: id + "c2",
    w: 12,
    pal: PAL.bungee,
    strands: braidStrand(PAL.bungee),
    pitch: 16,
    spin: 16 * (q / CLIP_FRAMES),
    bands: { color: PAL.bungee.groove, dash: "4 9", offset: -B.stretch * 13 },
  });
  defs.push(...ra.defs, ...rb.defs);
  body.push(ra.body, rb.body);
  body.push(boltPlate(178, 56, 24), boltPlate(392, 56, 24));

  const block = (p2, w2) =>
    `<g><rect x="${num(p2[0] - w2)}" y="${num(p2[1] - 4)}" width="${w2 * 2}" height="20" rx="3" fill="#7d8794"/><rect x="${num(p2[0] - w2)}" y="${num(p2[1] - 4)}" width="${w2 * 2}" height="6" rx="3" fill="#98a3b1"/></g>`;
  body.push(block(A.pts[A.pts.length - 1], 15), block(B.pts[B.pts.length - 1], 12));
  return { defs, body: body.join("") };
}

// ----------------------------------------------------- clip 4: dock line ---

function sceneDock(q, id) {
  const defs = [];
  const body = [];
  const p = (TAU * q) / CLIP_FRAMES;
  const x0 = 96;
  const x1 = 504;
  const y0 = 70;
  const sag = 74 + 9 * Math.sin(p);
  const pts = [];
  const N = 150;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const x = x0 + (x1 - x0) * s;
    const droop = sag * 4 * s * (1 - s);
    const sway = 7 * Math.sin(Math.PI * s) * Math.sin(p + 0.4);
    pts.push([x, y0 + droop + sway]);
  }
  const r = rope(pts, {
    id: id + "d",
    w: 16,
    pal: PAL.dock,
    strands: braidStrand(PAL.dock),
    pitch: 28,
    spin: 28 * (q / CLIP_FRAMES),
  });
  defs.push(...r.defs);
  body.push(r.body);
  // a shackle riding the lowest point of the catenary
  const mid = pts[Math.floor(N / 2)];
  body.push(
    `<g><rect x="${num(mid[0] - 4)}" y="${num(mid[1] - 1)}" width="8" height="16" rx="3" fill="#8d97a4"/><circle cx="${num(mid[0])}" cy="${num(mid[1] + 20)}" r="9" fill="none" stroke="#b9c3d0" stroke-width="3.4"/></g>`,
  );
  body.push(boltPlate(x0, y0 - 12, 20));
  body.push(boltPlate(x1, y0 - 12, 20));
  return { defs, body: body.join("") };
}

// ------------------------------------------------- clip 5: tarred hemp coil ---

function sceneCoil(q, id) {
  const defs = [];
  const body = [];
  const p = (TAU * q) / CLIP_FRAMES;
  const cx = 288;
  const cy = 150;
  const turns = 3;
  const N = 340;
  const pts = [];

  // A hank of rope coiled flat, seen from above: the spiral nests tightly so
  // it reads as one continuous coil, and each turn rides a little higher than
  // the last so the stack has visible depth.
  const squash = 0.44;
  const lift = 4.5;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const a = -s * TAU * turns + p * 0.35;
    const rad = 44 + s * 52;
    const turn = Math.floor(s * turns);
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * squash - turn * lift]);
  }

  // The working end leaves the outermost turn and trails away along the bench,
  // continuing the spiral's tangent so the joint stays smooth.
  const last = pts[N];
  const prev = pts[N - 8];
  const tx = last[0] - prev[0];
  const ty = last[1] - prev[1];
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const c1 = [last[0] + ux * 26 - 4 * Math.sin(p), last[1] + uy * 26 + 12];
  const c2 = [
    last[0] + ux * 52 + 10 * Math.sin(p + 0.4),
    last[1] + uy * 46 + 20 * Math.cos(p + 0.4),
  ];
  for (let i = 1; i <= 30; i++) {
    const t = i / 30;
    const u = 1 - t;
    pts.push([
      u * u * last[0] + 2 * u * t * c1[0] + t * t * c2[0],
      u * u * last[1] + 2 * u * t * c1[1] + t * t * c2[1],
    ]);
  }

  const r = rope(pts, {
    id: id + "h",
    w: 14,
    pal: PAL.hemp,
    strands: threeStrand(PAL.hemp),
    pitch: 52,
    spin: 52 * (q / CLIP_FRAMES),
  });
  defs.push(...r.defs);
  // Contact shadow first, so the hank sits on the bench rather than floating.
  body.push(
    `<ellipse cx="${num(cx + 4)}" cy="${num(cy + 32)}" rx="90" ry="14" fill="#000000" opacity="0.4" filter="url(#${id}h-b)"/>`,
  );
  body.push(r.body);
  body.push(knot(pts[pts.length - 1], PAL.hemp));
  body.push(fray(pts[pts.length - 1], PAL.hemp, 3, 6));
  return { defs, body: body.join("") };
}

// ------------------------------------------------------------- the reel ---

export const CLIPS = [
  {
    name: "MANILA",
    spec: "3-strand natural fibre / 24 mm",
    chip: PAL.manila.body,
    scene: sceneManila,
  },
  {
    name: "NYLON KERNMANTLE",
    spec: "single rope / 10.5 mm",
    chip: PAL.nylon.body,
    scene: sceneNylon,
  },
  { name: "SHOCK CORD", spec: "elastic bungee / 8 mm", chip: PAL.bungee.body, scene: sceneCord },
  { name: "DOCK LINE", spec: "braided polyester / 16 mm", chip: PAL.dock.body, scene: sceneDock },
  { name: "TARRED HEMP", spec: "coiled hank / 18 mm", chip: PAL.hemp.body, scene: sceneCoil },
];

const CARD = { x: 36, y: 44, w: 488, h: 196 };

function cardSvg() {
  return `<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="10" fill="url(#card)" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1"/>`;
}

export function frameSvg(f) {
  const defs = [];
  const body = [];
  const total = CLIP_FRAMES * CLIP_COUNT;
  const c = Math.floor(f / CLIP_FRAMES) % CLIP_COUNT;
  const l = f % CLIP_FRAMES;

  defs.push(
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a26"/><stop offset="0.55" stop-color="#0d1219"/><stop offset="1" stop-color="#070a0f"/></linearGradient>`,
    `<linearGradient id="card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2534"/><stop offset="1" stop-color="#131a25"/></linearGradient>`,
    `<radialGradient id="vig" cx="0.5" cy="0.45" r="0.78"><stop offset="0.45" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.6"/></radialGradient>`,
    `<clipPath id="reelwin"><rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="10"/></clipPath>`,
  );

  body.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);

  // Reel transition: the outgoing clip slides up out of the window while the
  // next one slides in from below, so no two scenes ever overlap on screen.
  const tailStart = CLIP_FRAMES - FADE;
  const prog = l >= tailStart ? (l - tailStart) / (FADE - 1) : 0;
  const next = (c + 1) % CLIP_COUNT;
  const slide = CARD.h;

  const sc = CLIPS[c].scene(l, "a");
  defs.push(...sc.defs);
  body.push(
    `<g clip-path="url(#reelwin)"><g transform="translate(0,${num(-prog * slide)})">${cardSvg()}${sc.body}</g></g>`,
  );

  if (prog > 0) {
    const sn = CLIPS[next].scene(l - CLIP_FRAMES, "b");
    defs.push(...sn.defs);
    body.push(
      `<g clip-path="url(#reelwin)"><g transform="translate(0,${num((1 - prog) * slide)})">${cardSvg()}${sn.body}</g></g>`,
    );
  }

  const dom = prog > 0.5 ? next : c;
  const clip = CLIPS[dom];

  // Header.
  body.push(
    `<text x="20" y="27" font-family="${FONT}" font-size="16" font-weight="700" letter-spacing="3.4" fill="#e8eef7">ROPE COMPILATION</text>`,
  );
  body.push(
    `<text x="${W - 20}" y="27" text-anchor="end" font-family="${FONT}" font-size="11.5" letter-spacing="2.2" fill="#7d8b9e">REEL ${String(dom + 1).padStart(2, "0")} / ${String(CLIP_COUNT).padStart(2, "0")}</text>`,
  );
  body.push(
    `<rect x="20" y="35" width="${W - 40}" height="1" fill="#ffffff" fill-opacity="0.08"/>`,
  );

  // Clip title + spec.
  body.push(`<rect x="36" y="253" width="4" height="15" rx="2" fill="${clip.chip}"/>`);
  body.push(
    `<text x="48" y="265" font-family="${FONT}" font-size="14.5" font-weight="700" letter-spacing="1.6" fill="#eef3fa">${clip.name}</text>`,
  );
  body.push(
    `<text x="${W - 36}" y="264" text-anchor="end" font-family="${FONT}" font-size="11" letter-spacing="1.1" fill="#78869a">${clip.spec}</text>`,
  );

  // Scrubber: one segment per clip, plus a playhead across the whole reel.
  const segW = (CARD.w - 8 * (CLIP_COUNT - 1)) / CLIP_COUNT;
  for (let i = 0; i < CLIP_COUNT; i++) {
    const x = CARD.x + i * (segW + 8);
    const on = i === dom;
    body.push(
      `<rect x="${num(x)}" y="281" width="${num(segW)}" height="4" rx="2" fill="${CLIPS[i].chip}" fill-opacity="${on ? 0.95 : 0.22}"/>`,
    );
  }
  const headX = CARD.x + CARD.w * (f / total);
  body.push(`<rect x="${num(headX - 1)}" y="276" width="2" height="14" rx="1" fill="#f2f6fb"/>`);

  body.push(`<rect width="${W}" height="${H}" fill="url(#vig)"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join("")}</defs>${body.join("")}</svg>`;
}
