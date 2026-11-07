import type { GenerateOptions } from './generate';
import { FULL_CROP, normalizeCrop, type CropRect, type ResampleMode, type Rotation } from './image';
import { threadById } from './palettes';
import { clampStitches, DEFAULT_FABRIC_ID, defaultStrands, fabricById, presetById } from './sizing';

export interface Settings {
  name: string;
  fabricId: string;
  strands: number;
  presetId: string | null;
  width: number;
  height: number;
  lockAspect: boolean;
  crop: CropRect;
  rotation: Rotation;
  maxColors: number;
  dither: boolean;
  cleanup: number;
  resample: ResampleMode;
  brightness: number;
  contrast: number;
  saturation: number;
  alphaThreshold: number;
  excluded: string[];
  background: string[];
  replacements: Record<string, string>;
  /** Fabric / garment colour used for previews (hex). */
  fabricColor: string;
}

export const MIN_COLORS = 2;
export const MAX_COLORS = 60;
export const CLEANUP_LEVELS = [0, 2, 3, 5] as const;

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  fabricId: DEFAULT_FABRIC_ID,
  strands: defaultStrands(fabricById(DEFAULT_FABRIC_ID)),
  presetId: null,
  width: 80,
  height: 80,
  lockAspect: true,
  crop: FULL_CROP,
  rotation: 0,
  maxColors: 12,
  dither: false,
  cleanup: 2,
  resample: 'average',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  alphaThreshold: 0.5,
  excluded: [],
  background: [],
  replacements: {},
  fabricColor: '#ffffff',
};

export function toGenerateOptions(s: Settings): GenerateOptions {
  return {
    width: s.width,
    height: s.height,
    crop: s.crop,
    maxColors: s.maxColors,
    dither: s.dither,
    cleanup: s.cleanup,
    resample: s.resample,
    brightness: s.brightness,
    contrast: s.contrast,
    saturation: s.saturation,
    alphaThreshold: s.alphaThreshold,
    excluded: s.excluded,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number, min: number, max: number, int = false): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const c = Math.min(max, Math.max(min, n));
  return int ? Math.round(c) : c;
}

function threadIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!threadById(x)) : [];
}

/** Coerces untrusted input (project files, storage) into valid settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!isObj(raw)) return { ...d };
  const fabric = fabricById(typeof raw.fabricId === 'string' ? raw.fabricId : d.fabricId);
  const crop = isObj(raw.crop)
    ? normalizeCrop({
        x: num(raw.crop.x, 0, 0, 1),
        y: num(raw.crop.y, 0, 0, 1),
        w: num(raw.crop.w, 1, 0, 1),
        h: num(raw.crop.h, 1, 0, 1),
      })
    : FULL_CROP;
  const replacements: Record<string, string> = {};
  if (isObj(raw.replacements)) {
    for (const [from, to] of Object.entries(raw.replacements)) {
      if (typeof to === 'string' && threadById(from) && threadById(to) && from !== to) {
        replacements[from] = to;
      }
    }
  }
  const rotation = [0, 90, 180, 270].includes(raw.rotation as number)
    ? (raw.rotation as Rotation)
    : 0;
  const cleanup = CLEANUP_LEVELS.includes(raw.cleanup as (typeof CLEANUP_LEVELS)[number])
    ? (raw.cleanup as number)
    : d.cleanup;
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : d.name,
    fabricId: fabric.id,
    strands: num(raw.strands, defaultStrands(fabric), 1, 6, true),
    presetId: typeof raw.presetId === 'string' && presetById(raw.presetId) ? raw.presetId : null,
    width: clampStitches(num(raw.width, d.width, 1, 10000)),
    height: clampStitches(num(raw.height, d.height, 1, 10000)),
    lockAspect: typeof raw.lockAspect === 'boolean' ? raw.lockAspect : d.lockAspect,
    crop,
    rotation,
    maxColors: num(raw.maxColors, d.maxColors, MIN_COLORS, MAX_COLORS, true),
    dither: typeof raw.dither === 'boolean' ? raw.dither : d.dither,
    cleanup,
    resample: raw.resample === 'sharp' ? 'sharp' : 'average',
    brightness: num(raw.brightness, 0, -100, 100, true),
    contrast: num(raw.contrast, 0, -100, 100, true),
    saturation: num(raw.saturation, 0, -100, 100, true),
    alphaThreshold: num(raw.alphaThreshold, d.alphaThreshold, 0.05, 1),
    excluded: threadIds(raw.excluded),
    background: threadIds(raw.background),
    replacements,
    fabricColor:
      typeof raw.fabricColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.fabricColor)
        ? raw.fabricColor.toLowerCase()
        : d.fabricColor,
  };
}
