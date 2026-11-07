import type { RasterImage } from '../core/image';

/** Images are scaled down to this longest side — far more detail than any stitch grid needs. */
export const MAX_SOURCE_SIDE = 2048;

export interface LoadedImage {
  id: number;
  name: string;
  /** Downscaled source, used for display, cropping and saving projects. */
  canvas: HTMLCanvasElement;
  raster: RasterImage;
  /** Original size if the image had to be scaled down. */
  resizedFrom: { width: number; height: number } | null;
}

let nextId = 1;

export async function loadImage(src: Blob | string, name: string): Promise<LoadedImage> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const w0 = img.naturalWidth || 512;
    const h0 = img.naturalHeight || 512;
    const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(w0, h0));
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas not available');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    return {
      id: nextId++,
      name: name.replace(/\.[a-z0-9]+$/i, '') || 'image',
      canvas,
      raster: { width, height, data },
      resizedFrom: scale < 1 ? { width: w0, height: h0 } : null,
    };
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  }
}

function hasTransparency(raster: RasterImage): boolean {
  const d = raster.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
  return false;
}

/** Compact data URL for project files: PNG if the image has transparency, JPEG otherwise. */
export function imageToDataUrl(img: LoadedImage): string {
  return hasTransparency(img.raster)
    ? img.canvas.toDataURL('image/png')
    : img.canvas.toDataURL('image/jpeg', 0.92);
}
