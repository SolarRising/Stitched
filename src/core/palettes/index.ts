import { ciede2000, deltaE76Sq, hexToRgb, rgbToLab, type Lab, type RGB } from '../color';
import { DMC_RAW } from './dmc';

export type ThreadBrand = 'DMC';

export interface Thread {
  /** Stable id used in settings and project files, e.g. "dmc:310". */
  readonly id: string;
  readonly brand: ThreadBrand;
  readonly code: string;
  readonly name: string;
  readonly hex: string;
  readonly rgb: RGB;
  readonly lab: Lab;
  /** Position on the brand's colour card (used for sorting by hue family). */
  readonly order: number;
}

export const DMC: readonly Thread[] = DMC_RAW.map(([code, name, hex], order) => {
  const rgb = hexToRgb(hex);
  return {
    id: `dmc:${code}`,
    brand: 'DMC' as const,
    code,
    name,
    hex: `#${hex}`,
    rgb,
    lab: rgbToLab(rgb[0], rgb[1], rgb[2]),
    order,
  };
});

const BY_ID = new Map(DMC.map((t) => [t.id, t]));

export function threadById(id: string): Thread | undefined {
  return BY_ID.get(id);
}

export function threadLabel(t: Thread): string {
  return `${t.brand} ${t.code}`;
}

/**
 * Nearest threads to a Lab colour by CIEDE2000. A CIE76 pre-filter keeps this fast:
 * the true CIEDE2000 winner is practically always among the closest CIE76 candidates.
 */
export function nearestThreads(
  lab: Lab,
  palette: readonly Thread[],
  count = 1,
  prefilter = Math.max(12, count * 3),
): Thread[] {
  if (palette.length === 0) return [];
  const [L, a, b] = lab;
  const scored = palette.map((t) => ({ t, d: deltaE76Sq(L, a, b, t.lab[0], t.lab[1], t.lab[2]) }));
  scored.sort((x, y) => x.d - y.d);
  const candidates = scored.slice(0, Math.min(scored.length, prefilter)).map(({ t }) => ({
    t,
    d: ciede2000(L, a, b, t.lab[0], t.lab[1], t.lab[2]),
  }));
  candidates.sort((x, y) => x.d - y.d);
  return candidates.slice(0, count).map(({ t }) => t);
}
