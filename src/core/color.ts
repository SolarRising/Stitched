/** Colour science helpers: sRGB ↔ CIELAB (D65) and colour difference metrics. */

export type RGB = readonly [number, number, number];
export type Lab = readonly [number, number, number];

const SRGB_LUT = new Float64Array(256);
for (let i = 0; i < 256; i++) SRGB_LUT[i] = srgbChannelToLinear(i);

function srgbChannelToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return v * 255;
}

/** Linear-light value of an sRGB channel (0–255, may be fractional). */
export function toLinear(v: number): number {
  return Number.isInteger(v) && v >= 0 && v <= 255 ? SRGB_LUT[v] : srgbChannelToLinear(v);
}

// D65 reference white, derived from the sRGB matrix so that white maps to a*=b*=0 exactly.
const XN = 0.4124564 + 0.3575761 + 0.1804375;
const YN = 1;
const ZN = 0.0193339 + 0.119192 + 0.9503041;
const EPS = (6 / 29) ** 3;
const KAPPA = 1 / (3 * (6 / 29) ** 2);

function f(t: number): number {
  return t > EPS ? Math.cbrt(t) : t * KAPPA + 4 / 29;
}

function fInv(t: number): number {
  return t > 6 / 29 ? t * t * t : (t - 4 / 29) / KAPPA;
}

/** sRGB (0–255 per channel) → CIELAB. */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / XN;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / YN;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / ZN;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIELAB → sRGB, clamped to 0–255 (not rounded). */
export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = fInv(fx) * XN;
  const y = fInv(fy) * YN;
  const z = fInv(fz) * ZN;
  const lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const lg = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  return [
    clamp(linearChannelToSrgb(Math.max(0, lr))),
    clamp(linearChannelToSrgb(Math.max(0, lg))),
    clamp(linearChannelToSrgb(Math.max(0, lb))),
  ];
}

/** Squared CIE76 distance — cheap, good enough for clustering. */
export function deltaE76Sq(
  L1: number,
  a1: number,
  b1: number,
  L2: number,
  a2: number,
  b2: number,
): number {
  const dL = L1 - L2;
  const da = a1 - a2;
  const db = b1 - b2;
  return dL * dL + da * da + db * db;
}

const DEG = Math.PI / 180;
const POW25_7 = 25 ** 7;

function hueDeg(b: number, ap: number): number {
  if (ap === 0 && b === 0) return 0;
  const h = Math.atan2(b, ap) / DEG;
  return h < 0 ? h + 360 : h;
}

/** CIEDE2000 colour difference (Sharma, Wu & Dalal 2005), kL = kC = kH = 1. */
export function ciede2000(
  L1: number,
  a1: number,
  b1: number,
  L2: number,
  a2: number,
  b2: number,
): number {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(b1, a1p);
  const h2p = hueDeg(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const CpProd = C1p * C2p;
  let dhp = 0;
  if (CpProd !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(CpProd) * Math.sin((dhp / 2) * DEG);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp: number;
  if (CpProd === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * DEG) +
    0.24 * Math.cos(2 * hbarp * DEG) +
    0.32 * Math.cos((3 * hbarp + 6) * DEG) -
    0.2 * Math.cos((4 * hbarp - 63) * DEG);
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + POW25_7));
  const Lm50sq = (Lbarp - 50) ** 2;
  const SL = 1 + (0.015 * Lm50sq) / Math.sqrt(20 + Lm50sq);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * DEG) * RC;

  const tL = dLp / SL;
  const tC = dCp / SC;
  const tH = dHp / SH;
  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance (0–1). */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Black or white, whichever reads better on the given background. */
export function contrastInk(r: number, g: number, b: number): '#000000' | '#ffffff' {
  // 0.179 is where contrast against black equals contrast against white.
  return relativeLuminance(r, g, b) > 0.179 ? '#000000' : '#ffffff';
}
